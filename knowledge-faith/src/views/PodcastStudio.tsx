import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ViewProps } from '../App.tsx';
import { Download, Mic, Pause, Play, Radio, Sparkles, Trash2 } from 'lucide-react';
import type { PodcastScript, TtsResult, Verse } from '../shared/types.ts';
import { getJson, postJson } from '../lib/api.ts';
import { base64ToObjectUrl, claimPlayback } from '../lib/audio.ts';
import { scrollMain } from '../lib/scroll.ts';
import { useShell } from '../lib/shell.tsx';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { appendEdition } from '../shared/quranenc.ts';
import { CitationChips, EvidenceList } from '../components/cards.tsx';
import { EmptyState } from '../components/shell/widgets.tsx';
import { Button, Card, ErrorNote, IconButton, Loading, Notice, SectionTitle, Select, TabLinks } from '../components/ui.tsx';
import { useEpisodePlayback } from './useEpisodePlayback.ts';

function GeneratedAudio({ audio, filename }: { audio: TtsResult; filename: string }) {
  const { t } = useApp();
  const url = useMemo(() => base64ToObjectUrl(audio.audioBase64, audio.mimeType), [audio]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="mt-4 space-y-2 rounded-2xl bg-mint/60 p-3">
      <p className="text-xs text-muted">{t.generatedNarration}</p>
      <div className="flex flex-wrap items-center gap-3">
      <audio controls src={url} onPlay={event => claimPlayback(event.currentTarget)} className="min-w-0 flex-1" />
      <a href={url} download={filename} className="inline-flex items-center gap-1 text-sm font-medium text-pine hover:underline">
        <Download className="h-4 w-4" aria-hidden /> {t.download}
      </a>
      </div>
    </div>
  );
}

function useVoiceOptions() {
  const { config } = useApp();
  return (config?.voices ?? ['Kore', 'Charon']).map(v => ({ value: v, label: v }));
}

function EpisodeBuilder() {
  const { t, lang, saved, config } = useApp();
  const { query } = useShell();
  const voices = useVoiceOptions();
  const [episodes, setEpisodes] = useStored<PodcastScript[]>('kf-episodes', []);
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(2);
  const [useSaved, setUseSaved] = useState(false);
  const [hostVoice, setHostVoice] = useStored('kf-host-voice', 'Kore');
  const [guestVoice, setGuestVoice] = useStored('kf-guest-voice', 'Charon');
  const [current, setCurrent] = useState<PodcastScript | null>(null);
  const [busy, setBusy] = useState<'script' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playback = useEpisodePlayback(current?.lines ?? [], hostVoice, guestVoice, current?.id ?? '', current?.lang ?? lang);
  const disabled = config ? !config.ai : false;
  const hasSaved = saved.verses.length + saved.hadith.length > 0;

  async function writeScript(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || busy) return;
    setBusy('script');
    setError(null);
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

  const cited = useMemo(() => new Set(current?.lines.flatMap(l => l.citations) ?? []), [current]);
  const activeLine = playback.activeLines[0];

  useEffect(() => {
    if (activeLine === undefined) return;
    document.getElementById(`episode-line-${activeLine}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeLine]);

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
              <p className="mt-1 flex items-center gap-1 text-xs text-pine">
                <Sparkles className="h-3 w-3" aria-hidden /> {t.aiGenerated}
              </p>
              <p className="mt-1 text-xs text-muted">{t.generatedNarration}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Select label={t.hostVoice} value={hostVoice} onChange={setHostVoice} options={voices} />
              <Select label={t.guestVoice} value={guestVoice} onChange={setGuestVoice} options={voices} />
              <Button onClick={playback.toggle} disabled={disabled || busy !== null || playback.chunkCount === 0}>
                {playback.phase === 'idle' ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
                {playback.phase === 'playing' ? t.pauseEpisode : playback.phase === 'loading' ? t.loadingFirstLines : t.playEpisode}
              </Button>
            </div>
          </div>
          {playback.phase === 'loading' && <Loading label={t.loadingFirstLines} />}
          {playback.phase === 'playing' && playback.index < playback.chunkCount - 1 && (
            <p className="mt-3 text-sm text-pine" role="status">
              {t.loadingNextLines}
            </p>
          )}
          {playback.error && (
            <div className="mt-4">
              <ErrorNote message={playback.error} />
            </div>
          )}
          <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
            <ol className="space-y-3">
              {current.lines.map((l, i) => (
                <li
                  key={i}
                  id={`episode-line-${i}`}
                  className={`flex gap-3 rounded-2xl p-2 ${playback.activeLines.includes(i) ? 'bg-mint/80 ring-1 ring-pine/20' : ''}`}
                >
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
          <EmptyState>{t.episodesEmpty}</EmptyState>
        ) : episodes.filter(ep => !query.trim() || ep.title.toLowerCase().includes(query.trim().toLowerCase())).length === 0 ? (
          <EmptyState>{t.noResults}</EmptyState>
        ) : (
          <ul className="divide-y divide-pine/10">
            {episodes
              .filter(ep => !query.trim() || ep.title.toLowerCase().includes(query.trim().toLowerCase()))
              .map(ep => (
              <li key={ep.id} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(ep);
                    scrollMain();
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
  const disabled = !config?.ai;
  const quranEdition = useQuranEdition();

  async function insert(key: string) {
    if (!key) return;
    if (!quranEdition.edition || quranEdition.edition.languageIso !== lang) {
      setError(quranEdition.error ?? 'QuranEnc edition is not loaded. This verse was not inserted.');
      return;
    }
    try {
      const [verse] = await getJson<Verse[]>(
        appendEdition(`/api/quran/verses?refs=${encodeURIComponent(key)}&lang=${lang}`, quranEdition.edition.key),
      );
      if (!verse || verse.translationKey !== quranEdition.edition.key || verse.lang !== lang) {
        setError('QuranEnc did not return this edition. Nothing was inserted.');
        return;
      }
      setText(prev => `${prev ? `${prev}\n\n` : ''}${verse.translation} (Qur'an ${verse.key})`.slice(0, 3000));
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
      if (!config?.ai) {
        throw new Error(t.browserVoice);
      }
      setAudio(await postJson<TtsResult>('/api/voice/narrate', { text, voice, style, lang }));
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
          <Button type="submit" disabled={disabled || busy || !text.trim()}>
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
const LivingPilot = lazy(() => import('./LivingPilot.tsx'));

export default function PodcastStudio({ sub }: ViewProps) {
  const { t } = useApp();
  if (sub === 'pilot') {
    return (
      <Suspense fallback={<Loading />}>
        <LivingPilot />
      </Suspense>
    );
  }
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
