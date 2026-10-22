import type { Lang } from '../../shared/sources.ts';
import type {
  ClaimEvidence,
  CoverageNote,
  EvidencePassage,
  ResearchJobResponse,
} from '../../shared/contracts/v1.ts';
import type { ResearchReference } from '../../shared/research.ts';
import type { PilotGap } from '../../shared/pilot.ts';
import { jobReadyForScript, passageMatchesLanguage } from '../../shared/studio/jobReadiness.ts';
import { UpstreamError } from '../http.ts';
import { cancelSharedResearchJob, getSharedResearchJob, startSharedResearchJob } from '../research/jobs.ts';
import type { ResearchPorts } from '../research/engine.ts';

export { jobReadyForScript, passageMatchesLanguage };

export async function waitForSharedResearchJob(
  question: string,
  lang: Lang,
  signal?: AbortSignal,
  ports?: ResearchPorts,
): Promise<ResearchJobResponse> {
  if (signal?.aborted) throw new UpstreamError('The research job was cancelled.', 499);
  const id = startSharedResearchJob(question, lang, ports);
  const started = Date.now();
  while (Date.now() - started < 25_000) {
    if (signal?.aborted) {
      cancelSharedResearchJob(id);
      throw new UpstreamError('The research job was cancelled.', 499);
    }
    const snap = getSharedResearchJob(id);
    if (!snap) throw new UpstreamError('Unknown research job', 404);
    if (snap.job.status === 'running' || snap.job.status === 'queued') {
      await pause(40);
      continue;
    }
    if (snap.job.status === 'cancelled') throw new UpstreamError('The research job was cancelled.', 499);
    if (snap.job.status === 'error') {
      throw new UpstreamError(snap.job.errors.at(-1)?.message ?? 'Research failed.', 502);
    }
    if (!snap.dossier) throw new UpstreamError('The research job finished without a dossier.', 502);
    return snap;
  }
  cancelSharedResearchJob(id);
  throw new UpstreamError('The research job timed out before a dossier was ready.', 504);
}

export function loadCompletedResearchJob(id: string): ResearchJobResponse {
  const snap = getSharedResearchJob(id);
  if (!snap) throw new UpstreamError('Unknown research job', 404);
  if (snap.job.status === 'cancelled') throw new UpstreamError('The research job was cancelled.', 499);
  if (snap.job.status === 'error') throw new UpstreamError(snap.job.errors.at(-1)?.message ?? 'Research failed.', 502);
  if (!jobReadyForScript(snap)) {
    const finishedWithoutDossier = snap.job.status === 'done' && snap.dossier === null;
    throw new UpstreamError(
      finishedWithoutDossier
        ? 'The research job finished without a dossier.'
        : `Research is still ${snap.job.progress.step}. The dossier is not ready.`,
      finishedWithoutDossier ? 502 : 409,
    );
  }
  return snap;
}

export function referencesFromJob(response: ResearchJobResponse, requested: Lang): {
  references: ResearchReference[];
  gaps: PilotGap[];
  disagreements: string[];
  claims: ClaimEvidence[];
  coverage: CoverageNote[];
} {
  const dossier = response.dossier;
  const coverage = response.job.coverage;
  const gaps: PilotGap[] = coverage
    .filter(note => note.kind !== 'evidence_found')
    .map(note => ({ source: note.provider, message: `${note.kind.replaceAll('_', ' ')}: ${note.detail}` }));
  const claims = dossier?.claims ?? [];
  const disagreements = dossier?.disagreements ?? [];
  const references: ResearchReference[] = [];
  for (const passage of dossier?.passages ?? []) {
    const reference = toReference(passage, claims, requested);
    if (reference) references.push(reference);
    else {
      gaps.push({
        source: passage.source.provider,
        message: `${passage.source.provider} ${passage.source.id} was requested in ${requested}, and the opened text is not in that language. It was not copied into the script.`,
      });
    }
  }
  for (const claim of claims) {
    if (claim.support !== 'supported') {
      gaps.push({ source: 'Claim check', message: `${claim.support}: ${claim.claim} — ${claim.note}` });
    }
  }
  return { references, gaps, disagreements, claims, coverage };
}

function toReference(passage: EvidencePassage, claims: ClaimEvidence[], requested: Lang): ResearchReference | null {
  const provider = passage.source.provider;
  if (provider !== 'HadeethEnc' && provider !== 'QuranEnc' && provider !== 'IslamHouse') return null;
  if (!passageMatchesLanguage(passage.text, requested)) return null;
  const located = locate(passage);
  const claim = claims.find(item => item.passageIds.includes(passage.id));
  const grade = passage.publishedGrade;
  return {
    id: passage.id,
    provider,
    itemId: passage.source.id,
    title: passage.source.title,
    authors: passage.source.credits.filter(item => item.role === 'author').map(item => item.name).filter((name): name is string => Boolean(name)),
    translators: passage.source.credits.filter(item => item.role === 'translator').map(item => item.name).filter((name): name is string => Boolean(name)),
    version: passage.source.version,
    passage: passage.text,
    passageLanguage: requested,
    arabic: passage.arabic,
    locator: passage.locator,
    printedPage: null,
    pdfPage: null,
    surah: located.surah,
    ayah: located.ayah,
    hadithId: provider === 'HadeethEnc' ? passage.source.id : null,
    collection: provider === 'HadeethEnc' ? passage.locator : null,
    grade,
    url: passage.source.canonicalUrl,
    retrievedOn: passage.source.retrievedAt,
    claim: claim?.claim ?? `Retrieved ${provider} ${passage.source.id}.`,
    limitations: [
      provider === 'HadeethEnc'
        ? grade
          ? `Published grade: ${grade}`
          : 'HadeethEnc did not include a grade for this hadith.'
        : '',
      passage.context ?? '',
      claim ? `Claim check ${claim.support}: ${claim.note}` : '',
      passage.readerRoute ? `Reader: ${passage.readerRoute}` : '',
    ].filter(Boolean),
  };
}

function locate(passage: EvidencePassage): { surah: number | null; ayah: number | null } {
  const route = passage.readerRoute ?? '';
  const match = route.match(/#\/quran\/(\d+)/);
  const ayah = route.match(/[?&]ayah=(\d+)/);
  if (!match) return { surah: null, ayah: null };
  return { surah: Number(match[1]), ayah: ayah ? Number(ayah[1]) : null };
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
