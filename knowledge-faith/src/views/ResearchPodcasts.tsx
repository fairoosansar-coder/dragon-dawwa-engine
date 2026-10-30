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
import { PodcastHostChip } from '../components/PodcastHostChip.tsx';
import { ContentText } from '../components/ContentText.tsx';
import { Button, ErrorNote, Notice } from '../components/ui.tsx';
import { getPodcastHostLabel, PODCAST_HOST_EVENT } from '../lib/podcastHost.ts';
import { PodcastPlayer } from './PodcastPlayer.tsx';

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

function voiceFor(speaker: string, hostName: string): string {
  if (speaker === hostName || /feroz|^host\b/i.test(speaker)) return 'Puck';
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

function stateLabel(state: EpisodeState) {
  if (state === 'script-ready') return 'Script ready';
  if (state === 'audio-generating') return 'Generating audio';
  if (state === 'playable') return 'Ready to play';
  return 'Audio failed';
}

export default function ResearchPodcasts({ params }: { params?: URLSearchParams }) {
  const jobId = params?.get('job') ?? '';
  const remote = useRemote<ResearchJobResponse>(jobId ? `/api/research/jobs/${jobId}` : null);
  const community = useRemote<{ episodes: CommunityEpisode[] }>('/api/research/podcasts');
  const [mine, setMine] = useState<LocalEpisode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<{ id: string; percent: number } | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [hostLabel, setHostLabel] = useState(getPodcastHostLabel);

  useEffect(() => {
    const sync = () => setHostLabel(getPodcastHostLabel());
    window.addEventListener(PODCAST_HOST_EVENT, sync);
    return () => window.removeEventListener(PODCAST_HOST_EVENT, sync);
  }, []);

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
    let active = true;
    void scriptForJob(response).then(created => {
      if (!active) return;
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
    });
    return () => {
      active = false;
    };
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
    let active = true;
    void scriptForJob(response).then(created => {
      if (!active || !created) return;
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
    });
    return () => {
      active = false;
    };
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

  function episodeFromScript(response: ResearchJobResponse, script: RoundtableScript): LocalEpisode {
    const model = buildReportModel(response.job, response.dossier!);
    return {
      id: `pod-${response.job.id}`,
      jobId: response.job.id,
      question: script.question,
      language: response.job.language,
      participants: script.participants,
      lines: script.lines,
      sources: script.sources,
      reportHtml: renderReportHtml(model),
      state: 'script-ready',
    };
  }

  function localScript(response: ResearchJobResponse, hostName: string): RoundtableScript | null {
    const job = response.job;
    const dossier = response.dossier;
    if (job.status !== 'done' || job.investigation === 'blocked' || !dossier?.passages.length) return null;
    const model = buildReportModel(job, dossier);
    return roundtableFromResearch({
      question: job.question,
      language: job.language,
      agents: job.agents ?? [],
      answer: model.answer,
      passages: dossier.passages.map(passage => ({
        locator: passage.locator,
        text: passage.text,
        context: passage.context,
        provider: passage.source.provider,
        role: passage.role,
      })),
      disagreements: dossier.disagreements,
      insufficientEvidence: dossier.answer?.insufficientEvidence === true,
      unresolved: (job.materialParts ?? []).filter(part => part.status === 'unresolved').map(part => part.note),
      status: job.status,
      investigation: job.investigation,
      hostName,
    });
  }

  async function scriptForJob(response: ResearchJobResponse): Promise<LocalEpisode | null> {
    const hostName = getPodcastHostLabel();
    const local = localScript(response, hostName);
    try {
      const remoteScript = await postJson<{ script?: RoundtableScript }>('/api/podcast/generate', { jobId: response.job.id, hostName });
      if (remoteScript.script && scriptMayBeSpoken(remoteScript.script.lines, remoteScript.script.question || response.job.question)) {
        return episodeFromScript(response, remoteScript.script);
      }
    } catch {
      /* The dossier on this device still writes the episode. */
    }
    return local ? episodeFromScript(response, local) : null;
  }

  function ensureFromJob() {
    const response = remote.data?.job.status === 'done' ? remote.data : readResearchHistory().find(item => item.id === jobId)?.response;
    if (!response?.dossier || response.job.status !== 'done') return;
    if (mine.some(item => item.jobId === response.job.id)) return;
    void scriptForJob(response).then(created => {
      if (!created) {
        setError('The dossier did not produce a spoken script, so no episode was written.');
        return;
      }
      save([created, ...mine]);
    });
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
            voice: voiceFor(line.speaker, episode.lines[0]?.speaker || getPodcastHostLabel()),
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
  const stage = mine.find(item => item.id === pickedId) ?? active ?? mine[0] ?? null;

  return (
    <div data-podcast-desk className="min-w-0 space-y-8">
      <header data-podcast-hero className="relative min-w-0">
        <div className="podcast-plate pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem] border border-[#D4AF37]/45 bg-[#064936] shadow-[0_18px_40px_-28px_rgba(4,27,20,0.9)]">
          <img
            src="/assets/geometric-studio.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#041B14]/88 via-[#041B14]/42 to-transparent" />
          <div className="absolute inset-2.5 rounded-[1.3rem] border border-[#E6C665]/25 sm:inset-3.5" />
        </div>
        <div className="relative max-w-[70%] px-5 py-6 sm:max-w-xl sm:px-8 sm:py-8">
          <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-[#E6C665] sm:text-[11px] sm:tracking-[0.28em]">
            <span className="h-px w-5 shrink-0 bg-[#E6C665] sm:w-7" aria-hidden />
            LISTENING DESK
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-[2.35rem] font-bold leading-none text-[#F9E7B9] sm:text-5xl">Podcast</h1>
            <PodcastHostChip tone="plate" />
          </div>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-stone-200 sm:text-sm">Your questions stay on this device until you share an episode. The presenters are generated. {hostLabel} did not speak these words or approve them. They are not scholars.</p>
        </div>
      </header>
      {error && <ErrorNote message={error} />}
      {jobId && remote.data?.job.status === 'done' && !active && (
        <Button type="button" onClick={ensureFromJob}>Make a roundtable episode</Button>
      )}
      {remote.error && !mine.some(item => item.jobId === jobId) && <ErrorNote message={remote.error} onRetry={remote.reload} />}

      <section className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A7340]">ON THIS DEVICE</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-pine sm:text-3xl">My Research Podcasts</h2>
        <div className="mt-2 h-px w-14 bg-[#C9A14E]" aria-hidden />
        {mine.length === 0 && <p className="mt-3 text-sm leading-relaxed text-muted">No episode is saved on this device yet.</p>}
        {mine.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {mine.map(episode => {
              const selected = stage?.id === episode.id;
              return (
                <button
                  key={episode.id}
                  type="button"
                  title={episode.question}
                  className={`max-w-full break-words rounded-full border px-3.5 py-1.5 text-left text-xs leading-snug sm:max-w-xs ${selected ? 'border-[#C9A14E] bg-[#064936] text-[#F9E7B9] shadow-[0_0_0_1px_rgba(201,161,78,0.4)]' : 'border-[#C9A14E]/70 bg-[#F4ECD8] text-[#064936]'}`}
                  onClick={() => setPickedId(episode.id)}
                >
                  <span className="line-clamp-2">{episode.question}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4 space-y-4">
          {stage && (
            <EpisodeCard
              key={stage.id}
              episodeId={stage.id}
              question={stage.question}
              language={stage.language}
              participants={stage.participants}
              lines={stage.lines}
              sources={stage.sources}
              reportHtml={stage.reportHtml}
              stateLabel={stateLabel(stage.state)}
              state={stage.state}
              error={stage.error}
              hostLabel={hostLabel}
              audioBase64={stage.audioBase64}
              mimeType={stage.mimeType}
              downloadPercent={download?.id === stage.id ? download.percent : null}
              actions={
                <div className="flex flex-wrap gap-2">
                  {stage.state !== 'audio-generating' && stage.state !== 'playable' && (
                    <Button type="button" onClick={() => void generate(stage)}>Generate audio</Button>
                  )}
                  <Button
                    type="button"
                    data-testid="download-research-wav"
                    onClick={() => void downloadWav(stage)}
                    disabled={download?.id === stage.id || stage.state === 'audio-generating'}
                  >
                    Download .WAV
                  </Button>
                  {!stage.shared && (
                    <Button type="button" variant="soft" onClick={() => void share(stage)}>Share with the community</Button>
                  )}
                  {stage.shared && <span className="text-sm text-pine">Shared for the community</span>}
                </div>
              }
            />
          )}
        </div>
      </section>

      <section className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A7340]">SHARED</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-pine sm:text-3xl">Community Podcasts</h2>
        <div className="mt-2 h-px w-14 bg-[#C9A14E]" aria-hidden />
        {community.error && <ErrorNote message={community.error} onRetry={community.reload} />}
        {(community.data?.episodes.length ?? 0) === 0 && <p className="mt-2 text-sm text-muted">No episode has been shared for publication.</p>}
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
              stateLabel="Script ready"
              state="script-ready"
              hostLabel={hostLabel}
              readOnly
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
  hostLabel,
  audioBase64,
  mimeType,
  downloadPercent = null,
  actions,
  readOnly = false,
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
  hostLabel: string;
  audioBase64?: string;
  mimeType?: string;
  downloadPercent?: number | null;
  actions?: ReactNode;
  readOnly?: boolean;
}) {
  const [showReport, setShowReport] = useState(false);
  return (
    <article className="relative min-w-0 overflow-hidden rounded-[1.75rem] border border-[#C9A14E]/50 bg-[#F7F1E4] shadow-[0_16px_36px_-28px_rgba(6,73,54,0.75)]">
      <img
        src="/assets/geometric-cream.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[88%_12%] opacity-80"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#F7F1E4] via-[#F7F1E4]/94 to-[#F7F1E4]/72" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.35rem] border border-[#C9A14E]/28 sm:inset-2.5" />
      <div className="relative min-w-0 p-4 sm:p-6">
      <p className="inline-flex max-w-full items-center rounded-full border border-[#C9A14E]/75 bg-[#F9E7B9]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#064936]">{label}</p>
      <h3 className="mt-3 break-words font-display text-xl font-bold leading-snug text-pine sm:text-2xl"><ContentText text={question} /></h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/75">Generated presenters. {hostLabel} is the studio partner beside the scholars. {hostLabel} did not speak or approve these words. They are not scholars.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {participants.map(agent => (
          <li key={agent.id} className="min-w-0 rounded-2xl border border-[#C9A14E]/55 bg-[#FAF6EC]/90 px-3 py-2.5">
            <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#E6C665]/80 bg-[#064936]" aria-hidden>
              <span className="h-1.5 w-1.5 rotate-45 bg-[#E6C665]" />
            </span>
            <span className="block text-sm font-semibold leading-snug text-[#064936]">{presenterName(agent.role)}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-[#8A7340]">{presenterNote(agent.role, agent.team)}</span>
          </li>
        ))}
      </ul>
      {state === 'audio-generating' && <p className="mt-3 text-sm text-pine">{label}</p>}
      {state === 'failed' && error && <div className="mt-3"><Notice>{error}</Notice></div>}
      {readOnly ? (
        <div className="mt-4 min-w-0 space-y-2 text-sm leading-relaxed">
          {lines.map((line, index) => (
            <p key={`${line.speaker}-${index}`} className="break-words">
              <span className="font-semibold text-pine">{line.speaker}. </span>
              <ContentText text={line.text} />
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <PodcastPlayer episodeId={episodeId} lines={lines} audioBase64={audioBase64} mimeType={mimeType} />
        </div>
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
      <section className="mt-4 min-w-0">
        <h4 className="font-display text-lg font-bold text-pine">Sources</h4>
        <div className="mt-1 h-px w-10 bg-[#C9A14E]" aria-hidden />
        <p className="mt-2 text-sm text-ink/60">Research language: {language}.</p>
        {sources.length === 0 && <p className="mt-2 text-sm text-muted">The full report holds the citation list.</p>}
        <ul className="mt-2 space-y-1 text-sm">
          {sources.map(source => (
            <li key={source} className="break-words">{source}</li>
          ))}
        </ul>
      </section>
      {actions && <div className="mt-4">{actions}</div>}
      <button type="button" className="mt-4 text-sm font-medium text-[#064936] underline decoration-[#C9A14E] decoration-2 underline-offset-4" onClick={() => setShowReport(open => !open)}>
        {showReport ? 'Hide full report' : 'Full report'}
      </button>
      {showReport && <iframe title={question} className="mt-3 h-[32rem] w-full max-w-full rounded-2xl border border-[#C9A14E]/35 bg-white" srcDoc={reportHtml} />}
      </div>
    </article>
  );
}

function presenterName(role: string): string {
  return role.replace(/\s*\([^)]*\)\s*$/, '').trim() || role;
}

function presenterNote(role: string, team: string): string {
  return role.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || team;
}
