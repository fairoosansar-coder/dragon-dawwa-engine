import { randomBytes } from 'node:crypto';
import { buildDynamicDossier } from '../sevenAgentService.ts';
import type { SevenAgentRetrievedPassage } from '../../shared/sevenAgentTypes.ts';
import { OpenPassageGate, defaultGateDbPath } from './accessGate.ts';
import { openPassageEvidence } from './evidence.ts';
import { renderOpenPassageAudio, type OpenPassageAudioMode } from './audio.ts';
import {
  finalizeOpenPassageReport,
  type OpenPassageReport,
  type OpenPassageSource,
} from './reportFormat.ts';

export interface OpenPassageJob {
  id: string;
  time: number;
  state: string;
  sources: OpenPassageSource[];
  result?: OpenPassageReport;
  audio: Partial<Record<OpenPassageAudioMode, Buffer>>;
}

const jobs = new Map<string, OpenPassageJob>();
const startQuota: number[] = [];
let gate: OpenPassageGate | null = null;
let audioLock: Promise<void> = Promise.resolve();

export function getOpenPassageGate(): OpenPassageGate {
  if (!gate) gate = new OpenPassageGate(defaultGateDbPath());
  return gate;
}

export function resetOpenPassageJobsForTests(dbPath?: string): void {
  jobs.clear();
  startQuota.length = 0;
  if (gate) {
    try {
      gate.close();
    } catch {
      /* ignore */
    }
  }
  gate = new OpenPassageGate(dbPath || defaultGateDbPath());
}

function expireJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.time > 3_600_000) jobs.delete(id);
  }
  while (startQuota.length && now - startQuota[0] > 3_600_000) startQuota.shift();
}

function outOfScope(question: string): boolean {
  return (
    /\b(?:predict (?:the |tonight'?s )?(?:football|soccer) score|write (?:me )?(?:a |some )?python code)\b/i.test(
      question,
    ) && !/islam|qur.?an|hadith|muslim/i.test(question)
  );
}

function toRetrieved(passages: OpenPassageSource[]): SevenAgentRetrievedPassage[] {
  return passages.map(passage => ({
    id: passage.id,
    locator: passage.locator,
    text: passage.text,
    provider: passage.provider,
    publishedGrade: passage.publishedGrade ?? null,
    canonicalUrl: passage.canonicalUrl,
  }));
}

async function generate(job: OpenPassageJob, question: string): Promise<void> {
  try {
    const sources = await openPassageEvidence(question);
    job.sources = sources;
    job.state = 'Reviewing opened passages';

    let dossier: Awaited<ReturnType<typeof buildDynamicDossier>> | null = null;
    if (sources.length) {
      dossier = await buildDynamicDossier(question, 'en', toRetrieved(sources));
    }

    const full = dossier?.status === 'live_synthesis' && (dossier.agents?.length ?? 0) === 7;
    const sections = full
      ? dossier!.agents.slice(0, 7).map(agent => ({
          title: agent.title,
          summary: agent.summary,
          points: agent.keyPoints || [],
          citations: agent.citations || [],
        }))
      : [];
    const summary = full
      ? dossier!.executiveSummary
      : sources.length
        ? 'Related passages were found, but a complete seven-role synthesis is unavailable. Read the passages below in context; retrieval alone does not establish an answer.'
        : 'No supporting passage was located in this search. That does not show the claim is false. Try the exact wording or a verse reference.';
    const status = full
      ? 'Seven-role AI research report'
      : sources.length
        ? 'Sources only · no final conclusion'
        : 'Insufficient evidence';

    let turns =
      full && dossier
        ? dossier.roundtableTurns
            .filter(turn => turn.text)
            .map((turn, index) => ({
              speaker: turn.speaker || (index % 2 === 0 ? 'Host' : 'Analyst'),
              text: turn.text,
            }))
        : [];
    if (!turns.length) {
      turns = [
        { speaker: 'Host', text: `What did the research desk find about this question? ${question}` },
        { speaker: 'Analyst', text: summary },
      ];
      if (sources[0]) {
        turns.push(
          { speaker: 'Host', text: 'Which opened passage can listeners check first?' },
          {
            speaker: 'Analyst',
            text: `${sources[0].locator}. The English source reads: ${sources[0].text}`,
          },
        );
      }
    }

    job.result = finalizeOpenPassageReport({
      question,
      status,
      full,
      summary,
      sections,
      sources,
      limit:
        'AI research, not a religious ruling. Check the cited passages in context. Silence in a specialist section is not evidence of consensus.',
      turns,
      reportOrigin: dossier?.reportOrigin,
    });
    job.state = 'ready';
  } catch {
    job.state = 'failed';
  } finally {
    getOpenPassageGate().finish(job.id, Boolean(job.result?.full));
  }
}

export function startOpenPassageJob(token: string, questionRaw: string): { id: string } {
  expireJobs();
  const question = questionRaw.trim();
  if (question.length < 3) {
    throw Object.assign(new Error('Enter a longer question.'), { status: 400 });
  }
  if (outOfScope(question)) {
    throw Object.assign(
      new Error(
        'This desk researches Islam. Try a question about a text, teaching, or claim. Your guest question has not been used.',
      ),
      { status: 422 },
    );
  }
  const active = [...jobs.values()].filter(job => job.state !== 'ready' && job.state !== 'failed').length;
  if (startQuota.length >= 30 || active >= 3) {
    throw Object.assign(new Error('The free research desk is busy. Please try again later.'), {
      status: 429,
    });
  }

  const key = randomBytes(24).toString('base64url');
  const jobsView: Record<string, OpenPassageJob | undefined> = Object.fromEntries(jobs);
  const reserved = getOpenPassageGate().reserve(token, question, key, jobsView);
  if (reserved !== key) return { id: reserved };

  startQuota.push(Date.now());
  const job: OpenPassageJob = {
    id: key,
    time: Date.now(),
    state: 'Opening source passages',
    sources: [],
    audio: {},
  };
  jobs.set(key, job);
  void generate(job, question);
  return { id: key };
}

export function getOpenPassageJob(id: string): OpenPassageJob {
  expireJobs();
  const job = jobs.get(id);
  if (!job) {
    throw Object.assign(new Error('This private reading session has expired.'), { status: 404 });
  }
  return job;
}

export async function openPassageJobAudio(
  id: string,
  mode: OpenPassageAudioMode,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const job = getOpenPassageJob(id);
  if (!job.result || (mode !== 'brief' && mode !== 'podcast')) {
    throw Object.assign(new Error('Report not ready.'), { status: 409 });
  }
  const run = audioLock.then(async () => {
    if (!job.audio[mode]) {
      const rendered = await renderOpenPassageAudio(job.result!, mode);
      job.audio[mode] = rendered.bytes;
      return rendered;
    }
    return { bytes: job.audio[mode]!, mimeType: 'audio/mpeg' };
  });
  audioLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
