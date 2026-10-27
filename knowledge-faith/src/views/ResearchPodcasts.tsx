import { useEffect, useState, type ReactNode } from 'react';
import type { ResearchJobResponse } from '../shared/contracts/v1.ts';
import { buildReportModel, renderReportHtml } from '../shared/research/report.ts';
import { prependEpisodeRevision } from '../shared/research/episodeRevision.ts';
import { roundtableFromResearch, scriptMayBeSpoken, type RoundtableScript } from '../shared/research/roundtable.ts';
import { separateQuestions } from '../shared/research/questions.ts';
import type { Lang } from '../shared/sources.ts';
import { getJson, postJson, useRemote } from '../lib/api.ts';
import { decodeBase64, downloadBytes, readResponseBytes } from '../lib/episodeWav.ts';
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
  sources?: string[];
  reportHtml: string;
  state: EpisodeState;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
  shared?: boolean;
  revision?: number;
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

function voiceFor(speaker: string): string {
  if (/feroz|generated host|^host\b/i.test(speaker)) return 'Puck';
  if (/layla|passage reader/i.test(speaker)) return 'Kore';
  if (/tariq/i.test(speaker)) return 'Fenrir';
  if (/imran/i.test(speaker)) return 'Orus';
  if (/zainab|distinction/i.test(speaker)) return 'Zephyr';
  if (/yusuf/i.test(speaker)) return 'Fenrir';
  if (/amina|deep research/i.test(speaker)) return 'Aoede';
  return 'Kore';
}

/** One episode, several generated voices. Each clip is a standard 16-bit mono WAV. */
function concatWavBase64(parts: string[]): string {
  const pcms: Uint8Array[] = [];
  let rate = 24000;
  for (const part of parts) {
    const bytes = Uint8Array.from(atob(part), char => char.charCodeAt(0));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const clipRate = view.getUint32(24, true);
    if (clipRate) rate = clipRate;
    const size = view.getUint32(40, true);
    pcms.push(bytes.subarray(44, 44 + size));
  }
  const gap = new Uint8Array(Math.floor(rate * 0.4) * 2);
  const body = pcms.reduce((total, pcm) => total + pcm.length + gap.length, 0) - gap.length;
  const out = new Uint8Array(44 + body);
  const header = new DataView(out.buffer);
  const mark = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) header.setUint8(offset + i, text.charCodeAt(i));
  };
  mark(0, 'RIFF');
  header.setUint32(4, 36 + body, true);
  mark(8, 'WAVE');
  mark(12, 'fmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, rate, true);
  header.setUint32(28, rate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  mark(36, 'data');
  header.setUint32(40, body, true);
  let offset = 44;
  pcms.forEach((pcm, index) => {
    out.set(pcm, offset);
    offset += pcm.length;
    if (index < pcms.length - 1) {
      out.set(gap, offset);
      offset += gap.length;
    }
  });
  let binary = '';
  for (let i = 0; i < out.length; i += 0x8000) {
    binary += String.fromCharCode(...out.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function readEpisodes(): LocalEpisode[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as LocalEpisode[];
    return Array.isArray(parsed)
      ? parsed
          .filter(item => scriptMayBeSpoken(item.lines ?? [], item.question ?? ''))
          .map(item => (item.state === 'audio-generating' ? { ...item, state: 'failed' as const, error: item.error || 'Audio generation was interrupted.' } : item))
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
  const [download, setDownload] = useState<{ id: string; percent: number } | null>(null);

  useEffect(() => {
    setMine(readEpisodes());
    let active = true;
    getJson<{ episodes: { id: string }[] }>('/api/research/episodes')
      .then(async data => {
        const restored = await Promise.all(
          data.episodes.map(async episode => {
            const full = await getJson<LocalEpisode & { audioBase64?: string }>(`/api/research/episodes/${episode.id}`).catch(() => null);
            if (!full) return null;
            return {
              ...full,
              participants: full.participants ?? [],
              state: full.audioBase64 ? ('playable' as const) : ('script-ready' as const),
            };
          }),
        );
        const savedEpisodes = restored.flatMap(item => (item ? [item] : []));
        if (!active) return;
        setMine(current => {
          const known = new Set(current.map(item => item.id));
          const extras = savedEpisodes.filter(item => !known.has(item.id) && scriptMayBeSpoken(item.lines ?? [], item.question ?? ''));
          const merged = current.map(item => {
            const saved = savedEpisodes.find(candidate => candidate.id === item.id);
            if (!saved?.audioBase64 || item.audioBase64) return item;
            return { ...item, audioBase64: saved.audioBase64, mimeType: saved.mimeType || item.mimeType, state: 'playable' as const };
          });
          return extras.length ? [...extras, ...merged] : merged;
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!jobId || readEpisodes().some(item => item.jobId === jobId)) return;
    const response = remote.data?.job.status === 'done'
      ? remote.data
      : readResearchHistory().find(item => item.id === jobId)?.response;
    if (response?.job.status === 'error' || response?.job.status === 'cancelled') {
      setError('This research did not finish, so no episode was made from its status messages.');
      return;
    }
    if (!response?.dossier || response.job.status !== 'done') return;
    if (separateQuestions(response.job.question).length !== 1) {
      setError('This record joined more than one question. Ask each question on its own before making an episode.');
      return;
    }
    if (!response.dossier.passages.length) {
      setError('No retrieved passage was kept, so a roundtable was not written.');
      return;
    }
    const created = episodeFromJob(response);
    if (!created) {
      setError('The dossier did not produce a spoken script, so no episode was written.');
      return;
    }
    setMine(current => {
      if (current.some(item => item.jobId === response.job.id && item.audioBase64)) return current;
      if (current.some(item => item.jobId === response.job.id)) return current;
      const next = [created, ...current];
      writeEpisodes(next);
      return next;
    });
  }, [jobId, remote.data]);

  useEffect(() => {
    if (remote.data?.job.parallel?.status !== 'running') return;
    const timer = window.setInterval(() => remote.reload(), 2000);
    return () => window.clearInterval(timer);
  }, [remote.data?.job.parallel?.status, remote.reload]);

  useEffect(() => {
    const response = remote.data;
    const revisionNumber = response?.job.parallel?.revision ?? 1;
    if (!response || response.job.status !== 'done' || response.job.parallel?.status !== 'completed' || revisionNumber < 2) return;
    const created = episodeFromJob(response);
    if (!created) return;
    setMine(current => {
      const base = current.length ? current : readEpisodes();
      const existing = base.find(item => item.jobId === response.job.id && !item.id.includes('-r'));
      if (!existing) return current;
      const node = document.querySelector(`audio[data-episode="${existing.id}"]`) as HTMLAudioElement | null;
      const playing = Boolean(node && !node.paused && !node.ended);
      const merged = prependEpisodeRevision({
        episodes: base,
        created: { ...created, id: existing.id },
        playingEpisodeId: playing ? existing.id : null,
        revision: revisionNumber,
      });
      if (!merged.changed) return current;
      writeEpisodes(merged.episodes);
      return merged.episodes;
    });
  }, [remote.data]);

  function save(next: LocalEpisode[]) {
    writeEpisodes(next);
    setMine(next);
    for (const episode of next) {
      if (!episode.lines.length || episode.state === 'audio-generating') continue;
      void postJson('/api/research/episodes', {
        id: episode.id,
        jobId: episode.jobId,
        question: episode.question,
        language: episode.language,
        participants: episode.participants,
        lines: episode.lines,
        sources: episode.sources ?? [],
        reportHtml: episode.reportHtml,
        mimeType: episode.mimeType,
        audioBase64: episode.audioBase64,
      }).catch(() => undefined);
    }
  }

  function episodeFromJob(response: ResearchJobResponse): LocalEpisode | null {
    const job = response.job;
    const dossier = response.dossier;
    if (job.status !== 'done' || job.investigation === 'blocked' || !dossier?.passages.length) return null;
    const model = buildReportModel(job, dossier);
    const script = roundtableFromResearch({
      question: job.question,
      language: job.language,
      agents: job.agents ?? [],
      answer: model.answer,
      passages: dossier.passages.map(passage => ({
        locator: passage.locator,
        text: passage.text,
        context: passage.context,
        provider: passage.source.provider,
      })),
      insufficientEvidence: dossier.answer?.insufficientEvidence === true,
      unresolved: (job.materialParts ?? []).filter(part => part.status === 'unresolved').map(part => part.note),
      status: job.status,
      investigation: job.investigation,
    });
    if (!script) return null;
    return {
      id: `pod-${job.id}`,
      jobId: job.id,
      question: script.question,
      language: job.language,
      participants: script.participants,
      lines: script.lines,
      sources: script.sources,
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
      setError('The dossier did not produce a spoken script, so no episode was written.');
      return;
    }
    save([created, ...mine]);
  }

  async function savedAudio(episode: LocalEpisode): Promise<{ audioBase64: string; mimeType: string } | null> {
    if (episode.audioBase64) return { audioBase64: episode.audioBase64, mimeType: episode.mimeType || 'audio/wav' };
    const saved = await getJson<LocalEpisode & { audioBase64?: string }>(`/api/research/episodes/${episode.id}`).catch(() => null);
    if (!saved?.audioBase64) return null;
    const ready = { audioBase64: saved.audioBase64, mimeType: saved.mimeType || 'audio/wav' };
    setMine(current => current.map(item => (item.id === episode.id ? { ...item, ...ready, state: 'playable' as const, error: undefined } : item)));
    return ready;
  }

  async function generate(episode: LocalEpisode, onProgress?: (percent: number) => void): Promise<{ audioBase64: string; mimeType: string } | null> {
    const kept = await savedAudio(episode);
    if (kept) return kept;
    if (!scriptMayBeSpoken(episode.lines, episode.question)) {
      save(readEpisodes().map(item => (item.id === episode.id ? { ...item, state: 'failed', error: 'This script is not safe to speak.' } : item)));
      return null;
    }
    const current = readEpisodes().map(item => (item.id === episode.id ? { ...item, state: 'audio-generating' as const, error: undefined } : item));
    save(current);
    try {
      const clips: string[] = [];
      for (let index = 0; index < episode.lines.length; index += 1) {
        const line = episode.lines[index];
        const response = await fetch('/api/voice/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: line.text,
            lang: episode.language,
            voice: voiceFor(line.speaker),
            style: 'Calm and clear',
          }),
        });
        const bytes = await readResponseBytes(response, (loaded, total) => {
          const fraction = total > 0 ? Math.min(1, loaded / total) : 0;
          onProgress?.(Math.min(99, Math.round(((index + fraction) / episode.lines.length) * 100)));
        });
        const audio = JSON.parse(new TextDecoder().decode(bytes)) as { audioBase64?: string; mimeType?: string; error?: string };
        if (!response.ok || !audio.audioBase64) throw new Error(audio.error || 'Audio failed.');
        clips.push(audio.audioBase64);
        onProgress?.(Math.min(99, Math.round(((index + 1) / episode.lines.length) * 100)));
      }
      const ready = { audioBase64: concatWavBase64(clips), mimeType: 'audio/wav' };
      save(readEpisodes().map(item => (item.id === episode.id ? { ...item, state: 'playable', audioBase64: ready.audioBase64, mimeType: ready.mimeType, error: undefined } : item)));
      onProgress?.(100);
      return ready;
    } catch (err) {
      save(
        readEpisodes().map(item =>
          item.id === episode.id ? { ...item, state: 'failed', error: err instanceof Error ? err.message : 'Audio failed.' } : item,
        ),
      );
      return null;
    }
  }

  async function downloadWav(episode: LocalEpisode) {
    if (download?.id === episode.id) return;
    setError(null);
    setDownload({ id: episode.id, percent: 0 });
    try {
      const ready = (await savedAudio(episode)) ?? (await generate(episode, percent => setDownload({ id: episode.id, percent })));
      if (!ready?.audioBase64) return;
      const bytes = decodeBase64(ready.audioBase64);
      const step = 256 * 1024;
      for (let offset = 0; offset < bytes.length; offset += step) {
        setDownload({ id: episode.id, percent: Math.min(100, Math.round((Math.min(offset + step, bytes.length) / bytes.length) * 100)) });
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      }
      const slug = episode.question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'episode';
      downloadBytes(bytes, `${slug}.wav`, 'audio/wav');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The episode audio could not be downloaded.');
    } finally {
      setDownload(null);
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
              episodeId={episode.id}
              question={episode.question}
              language={episode.language}
              participants={episode.participants}
              lines={episode.lines}
              sources={episode.sources}
              reportHtml={episode.reportHtml}
              stateLabel={stateLabel(episode.state, t)}
              state={episode.state}
              error={episode.error}
              audioBase64={episode.audioBase64}
              mimeType={episode.mimeType}
              downloadPercent={download?.id === episode.id ? download.percent : null}
              actions={
                <div className="flex flex-wrap gap-2">
                  {episode.state !== 'audio-generating' && episode.state !== 'playable' && (
                    <Button type="button" onClick={() => void generate(episode)}>{t.generateAudio}</Button>
                  )}
                  <Button
                    type="button"
                    data-testid="download-research-wav"
                    onClick={() => void downloadWav(episode)}
                    disabled={download?.id === episode.id || episode.state === 'audio-generating'}
                  >
                    Download .WAV
                  </Button>
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
              episodeId={episode.id}
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
  episodeId,
  question,
  language,
  participants,
  lines,
  sources = [],
  reportHtml,
  stateLabel: label,
  state,
  error,
  audioBase64,
  mimeType,
  downloadPercent = null,
  actions,
}: {
  episodeId: string;
  question: string;
  language: string;
  participants: RoundtableScript['participants'];
  lines: RoundtableScript['lines'];
  sources?: string[];
  reportHtml: string;
  stateLabel: string;
  state: EpisodeState;
  error?: string;
  audioBase64?: string;
  mimeType?: string;
  downloadPercent?: number | null;
  actions?: ReactNode;
}) {
  const [showReport, setShowReport] = useState(false);
  return (
    <article className="rounded-3xl border border-pine/10 bg-parchment p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <h3 className="mt-2 font-display text-2xl font-bold text-pine">{question}</h3>
      <p className="mt-1 text-sm text-ink/70">Generated presenters. They are not scholars.</p>
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
        <audio data-episode={episodeId} className="mt-3 w-full" controls src={`data:${mimeType || 'audio/wav'};base64,${audioBase64}`} />
      )}
      {downloadPercent !== null && (
        <div className="mt-3" data-testid="research-wav-progress">
          <div className="mb-1 flex items-center justify-between text-xs text-pine">
            <span>Preparing .WAV</span>
            <span>{downloadPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-pine/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={downloadPercent} aria-label="Episode download">
            <div className="h-full bg-pine" style={{ width: `${downloadPercent}%` }} />
          </div>
        </div>
      )}
      <div className="mt-4 space-y-2 text-sm leading-relaxed">
        {lines.map((line, index) => (
          <p key={`${line.speaker}-${index}`}>
            <span className="font-semibold text-pine">{line.speaker}. </span>
            {line.text}
          </p>
        ))}
      </div>
      <section className="mt-4">
        <h4 className="font-display text-lg font-bold text-pine">Sources</h4>
        <p className="mt-1 text-sm text-ink/60">Research language: {language}. These citations are not read aloud.</p>
        {sources.length === 0 && <p className="mt-2 text-sm text-muted">The full report holds the citation list.</p>}
        <ul className="mt-2 space-y-1 text-sm">
          {sources.map(source => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      </section>
      {actions && <div className="mt-4">{actions}</div>}
      <button type="button" className="mt-4 text-sm font-medium text-pine" onClick={() => setShowReport(open => !open)}>
        {showReport ? 'Hide full report' : 'Full report'}
      </button>
      {showReport && <iframe title={question} className="mt-3 h-[32rem] w-full rounded-2xl border border-pine/10 bg-white" srcDoc={reportHtml} />}
    </article>
  );
}
