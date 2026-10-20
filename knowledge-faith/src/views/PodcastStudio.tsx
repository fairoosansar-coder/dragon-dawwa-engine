import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ViewProps } from '../App.tsx';
import { Download, Mic, Radio, Sparkles, Trash2 } from 'lucide-react';
import type { PodcastScript, TtsResult, Verse } from '../shared/types.ts';
import { getJson, postJson } from '../lib/api.ts';
import { base64ToObjectUrl, pauseAudio } from '../lib/audio.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { CitationChips, EvidenceList } from '../components/cards.tsx';
import { Button, Card, ErrorNote, IconButton, Loading, Notice, SectionTitle, Select, TabLinks } from '../components/ui.tsx';
import { speakInBrowser } from '../engine/utils/browserVoice.ts';

function GeneratedAudio({ audio, filename }: { audio: TtsResult; filename: string }) {
  const { t } = useApp();
  const url = useMemo(() => base64ToObjectUrl(audio.audioBase64, audio.mimeType), [audio]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-mint/60 p-3">
      <audio controls src={url} onPlay={pauseAudio} className="min-w-0 flex-1" />
      <a href={url} download={filename} className="inline-flex items-center gap-1 text-sm font-medium text-pine hover:underline">
        <Download className="h-4 w-4" aria-hidden /> {t.download}
      </a>
    </div>
  );
}

function useVoiceOptions() {
  const { config } = useApp();
  return (config?.voices ?? ['Kore', 'Charon']).map(v => ({ value: v, label: v }));
}

function EpisodeBuilder() {
  const { t, lang, saved, config } = useApp();
  const voices = useVoiceOptions();
  const [episodes, setEpisodes] = useStored<PodcastScript[]>('kf-episodes', []);
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(2);
  const [useSaved, setUseSaved] = useState(false);
  const [hostVoice, setHostVoice] = useStored('kf-host-voice', 'Kore');
  const [guestVoice, setGuestVoice] = useStored('kf-guest-voice', 'Charon');
  const [current, setCurrent] = useState<PodcastScript | null>(null);
  const [audio, setAudio] = useState<TtsResult | null>(null);
  const [busy, setBusy] = useState<'script' | 'audio' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = config ? !config.ai : false;
  const hasSaved = saved.verses.length + saved.hadith.length > 0;

  async function writeScript(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || busy) return;
    setBusy('script');
    setError(null);
    setAudio(null);
    try {
      const script = await postJson<PodcastScript>('/api/podcast/script', {
        topic,
        lang,
        minutes,
        ...(useSaved ? { refs: saved.verses.slice(0, 8), hadith: saved.hadith.slice(0, 4) } : {}),
      });
      setCurrent(script);
      setEpisodes(list => [script, ...list].slice(0, 20));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function makeAudio() {
    if (!current || busy) return;
    setBusy('audio');
    setError(null);
    try {
      setAudio(await postJson<TtsResult>('/api/voice/dialogue', { lines: current.lines, hostVoice, guestVoice }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const cited = useMemo(() => new Set(current?.lines.flatMap(l => l.citations) ?? []), [current]);

  return (
    <>
      <Card>
        <SectionTitle sub={t.studioHint}>
          <span className="inline-flex items-center gap-2">
            <Radio className="h-5 w-5" aria-hidden /> {t.studioTitle}
          </span>
        </SectionTitle>
        {disabled && <Notice>{t.aiOff}</Notice>}
        <form onSubmit={writeScript} className="mt-3 space-y-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink/70">
            {t.topic}
            <input
              value={topic}
              maxLength={300}
              onChange={e => setTopic(e.target.value)}
              disabled={disabled}
              placeholder="e.g. Patience and gratitude in daily life"
              className="rounded-2xl border border-pine/20 bg-white px-4 py-3 text-sm text-ink"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label={t.length}
              value={String(minutes)}
              onChange={v => setMinutes(Number(v))}
              options={[1, 2, 3, 5].map(n => ({ value: String(n), label: String(n) }))}
            />
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={useSaved} disabled={!hasSaved} onChange={e => setUseSaved(e.target.checked)} />
              {t.useSaved}
            </label>
            <Button type="submit" disabled={disabled || !topic.trim() || busy !== null} className="ml-auto">
              <Sparkles className="h-4 w-4" aria-hidden /> {busy === 'script' ? t.writing : t.writeScript}
            </Button>
          </div>
        </form>
        {busy === 'script' && <Loading label={t.writing} />}
        {error && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}
      </Card>

      {current && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold text-pine">{current.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-gold">
                <Sparkles className="h-3 w-3" aria-hidden /> {t.aiGenerated}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Select label={t.hostVoice} value={hostVoice} onChange={setHostVoice} options={voices} />
              <Select label={t.guestVoice} value={guestVoice} onChange={setGuestVoice} options={voices} />
              <Button onClick={makeAudio} disabled={disabled || busy !== null}>
                <Mic className="h-4 w-4" aria-hidden /> {busy === 'audio' ? t.generating : t.generateAudio}
              </Button>
            </div>
          </div>
          {busy === 'audio' && <Loading label={t.generating} />}
          {audio && <GeneratedAudio audio={audio} filename={`${current.title.replace(/[^\w-]+/g, '-')}.wav`} />}
          <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
            <ol className="space-y-3">
              {current.lines.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${l.speaker === 'Host' ? 'bg-pine text-white' : 'bg-gold/20 text-ink'}`}
                  >
                    {l.speaker}
                  </span>
                  <p lang={current.lang} className="leading-relaxed">
                    {l.text}
                    <CitationChips ids={l.citations} />
                  </p>
                </li>
              ))}
            </ol>
            <div>
              <h4 className="mb-3 font-display text-lg font-bold text-pine">{t.sources}</h4>
              <EvidenceList evidence={current.evidence} cited={cited} />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>{t.episodes}</SectionTitle>
        {episodes.length === 0 ? (
          <p className="text-sm text-ink/60">{t.episodesEmpty}</p>
        ) : (
          <ul className="divide-y divide-pine/10">
            {episodes.map(ep => (
              <li key={ep.id} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(ep);
                    setAudio(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex-1 text-left"
                >
                  <span className="block font-medium text-pine">{ep.title}</span>
                  <span className="text-xs text-ink/50">
                    {new Date(ep.createdAt).toLocaleString()} · {ep.lang.toUpperCase()} · {ep.lines.length} lines
                  </span>
                </button>
                <IconButton label={t.delete} onClick={() => setEpisodes(list => list.filter(x => x.id !== ep.id))}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function VoiceStudio() {
  const { t, lang, saved, config } = useApp();
  const voices = useVoiceOptions();
  const [text, setText] = useState('');
  const [voice, setVoice] = useStored('kf-voice', 'Kore');
  const [style, setStyle] = useState('');
  const [audio, setAudio] = useState<TtsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = config ? !config.ai : false;

  async function insert(key: string) {
    if (!key) return;
    try {
      const [verse] = await getJson<Verse[]>(`/api/quran/verses?refs=${encodeURIComponent(key)}&lang=${lang}`);
      if (verse) setText(prev => `${prev ? `${prev}\n\n` : ''}${verse.translation} (Qur'an ${verse.key})`.slice(0, 3000));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function narrate(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (config?.ai) {
        setAudio(await postJson<TtsResult>('/api/voice/narrate', { text, voice, style }));
      } else {
        setAudio(null);
        await speakInBrowser(text, 'Host');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle sub={t.voiceHint}>
        <span className="inline-flex items-center gap-2">
          <Mic className="h-5 w-5" aria-hidden /> {t.voiceStudio}
        </span>
      </SectionTitle>
      {disabled && <Notice>{t.browserVoice}</Notice>}
      <form onSubmit={narrate} className="mt-3 space-y-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink/70">
          {t.text}
          <textarea
            value={text}
            maxLength={3000}
            rows={6}
            onChange={e => setText(e.target.value)}
            className="rounded-2xl border border-pine/20 bg-white px-4 py-3 text-sm leading-relaxed text-ink"
          />
        </label>
        <p className="text-right text-xs text-ink/50">{text.length} / 3000</p>
        <div className="flex flex-wrap items-end gap-3">
          {saved.verses.length > 0 && (
            <Select
              label={t.insert}
              value=""
              onChange={insert}
              options={[{ value: '', label: '—' }, ...saved.verses.map(k => ({ value: k, label: `Qur'an ${k}` }))]}
            />
          )}
          <Select label={t.voice} value={voice} onChange={setVoice} options={voices} />
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-ink/70">
            {t.style}
            <input
              value={style}
              maxLength={200}
              onChange={e => setStyle(e.target.value)}
              placeholder={t.stylePlaceholder}
              className="rounded-xl border border-pine/20 bg-white px-3 py-2 text-sm text-ink"
            />
          </label>
          <Button type="submit" disabled={busy || !text.trim()}>
            <Mic className="h-4 w-4" aria-hidden /> {busy ? t.generating : t.narrate}
          </Button>
        </div>
      </form>
      {busy && <Loading label={t.generating} />}
      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}
      {audio && <GeneratedAudio audio={audio} filename="knowledge-faith-narration.wav" />}
    </Card>
  );
}

const Roundtable = lazy(() => import('../engine/Roundtable.tsx'));

export default function PodcastStudio({ sub }: ViewProps) {
  const { t } = useApp();
  const roundtable = sub === 'roundtable';
  return (
    <>
      <TabLinks
        label={t.navStudio}
        tabs={[
          { href: '#/studio', label: t.studioTitle, active: !roundtable },
          { href: '#/studio/roundtable', label: t.roundtable, active: roundtable },
        ]}
      />
      {roundtable ? (
        <>
          <p className="mb-4 text-sm text-ink/70">{t.roundtableHint}</p>
          <Suspense fallback={<Loading />}>
            <Roundtable />
          </Suspense>
        </>
      ) : (
        <div className="space-y-6">
          <EpisodeBuilder />
          <VoiceStudio />
        </div>
      )}
    </>
  );
}
