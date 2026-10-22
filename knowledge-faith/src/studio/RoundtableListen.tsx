import { useState, type FormEvent } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { ErrorNote, Loading } from '../components/ui.tsx';
import { postJson, useRemote } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import { STUDIO_EPISODE_BLUEPRINTS } from '../shared/studio/catalogue.ts';
import type { StudioAskAnswer, StudioEpisode } from '../shared/studio/contracts.ts';
import { internalReaderRouteForReference } from '../shared/studio/contracts.ts';
import {
  activeSeat,
  formatClock,
  playbackAction,
  roundtableCopy,
  ROUNDTABLE_COMPANION,
  ROUNDTABLE_HOST,
} from '../shared/studio/roundtable.ts';
import { SourceReaderPanel } from './SourceReaderPanel.tsx';
import { useRoundtablePlayer } from './useRoundtablePlayer.ts';

const FEATURED = 'tonight-mercy-ar-rahman';

function seatClass(active: boolean): string {
  return active
    ? 'border-gold bg-pine text-sand shadow-md'
    : 'border-pine/15 bg-white/80 text-pine';
}

export function RoundtableListen() {
  const { lang, config } = useApp();
  const copy = roundtableCopy(lang);
  const ai = Boolean(config?.ai);
  const [episodeId, setEpisodeId] = useState(FEATURED);
  const [custom, setCustom] = useState<StudioEpisode | null>(null);
  const [topic, setTopic] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<StudioAskAnswer | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);

  const remote = useRemote<StudioEpisode>(
    custom && custom.lang === lang ? null : `/api/studio/roundtable/${encodeURIComponent(episodeId)}?lang=${lang}`,
  );
  const episode = custom && custom.lang === lang ? custom : remote.data?.lang === lang ? remote.data : null;
  const player = useRoundtablePlayer(episode, lang, ai);
  const action = playbackAction(player.phase);
  const seat = activeSeat(player.segment);
  const featured = STUDIO_EPISODE_BLUEPRINTS.find(item => item.id === FEATURED);
  const others = STUDIO_EPISODE_BLUEPRINTS.filter(item => item.id !== FEATURED);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const next = topic.trim();
    if (!next || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await postJson<StudioEpisode>('/api/studio/roundtable', { topic: next, lang });
      setCustom(created);
      setEpisodeId(created.id);
      setAskOpen(false);
      setAnswer(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'The roundtable could not be prepared.');
    } finally {
      setCreating(false);
    }
  }

  function chooseEpisode(id: string) {
    setCustom(null);
    setEpisodeId(id);
    setAskOpen(false);
    setAnswer(null);
    setSourcesOpen(false);
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    if (!episode || !question.trim() || asking) return;
    player.pauseForAsk();
    setAsking(true);
    setAskError(null);
    try {
      const result = await postJson<StudioAskAnswer>('/api/studio/ask', {
        episodeId: episode.id,
        segmentId: player.segment?.id,
        question: question.trim(),
        lang,
      });
      setAnswer(result);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'The question could not be answered.');
    } finally {
      setAsking(false);
    }
  }

  const statusLabel =
    player.phase === 'preparing'
      ? copy.preparing
      : player.phase === 'buffering'
        ? copy.buffering
        : player.phase === 'playing'
          ? copy.playing
          : player.phase === 'paused'
            ? copy.paused
            : player.phase === 'ended'
              ? copy.ended
              : player.phase === 'error'
                ? 'Error'
                : copy.play;

  return (
    <div className="pb-36">
      <section className="overflow-hidden rounded-[2rem] border border-gold/50 bg-gradient-to-b from-emerald-950 via-pine to-emerald-900 text-sand shadow-lg">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Dragon Dawwa Roundtable</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-5xl">
            {episode?.title ?? featured?.titles[lang] ?? 'Tonight at Dragon Dawwa'}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-sand/90">{copy.benefit}</p>
          <p className="mt-2 max-w-2xl text-sm text-gold/90">{copy.disclosure}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-lg">
            <Seat name={ROUNDTABLE_HOST.name} role={ROUNDTABLE_HOST.role} active={seat === 'host'} />
            <Seat name={ROUNDTABLE_COMPANION.name} role={ROUNDTABLE_COMPANION.role} active={seat === 'companion'} />
            <Seat name="Original recitation" role="Not a generated voice" active={seat === 'recitation'} />
            <Seat name="Published meaning" role="Edition audio, not our words" active={seat === 'meaning' || seat === 'talk'} />
          </div>
        </div>
      </section>

      {custom && custom.lang !== lang && (
        <div className="mt-4">
          <ErrorNote message={`This roundtable was prepared in ${custom.lang.toUpperCase()}. It was not substituted into ${lang.toUpperCase()}.`} />
        </div>
      )}
      {remote.loading && !episode && <div className="mt-6"><Loading /></div>}
      {remote.error && !episode && <div className="mt-6"><ErrorNote message={remote.error} /></div>}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <button type="button" className="font-semibold text-pine underline" onClick={() => setAskOpen(open => !open)}>
          Ask about this
        </button>
        <button type="button" className="font-semibold text-pine underline" onClick={() => setSourcesOpen(open => !open)}>
          Sources
        </button>
        <button type="button" className="font-semibold text-pine underline" onClick={() => setChaptersOpen(open => !open)}>
          Transcript
        </button>
      </div>

      {askOpen && episode && (
        <form onSubmit={onAsk} className="mt-4 rounded-3xl border border-pine/15 bg-white p-4">
          <p className="text-sm text-ink/70">Playback stays paused. Play on the bar resumes at the same moment.</p>
          <label className="mt-3 block text-sm font-semibold text-pine" htmlFor="roundtable-ask">
            Ask about this
          </label>
          <textarea
            id="roundtable-ask"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder={copy.askPlaceholder}
            className="mt-2 min-h-24 w-full rounded-2xl border border-pine/20 p-3 text-sm"
          />
          <button type="submit" disabled={asking} className="mt-3 min-h-11 rounded-full bg-pine px-4 text-sm font-semibold text-sand">
            {asking ? 'Looking at the sources…' : 'Ask'}
          </button>
          {askError && <div className="mt-3"><ErrorNote message={askError} /></div>}
          {answer && (
            <div className="mt-4 space-y-3 text-sm" lang={answer.lang}>
              <p className="text-xs font-semibold uppercase tracking-wide text-pine">{answer.note}</p>
              {answer.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph.text} {paragraph.citations.length > 0 && <span className="text-pine">({paragraph.citations.join(', ')})</span>}</p>
              ))}
              {answer.voiceBlocker && <p className="text-ink/70">{answer.voiceBlocker}</p>}
            </div>
          )}
        </form>
      )}

      {sourcesOpen && episode && (
        <div className="mt-4">
          <SourceReaderPanel
            references={episode.references}
            selectedId={sourceId}
            onSelectId={setSourceId}
            gaps={episode.gaps}
            disagreements={episode.disagreements}
            onClose={() => setSourcesOpen(false)}
          />
          <ul className="mt-3 space-y-2 text-sm">
            {episode.references.map(ref => (
              <li key={ref.id}>
                <a className="font-semibold text-pine underline" href={internalReaderRouteForReference(ref)}>
                  Read {ref.locator} inside Dragon Dawwa
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chaptersOpen && episode && (
        <ol className="mt-4 space-y-3">
          {episode.segments.map(segment => (
            <li key={segment.id} className={`rounded-2xl border p-3 text-sm ${segment.id === player.segment?.id ? 'border-gold bg-gold/10' : 'border-pine/10 bg-white'}`} lang={segment.sourceLanguage === 'ar' ? 'ar' : lang}>
              <p className="text-xs font-semibold uppercase tracking-wide text-pine">{segment.speakerName} · {segment.sectionLabel}</p>
              <p className="mt-1">{segment.text}</p>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <article className="rounded-3xl border border-pine/10 bg-parchment p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">Listen</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-pine">{featured?.titles[lang]}</h2>
          <p className="mt-2 text-sm text-ink/80">{copy.benefit}</p>
          <p className="mt-3 text-sm text-ink/70">Press Play. It is the only playback control.</p>
          <ul className="mt-6 space-y-3">
            {others.map(item => (
              <li key={item.id}>
                <button type="button" className="text-left text-sm font-semibold text-pine underline" onClick={() => chooseEpisode(item.id)}>
                  Also available: {item.titles[lang]}
                </button>
              </li>
            ))}
          </ul>
        </article>
        <form onSubmit={onCreate} className="rounded-3xl border border-gold/40 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">Make a roundtable</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-pine">From a topic</h2>
          <p className="mt-2 text-sm text-ink/75">We research the topic and draft a conversation. It is not published.</p>
          <label className="mt-4 block text-sm font-semibold text-pine" htmlFor="roundtable-topic">Topic</label>
          <input
            id="roundtable-topic"
            value={topic}
            onChange={event => setTopic(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-pine/20 px-3 py-3 text-sm"
          />
          <button type="submit" disabled={creating} className="mt-3 min-h-11 rounded-full border border-pine px-4 text-sm font-semibold text-pine">
            {creating ? 'Researching…' : 'Create roundtable'}
          </button>
          {createError && <div className="mt-3"><ErrorNote message={createError} /></div>}
        </form>
      </section>

      <p className="mt-8 text-xs text-ink/50">
        <a className="underline" href="#/studio/desk">Editorial desk</a>
      </p>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-gold/50 bg-ivory px-4 py-3 shadow-[0_-8px_30px_rgba(20,40,30,0.12)] sm:px-8 lg:bottom-0" style={{ background: '#f7f3e8' }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            type="button"
            data-testid="roundtable-play"
            aria-label={action === 'pause' ? copy.pause : action === 'retry' ? copy.retry : copy.play}
            onClick={player.toggle}
            disabled={!episode}
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine text-sand disabled:opacity-50"
          >
            {action === 'pause' ? <Pause className="h-6 w-6" /> : action === 'retry' ? <RotateCcw className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-pine" aria-live="polite">
              {statusLabel}
              {player.segment ? ` · ${player.segment.speakerName}` : ''}
              {episode ? ` · ${player.segmentIndex + 1} of ${episode.segments.length}` : ''}
            </p>
            <label className="mt-1 block text-xs text-ink/70" htmlFor="roundtable-seek">
              {formatClock(player.offsetSeconds)}
              {player.duration != null ? ` / ${formatClock(player.duration)}` : ''}
            </label>
            <input
              id="roundtable-seek"
              type="range"
              min={0}
              max={player.duration ?? 0}
              step={0.1}
              value={Math.min(player.offsetSeconds, player.duration ?? 0)}
              disabled={player.duration == null}
              onChange={event => player.seek(Number(event.target.value))}
              className="mt-1 w-full accent-pine"
            />
            {player.error && <p className="mt-1 text-xs text-pine">{player.error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Seat({ name, role, active }: { name: string; role: string; active: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${seatClass(active)}`}>
      <p className="text-sm font-semibold">{name}</p>
      <p className={`text-xs ${active ? 'text-sand/80' : 'text-ink/60'}`}>{role}</p>
    </div>
  );
}
