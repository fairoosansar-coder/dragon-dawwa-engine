import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Mic } from 'lucide-react';
import { ErrorNote, Loading } from '../components/ui.tsx';
import { postJson, useRemote } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import type { PilotAnswer, PilotClaim, PilotEpisode } from '../shared/pilot.ts';
import { useEpisodePlayback } from './useEpisodePlayback.ts';

interface SpeechResult {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechSession {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function speechConstructor(): (new () => SpeechSession) | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechSession;
    webkitSpeechRecognition?: new () => SpeechSession;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function roleLabel(role: PilotClaim['role'], labels: { pilotOriginal: string; pilotTranslation: string; pilotExplanation: string; pilotSynthesis: string }): string {
  if (role === 'original') return labels.pilotOriginal;
  if (role === 'explanation') return labels.pilotExplanation;
  if (role === 'translation') return labels.pilotTranslation;
  return labels.pilotSynthesis;
}

export default function LivingPilot() {
  const { t, lang } = useApp();
  const remote = useRemote<PilotEpisode>(`/api/studio/pilot?lang=${lang}`);
  const episode = remote.data && remote.data.lang === lang ? remote.data : null;
  const lines = useMemo(
    () => (episode?.lines ?? []).map(line => ({ speaker: 'Host' as const, text: line.text, citations: line.citations })),
    [episode],
  );
  const playback = useEpisodePlayback(lines, 'Kore', 'Kore', `${lang}:${episode?.chapters.map(chapter => chapter.id).join(',') ?? ''}`, lang);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<PilotAnswer | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState(false);
  const [mic, setMic] = useState(false);
  const speech = useRef<SpeechSession | null>(null);

  useEffect(() => {
    setMic(Boolean(speechConstructor()));
    return () => speech.current?.stop();
  }, []);

  useEffect(() => {
    setAnswer(null);
    setAsking(false);
    setQuestion('');
    setSources(false);
  }, [lang]);

  const lineIndex = playback.activeLines[0] ?? 0;
  const citation = episode?.lines[lineIndex]?.citations[0];
  const chapter = episode?.chapters.find(item => item.claims.some(claim => claim.id === citation)) ?? episode?.chapters[0] ?? null;
  const shown = answer ? answer.evidence : (chapter?.claims ?? []);

  function openAsk() {
    playback.hold();
    setAsking(true);
    setSources(false);
  }

  function resume() {
    if (playback.phase === 'idle') playback.toggle();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setAnswerError(null);
    try {
      const next = await postJson<PilotAnswer>('/api/studio/pilot/ask', { question: trimmed, lang, chapterId: chapter?.id ?? '' });
      if (next.review !== 'unreviewed') return;
      setAnswer(next);
      setSources(false);
    } catch (err) {
      setAnswer(null);
      setAnswerError(err instanceof Error ? err.message : 'This source could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  function dictate() {
    const Ctor = speechConstructor();
    if (!Ctor) return;
    if (speech.current) {
      speech.current.stop();
      speech.current = null;
      return;
    }
    const session = new Ctor();
    session.lang = lang === 'ta' ? 'ta-IN' : lang === 'si' ? 'si-LK' : 'en-US';
    session.interimResults = true;
    session.onresult = event => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0]?.transcript ?? '';
      setQuestion(text.trim());
    };
    session.onerror = () => {
      speech.current = null;
    };
    speech.current = session;
    session.start();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4" data-pilot="living" data-phase={playback.phase} data-resume={playback.position} data-chapter={chapter?.id ?? ''}>
      <p className="text-xs text-muted">{t.pilotPrivate}</p>
      <h2 className="font-display text-2xl font-bold text-pine">{t.pilotTitle ?? episode?.topic}</h2>
      {remote.loading && !episode && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {episode && chapter && (
        <section className="rounded-3xl border border-pine/10 bg-parchment p-4 sm:p-5">
          <p className="text-xs font-semibold text-pine">{t.pilotGenerated}</p>
          <h3 className="mt-2 text-lg font-semibold leading-snug text-ink" lang={episode.lang}>
            {chapter.title}
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-full bg-moss px-4 text-sm font-medium text-white" onClick={playback.toggle}>
              {playback.phase === 'idle' ? t.pilotPlay : t.pause}
            </button>
            <button type="button" className="min-h-11 rounded-full border border-pine/20 bg-white px-4 text-sm font-medium text-pine" onClick={openAsk}>
              {t.ask}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-pine/20 bg-white px-4 text-sm font-medium text-pine"
              aria-expanded={sources}
              onClick={() => setSources(open => !open)}
            >
              {t.sources}
            </button>
          </div>
          {playback.error && <p className="mt-3 text-sm text-red-900">{playback.error}</p>}
        </section>
      )}
      {asking && (
        <section className="rounded-3xl border border-gold bg-white p-4 sm:p-5">
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-medium text-pine" htmlFor="pilot-question">
              {t.pilotAskLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="pilot-question"
                value={question}
                maxLength={500}
                onChange={event => setQuestion(event.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-2xl border border-pine/20 px-3 text-base text-ink"
              />
              {mic && (
                <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-pine/20 text-pine" aria-label={t.pilotMic} onClick={dictate}>
                  <Mic className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            <button type="submit" className="min-h-11 rounded-full bg-pine px-4 text-sm font-medium text-white" disabled={busy || !question.trim()}>
              {busy ? t.asking : t.ask}
            </button>
          </form>
          {answerError && (
            <div className="mt-3">
              <ErrorNote message={answerError} />
            </div>
          )}
          {answer && (
            <div className="mt-4 space-y-3 border-t border-gold/40 pt-4" data-answer={answer.kind} data-review={answer.review}>
              <p className="text-xs font-semibold text-pine">{answer.kind === 'synthesis' ? t.pilotSynthesis : answer.kind === 'limitation' ? answer.note : t.pilotLive}</p>
              {answer.paragraphs.map((paragraph, index) => (
                <p key={`${paragraph.role}-${index}`} className="whitespace-pre-wrap text-base leading-relaxed text-ink" lang={answer.lang}>
                  {paragraph.text}
                </p>
              ))}
              {answer.kind !== 'limitation' && <p className="text-xs text-muted">{answer.note}</p>}
              <button type="button" className="min-h-11 rounded-full bg-moss px-4 text-sm font-medium text-white" onClick={resume}>
                {t.pilotContinue}
              </button>
            </div>
          )}
        </section>
      )}
      {sources && (
        <section className="space-y-3" aria-label={t.sources}>
          {shown.length === 0 && <p className="text-sm text-muted">{answer?.note ?? t.libraryEmpty}</p>}
          {shown.map(claim => (
            <article key={claim.id} className="rounded-3xl border border-pine/10 bg-white p-4">
              <p className="text-xs font-semibold text-pine">{roleLabel(claim.role, t)}</p>
              <p className="mt-1 text-xs text-muted">{claim.label}</p>
              <p lang={claim.role === 'original' ? 'ar' : episode?.lang} dir={claim.role === 'original' ? 'rtl' : undefined} className={`mt-3 whitespace-pre-wrap text-base leading-relaxed text-ink ${claim.role === 'original' ? 'arabic text-xl' : ''}`}>
                {claim.text}
              </p>
              <p className="mt-3 text-xs text-muted">{claim.attribution}</p>
              {claim.sourceUrl && (
                <p className="mt-2">
                  <a className="text-sm text-pine underline" href={claim.sourceUrl} target="_blank" rel="noreferrer">
                    {t.sourcePage}
                  </a>
                </p>
              )}
            </article>
          ))}
          {episode?.gaps.map(gap => (
            <p key={gap.source} className="text-sm text-red-900">
              {gap.source}: {gap.message}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
