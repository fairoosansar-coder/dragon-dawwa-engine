import { useEffect, useState, type ReactNode } from 'react';
import type { ResearchJobResponse } from '../shared/contracts/v1.ts';
import { buildReportModel, renderReportHtml } from '../shared/research/report.ts';
import { roundtableFromResearch, type RoundtableScript } from '../shared/research/roundtable.ts';
import type { Lang } from '../shared/sources.ts';
import { postJson, useRemote } from '../lib/api.ts';
import { readResearchHistory } from '../lib/researchDesk.ts';
import { useApp } from '../lib/store.tsx';
import { Button, ErrorNote, Notice } from '../components/ui.tsx';

type EpisodeState = 'script-ready' | 'audio-generating' | 'playable' | 'failed';

interface LocalEpisode {
  id: string;
  jobId: string;
  question: string;
  language: Lang;
  participants: RoundtableScript['participants'];
  lines: RoundtableScript['lines'];
  reportHtml: string;
  state: EpisodeState;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
  shared?: boolean;
}

interface CommunityEpisode {
  id: string;
  question: string;
  language: string;
  participants: RoundtableScript['participants'];
  lines: RoundtableScript['lines'];
  reportHtml: string;
}

const KEY = 'kf-research-podcasts';

function readEpisodes(): LocalEpisode[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as LocalEpisode[];
    return Array.isArray(parsed)
      ? parsed.map(item => (item.state === 'audio-generating' ? { ...item, state: 'failed', error: item.error || 'Audio generation was interrupted.' } : item))
      : [];
  } catch {
    return [];
  }
}

function writeEpisodes(items: LocalEpisode[]) {
  const slim = items.slice(0, 20).map(item => ({
    ...item,
    audioBase64: undefined,
    mimeType: undefined,
    reportHtml: item.reportHtml.slice(0, 80_000),
    state: item.state === 'audio-generating' || item.state === 'playable' ? 'script-ready' as const : item.state,
  }));
  try {
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify(slim.map(item => ({ ...item, reportHtml: '' }))));
    } catch {
      /* This visit still keeps the episode in memory, including its audio. */
    }
  }
}

function stateLabel(state: EpisodeState, t: { podcastScriptReady: string; podcastGenerating: string; podcastPlayable: string; podcastFailed: string }) {
  if (state === 'script-ready') return t.podcastScriptReady;
  if (state === 'audio-generating') return t.podcastGenerating;
  if (state === 'playable') return t.podcastPlayable;
  return t.podcastFailed;
}

export default function ResearchPodcasts({ params }: { params?: URLSearchParams }) {
  const { t, lang } = useApp();
  const jobId = params?.get('job') ?? '';
  const remote = useRemote<ResearchJobResponse>(jobId ? `/api/research/jobs/${jobId}` : null);
  const community = useRemote<{ episodes: CommunityEpisode[] }>('/api/research/podcasts');
  const [mine, setMine] = useState<LocalEpisode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMine(readEpisodes()), []);

  useEffect(() => {
    if (!jobId || readEpisodes().some(item => item.jobId === jobId)) return;
    const response = remote.data?.job.status === 'done'
      ? remote.data
      : readResearchHistory().find(item => item.id === jobId)?.response;
    if (!response?.dossier || response.job.status !== 'done') return;
    const created = episodeFromJob(response);
    if (!created) {
      setError('No contributing agent was recorded, so a roundtable was not written.');
      return;
    }
    const next = [created, ...readEpisodes()];
    writeEpisodes(next);
    setMine(next);
  }, [jobId, remote.data]);

  function save(next: LocalEpisode[]) {
    writeEpisodes(next);
    setMine(next);
  }

  function episodeFromJob(response: ResearchJobResponse): LocalEpisode | null {
    const job = response.job;
    const script = roundtableFromResearch({ question: job.question, language: job.language, agents: job.agents ?? [] });
    if (!script || !response.dossier) return null;
    const model = buildReportModel(job, response.dossier);
    return {
      id: `pod-${job.id}`,
      jobId: job.id,
      question: job.question,
      language: job.language,
      participants: script.participants,
      lines: script.lines,
      reportHtml: renderReportHtml(model),
      state: 'script-ready',
    };
  }

  function ensureFromJob() {
    const response = remote.data?.job.status === 'done' ? remote.data : readResearchHistory().find(item => item.id === jobId)?.response;
    if (!response?.dossier || response.job.status !== 'done') return;
    if (mine.some(item => item.jobId === response.job.id)) return;
    const created = episodeFromJob(response);
    if (!created) {
      setError('No contributing agent was recorded, so a roundtable was not written.');
      return;
    }
    save([created, ...mine]);
  }

  async function generate(episode: LocalEpisode) {
    const current = readEpisodes().map(item => (item.id === episode.id ? { ...item, state: 'audio-generating' as const, error: undefined } : item));
    save(current);
    const spoken = episode.lines.map(line => `${line.speaker}: ${line.text}`).join('\n\n').slice(0, 2800);
    try {
      const audio = await postJson<{ audioBase64: string; mimeType: string }>('/api/voice/narrate', {
        text: spoken,
        lang: episode.language,
        voice: 'Kore',
        style: 'Calm research roundtable',
      });
      save(readEpisodes().map(item => (item.id === episode.id ? { ...item, state: 'playable', audioBase64: audio.audioBase64, mimeType: audio.mimeType, error: undefined } : item)));
    } catch (err) {
      save(
        readEpisodes().map(item =>
          item.id === episode.id ? { ...item, state: 'failed', error: err instanceof Error ? err.message : 'Audio failed.' } : item,
        ),
      );
    }
  }

  async function share(episode: LocalEpisode) {
    await postJson('/api/research/podcasts', {
      id: episode.id,
      question: episode.question,
      language: episode.language,
      participants: episode.participants,
      lines: episode.lines,
      reportHtml: episode.reportHtml,
      shared: true,
    });
    save(readEpisodes().map(item => (item.id === episode.id ? { ...item, shared: true } : item)));
    community.reload();
  }

  const active = mine.find(item => item.jobId === jobId) ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold text-pine">{t.navPodcast}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/75">{t.podcastPrivate}</p>
      </header>
      {error && <ErrorNote message={error} />}
      {jobId && remote.data?.job.status === 'done' && !active && (
        <Button type="button" onClick={ensureFromJob}>{t.makePodcast}</Button>
      )}
      {remote.error && !mine.some(item => item.jobId === jobId) && <ErrorNote message={remote.error} onRetry={remote.reload} />}

      <section>
        <h2 className="font-display text-2xl font-bold text-pine">{t.myPodcasts}</h2>
        {mine.length === 0 && <p className="mt-2 text-sm text-muted">{t.episodesEmpty}</p>}
        <div className="mt-4 space-y-4">
          {mine.map(episode => (
            <EpisodeCard
              key={episode.id}
              question={episode.question}
              language={episode.language}
              participants={episode.participants}
              lines={episode.lines}
              reportHtml={episode.reportHtml}
              stateLabel={stateLabel(episode.state, t)}
              state={episode.state}
              error={episode.error}
              audioBase64={episode.audioBase64}
              mimeType={episode.mimeType}
              actions={
                <div className="flex flex-wrap gap-2">
                  {episode.state !== 'audio-generating' && episode.state !== 'playable' && (
                    <Button type="button" onClick={() => void generate(episode)}>{t.generateAudio}</Button>
                  )}
                  {!episode.shared && (
                    <Button type="button" variant="soft" onClick={() => void share(episode)}>{t.shareEpisode}</Button>
                  )}
                  {episode.shared && <span className="text-sm text-pine">{t.sharedEpisode}</span>}
                </div>
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold text-pine">{t.communityPodcasts}</h2>
        {community.error && <ErrorNote message={community.error} onRetry={community.reload} />}
        {(community.data?.episodes.length ?? 0) === 0 && <p className="mt-2 text-sm text-muted">{t.communityEmpty}</p>}
        <div className="mt-4 space-y-4">
          {community.data?.episodes.map(episode => (
            <EpisodeCard
              key={episode.id}
              question={episode.question}
              language={episode.language}
              participants={episode.participants}
              lines={episode.lines}
              reportHtml={episode.reportHtml}
              stateLabel={t.podcastScriptReady}
              state="script-ready"
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function EpisodeCard({
  question,
  language,
  participants,
  lines,
  reportHtml,
  stateLabel: label,
  state,
  error,
  audioBase64,
  mimeType,
  actions,
}: {
  question: string;
  language: string;
  participants: RoundtableScript['participants'];
  lines: RoundtableScript['lines'];
  reportHtml: string;
  stateLabel: string;
  state: EpisodeState;
  error?: string;
  audioBase64?: string;
  mimeType?: string;
  actions?: ReactNode;
}) {
  const [showReport, setShowReport] = useState(false);
  return (
    <article className="rounded-3xl border border-pine/10 bg-parchment p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <h3 className="mt-2 font-display text-2xl font-bold text-pine">{question}</h3>
      <p className="mt-1 text-sm text-ink/70">{language}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {participants.map(agent => (
          <li key={agent.id}>
            <span className="font-medium text-pine">{agent.role}</span>
            <span className="text-muted"> · {agent.team}</span>
          </li>
        ))}
      </ul>
      {state === 'audio-generating' && <p className="mt-3 text-sm text-pine">{label}</p>}
      {state === 'failed' && error && <div className="mt-3"><Notice>{error}</Notice></div>}
      {state === 'playable' && audioBase64 && (
        <audio className="mt-3 w-full" controls src={`data:${mimeType || 'audio/wav'};base64,${audioBase64}`} />
      )}
      <div className="mt-4 space-y-2 text-sm leading-relaxed">
        {lines.map((line, index) => (
          <p key={`${line.speaker}-${index}`}>
            <span className="font-semibold text-pine">{line.speaker}. </span>
            {line.text}
          </p>
        ))}
      </div>
      {actions && <div className="mt-4">{actions}</div>}
      <button type="button" className="mt-4 text-sm font-medium text-pine" onClick={() => setShowReport(open => !open)}>
        {showReport ? 'Hide full report' : 'Full report'}
      </button>
      {showReport && <iframe title={question} className="mt-3 h-[32rem] w-full rounded-2xl border border-pine/10 bg-white" srcDoc={reportHtml} />}
    </article>
  );
}
