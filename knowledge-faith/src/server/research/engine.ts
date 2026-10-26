import { randomUUID } from 'node:crypto';
import type {
  CoverageNote,
  EvidencePassage,
  ClaimEvidence,
  ResearchAnswer,
  ResearchDossierView,
  ResearchJobView,
  ResearchSubquestion,
  SourceRecord,
} from '../../shared/contracts/v1.ts';
import type { Lang } from '../../shared/sources.ts';
import type { Evidence } from '../../shared/types.ts';
import { contentTokens, passageSupportsTopic } from '../../shared/research.ts';
import { verifyClaim } from '../../shared/research/claims.ts';
import { asksScience, decomposeQuestion } from '../../shared/research/decompose.ts';
import {
  acceptedCampaign,
  capOccurrences,
  corpusPassageContext,
  distinctWordings,
  fallbackWordings,
  formatCorpusCount,
  groupCampaigns,
  occurrenceContext,
  wordingInText,
  type CampaignGroup,
  type WordingOccurrence,
} from '../../shared/research/counts.ts';
import { interpretQuestion, type QuestionInterpretation } from '../../shared/research/scopes.ts';
import { ayahsMentioned } from '../../shared/research.ts';
import { ISLAMHOUSE_RIGHTS } from '../../shared/sourceRegistry.ts';
import { UpstreamError } from '../http.ts';
import { classifyResearchTask, namedStudyCollections } from '../../shared/research/coordinator.ts';
import { themeAyahs, themeWordingSupports } from '../../shared/research/themes.ts';
import { HADITH_COLLECTIONS } from '../../shared/sources.ts';
import { contentHash, createContentIndex, type ContentIndex } from './contentIndex.ts';
import { buildAgentContributions, type OpenedBook, type TafsirAttempt } from './contributions.ts';
import { openHadeethEncForQuestion } from './hadeethOpen.ts';
import {
  isPrayerDeedsQuestion,
  prayerDeedsAnswer,
  prayerDeedsInvestigation,
} from '../../shared/research/prayerDeeds.ts';
import type { ScienceWork } from './science.ts';
import type { ResearchAssignmentView } from '../../shared/contracts/v1.ts';

const VERSION = '1.0.0' as const;
const BUDGET = { queries: 6, opens: 4, callsPerSource: 12, timeMs: 20_000, concurrency: 2 } as const;

const HADEETH_RIGHTS = {
  source: 'HadeethEnc.com',
  conditions: ISLAMHOUSE_RIGHTS.conditions,
  generatedWork: false,
  checkedOn: '2026-10-21',
} as const;

const QURAN_RIGHTS = {
  source: 'QuranEnc.com',
  conditions: ISLAMHOUSE_RIGHTS.conditions,
  generatedWork: false,
  checkedOn: '2026-10-21',
} as const;

const ALQURAN_RIGHTS = {
  source: 'AlQuran Cloud',
  conditions: 'Ayah text retrieved from the AlQuran Cloud search edition. The wording is quoted as stored.',
  generatedWork: false,
  checkedOn: '2026-10-25',
} as const;

const STUDY_RIGHTS = {
  source: 'hadith-api (fawazahmed0)',
  conditions:
    'English and Arabic text retrieved from the hadith-api edition files. The wording is quoted as stored. No words were added where an edition file ends.',
  generatedWork: false,
  checkedOn: '2026-10-24',
} as const;

const SCIENCE_RIGHTS = {
  source: 'OpenAlex',
  conditions:
    'OpenAlex describes its catalogue as CC0 at https://openalex.org/about. This is the bibliographic record returned by the API. The full paper was not read. It is not a religious verdict.',
  generatedWork: false,
  checkedOn: '2026-10-21',
} as const;

const SPELLING: Record<string, readonly string[]> = {
  neighbor: ['neighbor', 'neighbour'],
  neighbour: ['neighbor', 'neighbour'],
  neighbors: ['neighbors', 'neighbours'],
  neighbours: ['neighbors', 'neighbours'],
  zakah: ['zakah', 'zakat'],
  zakat: ['zakah', 'zakat'],
};

export interface HadithHit {
  id: string;
  title: string;
}

export interface HadithRecord {
  id: string;
  title: string;
  text: string;
  arabic: string | null;
  grade: string | null;
  attribution: string | null;
  explanation: string | null;
  url: string;
}

export interface VerseRecord {
  surah: number;
  ayah: number;
  arabic: string;
  translation: string;
  translator: string;
  version: string | null;
  edition: string | null;
  url: string;
}

export interface StudyHadithRecord {
  id: string;
  collectionName: string;
  number: number;
  book: number;
  inBook: number;
  section: string | null;
  text: string;
  arabic: string | null;
  grade: string | null;
  url: string;
}

export interface ResearchPorts {
  searchHadeeth(lang: Lang, phrase: string, page: number, signal: AbortSignal): Promise<HadithHit[]>;
  loadHadeeth(lang: Lang, id: string, signal: AbortSignal): Promise<HadithRecord>;
  searchStudyHadith?(
    lang: Lang,
    question: string,
    phrases: string[],
    collectionIds: string[],
    signal: AbortSignal,
  ): Promise<StudyHadithRecord[]>;
  getVerses(refs: { surah: number; ayah: number }[], lang: Lang, signal: AbortSignal): Promise<VerseRecord[]>;
  searchScience(query: string, signal: AbortSignal): Promise<ScienceWork[] | 'not_configured'>;
  suggestSearch?(
    question: string,
    lang: Lang,
    signal: AbortSignal,
  ): Promise<{ available: boolean; failed: boolean; phrases: string[]; ayahs: { surah: number; ayah: number }[] }>;
  searchQuran?(
    phrase: string,
    signal: AbortSignal,
  ): Promise<{ total: number; refs: { surah: number; ayah: number }[]; hits?: { surah: number; ayah: number; text: string }[] }>;
  listWordings?(
    question: string,
    subject: string,
    signal: AbortSignal,
  ): Promise<{ available: boolean; failed: boolean; english: string[]; arabic: string[] }>;
  assessRelevance?(
    question: string,
    meaning: string,
    passages: { id: string; text: string }[],
    signal: AbortSignal,
  ): Promise<{ available: boolean; failed: boolean; keep: string[]; events?: { id: string; campaign: string }[] }>;
  writeAnswer?(
    question: string,
    lang: Lang,
    evidence: Evidence[],
    signal: AbortSignal,
  ): Promise<{ paragraphs: { text: string; citations: string[] }[]; insufficientEvidence: boolean }>;
  loadCommentary?(
    lang: Lang,
    surah: number,
    ayahs: number[],
    signal: AbortSignal,
  ): Promise<{ ok: true; spans: { locator: string; text: string; url: string }[] } | { ok: false; detail: string }>;
  searchBooks?(lang: Lang, question: string, signal: AbortSignal): Promise<{ id: number; title: string }[]>;
  readBook?(lang: Lang, id: number, signal: AbortSignal): Promise<BookRead>;
}

export interface BookRead {
  id: number;
  title: string;
  availability: 'readable' | 'partial' | 'language_unavailable' | 'source_unavailable';
  limitation: string | null;
  url: string | null;
  language: string | null;
  blocks: { id: string; text: string }[];
}

export interface ResearchRun {
  job: ResearchJobView;
  dossier: ResearchDossierView;
}

function abortError(): Error {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

function isAbort(err: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted || (err instanceof Error && err.name === 'AbortError'));
}

async function attempt<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw abortError();
  try {
    return await fn();
  } catch (err) {
    if (isAbort(err, signal)) throw abortError();
    const status = err instanceof UpstreamError ? err.status : 0;
    if (status !== 429 && status !== 504) throw err;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 300);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError());
        },
        { once: true },
      );
    });
    if (signal.aborted) throw abortError();
    return fn();
  }
}

function variants(token: string): string[] {
  return [...(SPELLING[token] ?? [token])];
}

function supportsNarration(question: string, text: string): boolean {
  const torah = /\b(?:torah|tawrah|taurat|tawrat)\b/i.test(question);
  const hebrew = /\bhebrew\b/i.test(question);
  if (torah && hebrew) return /torah|tawrah|taurat|tawrat/i.test(text) && /hebrew/i.test(text);
  return passageSupportsTopic(question, text);
}

function refFromJudgement(value: string): string | null {
  const match = value.match(/(\d{1,3})\s*[:/\-]\s*(\d{1,3})/);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > 114 || ayah < 1 || ayah > 286) return null;
  return `${surah}:${ayah}`;
}

function score(question: string, text: string): number {
  const haystack = text.toLocaleLowerCase('en');
  return contentTokens(question).reduce((total, token) => {
    return variants(token).some(variant => haystack.includes(variant)) ? total + token.length : total;
  }, 0);
}

function source(partial: Omit<SourceRecord, 'contractVersion'>): SourceRecord {
  return { contractVersion: VERSION, ...partial };
}

async function pool<T>(items: readonly T[], limit: number, signal: AbortSignal, run: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!signal.aborted) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await run(items[index]);
    }
  });
  await Promise.all(workers);
}

export async function executeResearch(input: {
  id?: string;
  question: string;
  language: Lang;
  signal?: AbortSignal;
  ports: ResearchPorts;
  index?: ContentIndex;
  now?: () => Date;
  onProgress?: (job: ResearchJobView) => void;
  assignment?: ResearchAssignmentView | null;
}): Promise<ResearchRun> {
  const signal = input.signal ?? new AbortController().signal;
  const interpretation = interpretQuestion(input.question);
  const budget =
    interpretation.kind === 'corpus-count'
      ? { queries: 6, opens: 4, callsPerSource: 16, timeMs: 35_000, concurrency: 2 }
      : input.assignment && input.assignment.teams.length > 1
        ? { queries: 8, opens: 6, callsPerSource: 16, timeMs: 45_000, concurrency: 2 }
        : BUDGET;
  const useHadith = !input.assignment || input.assignment.teams.includes('hadith');
  const useQuran = !input.assignment || input.assignment.teams.includes('quran');
  const useBooks = Boolean(input.assignment?.teams.includes('books'));
  const consultHadith =
    interpretation.corpus === 'quran'
      ? false
      : interpretation.corpus === 'hadith'
        ? true
        : useHadith || interpretation.consultHadith;
  const useScience = !input.assignment || input.assignment.scope === 'knowledge';
  const index = input.index ?? createContentIndex();
  const clock = input.now ?? (() => new Date());
  const started = clock();
  const startedMs = started.getTime();
  let sourceStartedMs = startedMs;
  const calls: Record<string, number> = {};
  const timings: Record<string, number> = {};
  const coverage: CoverageNote[] = [];
  const errors: { provider: string; message: string }[] = [];
  const passages: EvidencePassage[] = [];
  const booksOpened: OpenedBook[] = [];
  const tafsirAttempts: TafsirAttempt[] = [];
  const ranQueries: string[] = [];
  let contextCount = 0;
  let researchAnswer: ResearchAnswer | null = null;
  let investigation: ResearchJobView['investigation'];
  let hadeethProviderFailed = false;
  const occurrenceItems: WordingOccurrence[] = [];
  let occurrenceUnlisted = 0;
  let searchTruncated = false;
  let countedEnglish: string[] = [];
  let countedArabic: string[] = [];
  const campaignHits: { key: string; label: string; surah: number; ayah: number }[] = [];
  const unnamedEvents: { surah: number; ayah: number }[] = [];
  let corpusSplit: {
    english: string[];
    arabic: string[];
    occurrences: WordingOccurrence[];
    campaigns: CampaignGroup[];
    unnamed: { surah: number; ayah: number }[];
    unlisted: number;
  } | null = null;
  const publishSplit = () => {
    const capped = capOccurrences(occurrenceItems);
    corpusSplit = {
      english: countedEnglish,
      arabic: countedArabic,
      occurrences: capped.listed,
      campaigns: groupCampaigns(campaignHits),
      unnamed: [...unnamedEvents].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah),
      unlisted: occurrenceUnlisted + capped.unlisted,
      truncated: searchTruncated,
    };
  };
  const plan = decomposeQuestion(input.question);
  const job: ResearchJobView = {
    contractVersion: VERSION,
    id: input.id ?? randomUUID(),
    question: input.question,
    language: input.language,
    subquestions: plan.subquestions,
    status: 'running',
    progress: { step: 'understand', completed: 1, total: 4 },
    coverage,
    errors,
    startedAt: started.toISOString(),
    finishedAt: null,
    timingsMs: { totalMs: 0, sources: timings },
    assignment: input.assignment ?? null,
    agents: [],
    interpretation: interpretation.meaning
      ? { meaning: interpretation.meaning, scopes: interpretation.scopes.map(scope => ({ id: scope.id, text: scope.text })) }
      : null,
  };
  const publish = (step: string, completed: number) => {
    job.progress = { step, completed, total: 4 };
    input.onProgress?.(job);
  };
  publish('understand', 1);

  const finish = (status: ResearchJobView['status']): ResearchRun => {
    job.status = status;
    job.finishedAt = clock().toISOString();
    job.timingsMs = { totalMs: Math.max(0, clock().getTime() - startedMs), sources: { ...timings } };
    job.coverage = coverage;
    job.errors = errors;
    job.investigation = investigation;
    const claims = plan.subquestions.map(sub => claimFor(sub, passages, coverage, interpretation, corpusSplit));
    const unresolved = claims.filter(claim => claim.support !== 'supported').map(claim => `${claim.claim} — ${claim.note}`);
    if (status === 'cancelled') unresolved.unshift('The research job was cancelled. Any passages below are partial.');
    const disagreements: string[] = [];
    if (input.assignment?.teams.includes('hadith')) {
      const grades = [...new Set(passages.filter(item => item.source.provider === 'HadeethEnc' && item.publishedGrade).map(item => item.publishedGrade as string))];
      if (grades.length > 1) {
        disagreements.push(`The opened records print different grades: ${grades.join(', ')}. No grade was chosen from that difference.`);
      }
    }
    if (input.assignment) {
      job.assignment = input.assignment;
      const teams = [...input.assignment.teams];
      if (consultHadith && !teams.includes('hadith')) teams.push('hadith');
      job.agents = buildAgentContributions({
        teams,
        question: input.question,
        passages,
        coverage,
        claims,
        queries: ranQueries,
        books: booksOpened,
        tafsir: tafsirAttempts,
        contextCount,
      });
    }
    return {
      job,
      dossier: {
        contractVersion: VERSION,
        jobId: job.id,
        passages,
        claims,
        unresolved,
        disagreements,
        verificationNote:
          'Citation existence, quotation fidelity and claim support are checked separately. A citation id alone is not support. This is not a scholarly verdict and not a claim of complete coverage.',
        answer: researchAnswer,
      },
    };
  };

  const timed = async <T>(provider: string, fn: () => Promise<T>): Promise<T> => {
    const began = clock().getTime();
    try {
      return await fn();
    } finally {
      timings[provider] = (timings[provider] ?? 0) + Math.max(0, clock().getTime() - began);
    }
  };

  const allow = (provider: string) => {
    if (signal.aborted) return false;
    if (clock().getTime() - sourceStartedMs > budget.timeMs) {
      pushCoverage({ kind: 'budget_exhausted', provider, detail: 'The time budget ended before every planned request ran.' });
      return false;
    }
    calls[provider] = (calls[provider] ?? 0) + 1;
    if (calls[provider] > budget.callsPerSource) {
      pushCoverage({ kind: 'budget_exhausted', provider, detail: `The per-source request budget (${budget.callsPerSource}) was reached.` });
      calls[provider] -= 1;
      return false;
    }
    return true;
  };

  function pushCoverage(note: CoverageNote) {
    const key = `${note.kind}|${note.provider}|${note.detail}`;
    if (coverage.some(item => `${item.kind}|${item.provider}|${item.detail}` === key)) return;
    coverage.push(note);
  }

  const remember = (provider: string, id: string, version: string, text: string) => {
    const hash = contentHash(text);
    const key = `${provider}:${id}:${input.language}`;
    const status = index.status(key, version, hash);
    const stored = index.put(key, version, hash, text, clock().toISOString());
    if (status === 'stale' || stored.replacedStale) {
      pushCoverage({
        kind: 'evidence_found',
        provider,
        detail: `The indexed copy of ${provider} ${id} was replaced because its version or text changed. The previous text is not cited.`,
      });
    }
    return hash;
  };

  try {
    const religious = plan.subquestions.filter(sub => sub.domain !== 'science' && !asksScience(sub.text));
    const host = religious[0];
    const suggestedAyahs: { surah: number; ayah: number }[] = [];
    if (host && input.ports.suggestSearch) {
      try {
        const suggestion = await timed('Gemini', () => attempt(() => input.ports.suggestSearch!(input.question, input.language, signal), signal));
        if (!suggestion.available) {
          pushCoverage({
            kind: 'scholarly_review_required',
            provider: 'Gemini',
            detail: 'Live Gemini is not configured, so extra searches in other languages were not added. Real spoken audio is not available. The words in the question are still searched.',
          });
        } else if (suggestion.failed) {
          pushCoverage({
            kind: 'source_unavailable',
            provider: 'Gemini',
            detail: 'A source could not be reached. The study assistant did not prepare extra searches. Research continued with the words in the question.',
          });
        } else {
          for (const phrase of suggestion.phrases) {
            if (!host.queries.includes(phrase) && host.queries.length < 6) host.queries.push(phrase);
          }
          for (const ayah of suggestion.ayahs) suggestedAyahs.push(ayah);
        }
      } catch (err) {
        if (isAbort(err, signal)) return finish('cancelled');
        pushCoverage({
          kind: 'source_unavailable',
          provider: 'Gemini',
          detail: 'A source could not be reached. The study assistant did not prepare extra searches. Research continued with the words in the question.',
        });
      }
    }
    if (host && interpretation.searchPhrases.length) {
      const merged = [...interpretation.searchPhrases, ...host.queries];
      host.queries = [];
      for (const phrase of merged) {
        if (phrase && !host.queries.includes(phrase) && host.queries.length < 6) host.queries.push(phrase);
      }
    }
    // Planning is optional. It must not consume the time kept for opening sources.
    sourceStartedMs = clock().getTime();
    const queries: { sub: ResearchSubquestion; phrase: string }[] = [];
    for (const sub of plan.subquestions) {
      if (sub.domain === 'science' || asksScience(sub.text)) continue;
      for (const phrase of sub.queries) {
        if (queries.length >= budget.queries) break;
        if (!queries.some(item => item.phrase === phrase)) queries.push({ sub, phrase });
      }
    }
    const unprocessed = consultHadith && religious.length > 0 && queries.length === 0;
    if (unprocessed) {
      pushCoverage({
        kind: 'no_relevant_evidence',
        provider: 'planner',
        detail: `We could not process the question. It is still here: ${input.question}`,
      });
    }
    publish('search', 2);
    const prayerQuestion = isPrayerDeedsQuestion(input.question);
    if (consultHadith && queries.length) {
      try {
        const opened = await openHadeethEncForQuestion({
          question: input.question,
          language: input.language,
          queries: queries.map(item => item.phrase),
          search: async (language, phrase) => {
            ranQueries.push(phrase);
            if (!allow('HadeethEnc')) return [];
            return timed('HadeethEnc', () => attempt(() => input.ports.searchHadeeth(language, phrase, 1, signal), signal));
          },
          load: async (language, id) => {
            if (!allow('HadeethEnc')) return null;
            const record = await timed('HadeethEnc', () => attempt(() => input.ports.loadHadeeth(language, id, signal), signal));
            return { ...record, lessons: [] };
          },
        });
        hadeethProviderFailed = opened.providerFailed;
        for (const failure of opened.errors) {
          errors.push(failure);
          pushCoverage({
            kind: 'source_unavailable',
            provider: 'HadeethEnc',
            detail: `A source could not be reached. ${failure.message} This is not a finding that the subject is absent.`,
          });
        }
        for (const record of opened.records) {
          if (prayerQuestion && (record.role === 'background' || record.role === 'unrelated')) {
            pushCoverage({
              kind: 'no_relevant_evidence',
              provider: 'HadeethEnc',
              detail: `HadeethEnc ${record.id} was retrieved and set aside. It does not explain the fasting, charity, or other deeds of a person who does not pray.`,
            });
            continue;
          }
          if (!prayerQuestion) {
            const blob = `${record.text}\n${record.arabic ?? ''}`;
            const supported = supportsNarration(input.question, blob) || plan.subquestions.some(sub => supportsNarration(sub.text, blob));
            if (!supported) {
              pushCoverage({
                kind: 'no_relevant_evidence',
                provider: 'HadeethEnc',
                detail: `HadeethEnc ${record.id} was opened. Its text did not contain a content term from the question, so it is not cited.`,
              });
              continue;
            }
          }
          const hash = remember('HadeethEnc', record.id, contentHash(record.text), record.text);
          passages.push(hadithPassage(record, input.language, clock().toISOString(), hash, record.role === 'distinct' ? 'commentary' : 'source_text'));
        }
        if (!opened.records.length && !opened.providerFailed) {
          pushCoverage({
            kind: 'no_relevant_evidence',
            provider: 'HadeethEnc',
            detail: prayerQuestion
              ? 'The question’s own words and two recovery phrases returned no decisive HadeethEnc record. This empty catalogue result is not a provider failure.'
              : `Search returned no records for “${queries[0]?.phrase ?? input.question}”. Other searches still run.`,
          });
        }
      } catch (err) {
        if (isAbort(err, signal)) return finish('cancelled');
        const message = err instanceof Error ? err.message : 'HadeethEnc search failed.';
        hadeethProviderFailed = true;
        errors.push({ provider: 'HadeethEnc', message });
        pushCoverage({
          kind: 'source_unavailable',
          provider: 'HadeethEnc',
          detail: `A source could not be reached. HadeethEnc search failed: ${message} This is not a finding that the subject is absent.`,
        });
      }
    }
    publish('read', 3);
    if (signal.aborted) return finish('cancelled');

    const verifyNarration = classifyResearchTask(input.question) === 'verify-narration';
    const encyclopediaKept = passages.filter(item => item.source.provider === 'HadeethEnc');
    const numberedReference = encyclopediaKept.some(item =>
      /(?:bukh\w*|muslim|dawud|tirmidh\w*|nasai|majah|malik)\s+\d{2,}/i.test(`${item.locator} ${item.source.title} ${item.context ?? ''}`),
    );
    const encyclopediaLacksNarration = encyclopediaKept.length === 0;
    if (hadeethProviderFailed && encyclopediaLacksNarration) {
      pushCoverage({
        kind: 'source_unavailable',
        provider: 'hadith-api',
        detail: 'The study collections were not searched in place of a failed HadeethEnc response. A provider error is not absence of evidence.',
      });
    }
    if (
      consultHadith &&
      !prayerQuestion &&
      !hadeethProviderFailed &&
      input.ports.searchStudyHadith &&
      (encyclopediaLacksNarration || (verifyNarration && !numberedReference))
    ) {
      const named = namedStudyCollections(
        `${input.question}\n${encyclopediaKept.map(item => `${item.locator}\n${item.text}`).join('\n')}`,
      );
      const collectionIds = named.length ? named : HADITH_COLLECTIONS.map(item => item.id);
      if (allow('hadith-api')) {
        try {
          const rows = await timed('hadith-api', () =>
            attempt(
              () => input.ports.searchStudyHadith!(input.language, input.question, ranQueries, collectionIds, signal),
              signal,
            ),
          );
          if (!rows.length) {
            pushCoverage({
              kind: 'no_relevant_evidence',
              provider: 'hadith-api',
              detail: encyclopediaLacksNarration
                ? 'HadeethEnc did not return this narration. The study collections were searched next and no numbered record was kept.'
                : 'HadeethEnc did not print a collection number. The study collections were searched and no numbered record was kept.',
            });
          }
          for (const row of rows) {
            const blob = `${row.text}\n${row.arabic ?? ''}`;
            const supported =
              supportsNarration(input.question, blob) || plan.subquestions.some(sub => supportsNarration(sub.text, blob));
            if (!supported) {
              pushCoverage({
                kind: 'no_relevant_evidence',
                provider: 'hadith-api',
                detail: `${row.collectionName} ${row.number} was opened. Its text did not contain a content term from the question, so it is not cited.`,
              });
              continue;
            }
            const hash = remember('hadith-api', row.id, contentHash(row.text), `${row.text}\n${row.arabic ?? ''}`);
            passages.push(studyPassage(row, input.language, clock().toISOString(), hash));
          }
        } catch (err) {
          if (isAbort(err, signal)) return finish('cancelled');
          const message = err instanceof Error ? err.message : 'The study collection could not be searched.';
          errors.push({ provider: 'hadith-api', message });
          pushCoverage({
            kind: 'source_unavailable',
            provider: 'hadith-api',
            detail: `A source could not be reached. hadith-api search failed: ${message} This is not a finding that the narration is absent.`,
          });
        }
      }
    }
    if (signal.aborted) return finish('cancelled');

    const countingCorpus = interpretation.kind === 'corpus-count' && interpretation.corpus !== 'hadith' && useQuran;
    if (countingCorpus) {
      const fallback = fallbackWordings(interpretation.subject);
      countedEnglish = fallback.english;
      countedArabic = fallback.arabic;
      if (input.ports.listWordings) {
        try {
          const listed = await timed('Gemini', () =>
            attempt(() => input.ports.listWordings!(input.question, interpretation.subject, signal), signal),
          );
          const cleaned = distinctWordings(listed.english, listed.arabic);
          if (!listed.available || listed.failed || (cleaned.english.length === 0 && cleaned.arabic.length === 0)) {
            pushCoverage({
              kind: 'scholarly_review_required',
              provider: 'Gemini',
              detail: 'A wording list was not returned. The subject’s own word and its singular or plural were counted instead.',
            });
          } else {
            countedEnglish = cleaned.english;
            countedArabic = cleaned.arabic;
          }
        } catch (err) {
          if (isAbort(err, signal)) return finish('cancelled');
          pushCoverage({
            kind: 'scholarly_review_required',
            provider: 'Gemini',
            detail: 'A wording list was not returned. The subject’s own word and its singular or plural were counted instead.',
          });
        }
      }
      const wordings = [
        ...countedEnglish.map(wording => ({ wording, script: 'english' as const })),
        ...countedArabic.map(wording => ({ wording, script: 'arabic' as const })),
      ];
      if (input.ports.searchQuran) {
        for (const phrase of wordings) {
          if (!allow('AlQuran')) break;
          try {
            const found = await timed('AlQuran', () => attempt(() => input.ports.searchQuran!(phrase.wording, signal), signal));
            const hits = found.hits;
            if (hits) {
              if (hits.length < found.total) searchTruncated = true;
              for (const hit of hits) {
                if (!hit.text || !wordingInText(phrase.wording, hit.text)) continue;
                occurrenceItems.push({
                  surah: hit.surah,
                  ayah: hit.ayah,
                  wording: phrase.wording,
                  script: phrase.script,
                  text: hit.text,
                });
              }
            }
          } catch (err) {
            if (isAbort(err, signal)) return finish('cancelled');
            const message = err instanceof Error ? err.message : 'The Qur’an search did not respond.';
            errors.push({ provider: 'AlQuran', message });
            pushCoverage({
              kind: 'source_unavailable',
              provider: 'AlQuran',
              detail: `A source could not be reached. The Qur’an search failed: ${message} Passages already nominated are still opened. This is not a finding that the subject is absent.`,
            });
          }
        }
      }
      publishSplit();
    }
    const namedAyahs = useQuran ? ayahsMentioned(input.question) : [];
    const ayahs = [...namedAyahs];
    const themeKeys = new Set<string>();
    const ayahCap = 8;
    if (useQuran) {
      for (const ayah of themeAyahs(input.question)) {
        const key = `${ayah.surah}:${ayah.ayah}`;
        themeKeys.add(key);
        if (ayahs.length >= ayahCap) continue;
        if (!ayahs.some(item => item.surah === ayah.surah && item.ayah === ayah.ayah)) ayahs.push(ayah);
      }
      for (const ayah of suggestedAyahs) {
        if (ayahs.length >= ayahCap) break;
        if (!ayahs.some(item => item.surah === ayah.surah && item.ayah === ayah.ayah)) ayahs.push(ayah);
      }
    }
    const namedKeys = new Set(namedAyahs.map(ayah => `${ayah.surah}:${ayah.ayah}`));
    if (ayahs.length && allow('QuranEnc')) {
      try {
        const verses = await timed('QuranEnc', () => attempt(() => input.ports.getVerses(ayahs, input.language, signal), signal));
        const found = new Set(verses.map(verse => `${verse.surah}:${verse.ayah}`));
        if (countingCorpus && input.ports.assessRelevance && verses.length) {
          try {
            const judged = await timed('Gemini', () =>
              attempt(
                () =>
                  input.ports.assessRelevance!(
                    input.question,
                    interpretation.meaning,
                    verses.map(verse => ({ id: `${verse.surah}:${verse.ayah}`, text: `${verse.arabic}\n${verse.translation}` })),
                    signal,
                  ),
                signal,
              ),
            );
            if (!judged.available || judged.failed) {
              pushCoverage({
                kind: 'scholarly_review_required',
                provider: 'Gemini',
                detail: 'Meaning review did not name a campaign. A verse is counted only when its text contains a counted wording.',
              });
            } else {
              const wordings = [...countedEnglish, ...countedArabic];
              for (const event of judged.events ?? []) {
                const ref = refFromJudgement(event.id);
                const verse = ref ? verses.find(item => `${item.surah}:${item.ayah}` === ref) : undefined;
                if (!verse || !ref) continue;
                const campaign = event.campaign.replace(/\s+/g, ' ').trim();
                if (!campaign || /^unnamed$/i.test(campaign)) {
                  const named = campaignHits.some(item => item.surah === verse.surah && item.ayah === verse.ayah);
                  if (!named && !unnamedEvents.some(item => item.surah === verse.surah && item.ayah === verse.ayah)) {
                    unnamedEvents.push({ surah: verse.surah, ayah: verse.ayah });
                  }
                  continue;
                }
                const accepted = acceptedCampaign(campaign, `${verse.translation}\n${verse.arabic}`, wordings);
                if (!accepted) continue;
                unnamedEvents.splice(
                  0,
                  unnamedEvents.length,
                  ...unnamedEvents.filter(item => item.surah !== verse.surah || item.ayah !== verse.ayah),
                );
                campaignHits.push({ key: accepted.key, label: accepted.label, surah: verse.surah, ayah: verse.ayah });
              }
            }
          } catch (err) {
            if (isAbort(err, signal)) return finish('cancelled');
            pushCoverage({
              kind: 'scholarly_review_required',
              provider: 'Gemini',
              detail: 'Meaning review did not name a campaign. A verse is counted only when its text contains a counted wording.',
            });
          }
        }
        if (countingCorpus) {
          for (const verse of verses) {
            for (const wording of countedEnglish) {
              if (!wordingInText(wording, verse.translation)) continue;
              occurrenceItems.push({ surah: verse.surah, ayah: verse.ayah, wording, script: 'english', text: verse.translation });
            }
            for (const wording of countedArabic) {
              if (!wordingInText(wording, verse.arabic)) continue;
              occurrenceItems.push({ surah: verse.surah, ayah: verse.ayah, wording, script: 'arabic', text: verse.arabic });
            }
          }
          publishSplit();
        }
        for (const verse of verses) {
          const key = `${verse.surah}:${verse.ayah}`;
          const named = namedKeys.has(key);
          const theme = themeKeys.has(key);
          const verseText = `${verse.arabic}\n${verse.translation}`;
          const inCount = Boolean(corpusSplit && splitMentions(corpusSplit, verse.surah, verse.ayah));
          const supported = countingCorpus
            ? inCount
            : named ||
              passageSupportsTopic(input.question, verseText) ||
              plan.subquestions.some(sub => passageSupportsTopic(sub.text, verseText)) ||
              themeWordingSupports(input.question, verseText) ||
              (theme && interpretation.synonyms.some(word => verseText.toLocaleLowerCase('en').includes(word.toLocaleLowerCase('en'))));
          if (!supported) {
            pushCoverage({
              kind: 'no_relevant_evidence',
              provider: 'QuranEnc',
              detail: countingCorpus
                ? `Qur’an ${key} was opened. It does not contain a counted wording and it does not narrate a named campaign, so it is in neither count. The source was available.`
                : `Qur’an ${key} was opened. Read for meaning and context, it does not address this question, so it is not cited. The source was available.`,
            });
            continue;
          }
          const hash = remember('QuranEnc', key, verse.version ?? contentHash(verse.translation), verse.translation);
          const passage = versePassage(verse, input.language, clock().toISOString(), hash);
          if (countingCorpus && corpusSplit) passage.context = corpusPassageContext(verse.surah, verse.ayah, corpusSplit);
          passages.push(passage);
        }
        for (const ayah of ayahs) {
          if (!found.has(`${ayah.surah}:${ayah.ayah}`)) {
            pushCoverage({
              kind: 'no_relevant_evidence',
              provider: 'QuranEnc',
              detail: `Qur’an ${ayah.surah}:${ayah.ayah} was not in the QuranEnc response for ${input.language}.`,
            });
          }
        }
      } catch (err) {
        if (isAbort(err, signal)) return finish('cancelled');
        const message = err instanceof Error ? err.message : 'QuranEnc did not respond.';
        errors.push({ provider: 'QuranEnc', message });
        pushCoverage({
          kind: 'source_unavailable',
          provider: 'QuranEnc',
          detail: `A source could not be reached. QuranEnc did not respond: ${message} The hadith search is not cancelled by this.`,
        });
      }
    }
    if (countingCorpus) {
      if (!corpusSplit) publishSplit();
      for (const group of groupOccurrenceVerses(corpusSplit?.occurrences ?? [])) {
        const key = `${group[0].surah}:${group[0].ayah}`;
        if (passages.some(passage => passage.role === 'translation' && passage.source.id === key)) continue;
        const hash = remember('AlQuran', key, contentHash(group.map(item => item.text).join('\n')), group[0].text);
        passages.push(occurrenceSnippet(group, input.language, clock().toISOString(), hash));
      }
    }

    if (useQuran && input.assignment && input.ports.getVerses) {
      const contextRefs: { surah: number; ayah: number }[] = [];
      for (const passage of passages) {
        if (passage.source.provider !== 'QuranEnc') continue;
        const [surah, ayah] = passage.source.id.split(':').map(Number);
        for (const next of [ayah - 1, ayah + 1]) {
          if (next < 1 || next > 286) continue;
          const key = `${surah}:${next}`;
          if (passages.some(item => item.source.id === key)) continue;
          if (!contextRefs.some(item => item.surah === surah && item.ayah === next) && contextRefs.length < 4) contextRefs.push({ surah, ayah: next });
        }
      }
      if (contextRefs.length && allow('QuranEnc')) {
        try {
          const verses = await timed('QuranEnc', () => attempt(() => input.ports.getVerses(contextRefs, input.language, signal), signal));
          for (const verse of verses) {
            const hash = remember('QuranEnc', `${verse.surah}:${verse.ayah}`, verse.version ?? contentHash(verse.translation), verse.translation);
            const passage = versePassage(verse, input.language, clock().toISOString(), hash);
            passage.context = 'Neighbouring ayah, opened so the cited verse is read in place. It is context, not a separate answer.';
            passages.push(passage);
            contextCount += 1;
          }
        } catch (err) {
          if (isAbort(err, signal)) return finish('cancelled');
          const message = err instanceof Error ? err.message : 'QuranEnc did not respond.';
          pushCoverage({
            kind: 'source_unavailable',
            provider: 'QuranEnc',
            detail: `Neighbouring ayahs could not be opened: ${message}`,
          });
        }
      }
      if (input.ports.loadCommentary) {
        const bySurah = new Map<number, number[]>();
        for (const passage of passages) {
          if (passage.source.provider !== 'QuranEnc' || passage.context?.startsWith('Neighbouring')) continue;
          const [surah, ayah] = passage.source.id.split(':').map(Number);
          const list = bySurah.get(surah) ?? [];
          list.push(ayah);
          bySurah.set(surah, list);
        }
        for (const [surah, ayahList] of [...bySurah.entries()].slice(0, interpretation.kind === 'corpus-count' ? 4 : 2)) {
          if (!allow('QuranEnc')) break;
          try {
            const commentary = await timed('QuranEnc', () =>
              attempt(() => input.ports.loadCommentary!(input.language, surah, ayahList, signal), signal),
            );
            if (!commentary.ok) {
              tafsirAttempts.push({ surah, ok: false, detail: commentary.detail });
              pushCoverage({ kind: 'source_unavailable', provider: 'QuranEnc', detail: commentary.detail });
              continue;
            }
            tafsirAttempts.push({ surah, ok: true, detail: `${commentary.spans.length} commentary span(s).` });
            for (const span of commentary.spans) {
              const hash = remember('QuranEnc', `tafsir-${surah}-${span.locator}`, contentHash(span.text), span.text);
              passages.push({
                contractVersion: VERSION,
                id: `T${surah}-${contentHash(span.locator).slice(0, 8)}`,
                source: source({
                  id: `tafsir-${surah}`,
                  provider: 'QuranEnc',
                  language: input.language,
                  edition: 'mukhtasar',
                  version: null,
                  title: 'Al-Mukhtasar',
                  credits: [{ role: 'commentary', name: 'Al-Mukhtasar' }],
                  canonicalUrl: span.url,
                  contentType: 'quran',
                  rights: QURAN_RIGHTS,
                  retrievedAt: clock().toISOString(),
                  contentHash: hash,
                }),
                text: span.text,
                originalLanguage: input.language,
                arabic: null,
                locator: span.locator,
                context: 'Commentary opened from Al-Mukhtasar. It is not a new tafsir written for this question.',
                readerRoute: `#/quran/study`,
                role: 'commentary',
                publishedGrade: null,
              });
            }
          } catch (err) {
            if (isAbort(err, signal)) return finish('cancelled');
            const message = err instanceof Error ? err.message : 'Commentary could not be opened.';
            tafsirAttempts.push({ surah, ok: false, detail: message });
            pushCoverage({ kind: 'source_unavailable', provider: 'QuranEnc', detail: `Tafsir could not be opened for surah ${surah}: ${message}` });
          }
        }
      }
    }

    if (useBooks && input.assignment) {
      let bookIds = input.assignment.bookId ? [input.assignment.bookId] : [];
      if (!bookIds.length && input.ports.searchBooks) {
        try {
          const found = await timed('IslamHouse', () => attempt(() => input.ports.searchBooks!(input.language, input.question, signal), signal));
          bookIds = found.slice(0, 2).map(item => item.id);
          if (!found.length) {
            pushCoverage({
              kind: 'no_relevant_evidence',
              provider: 'IslamHouse',
              detail: 'The book catalogue search ran. No item was selected from it. A failed title search is not the answer.',
            });
          }
        } catch (err) {
          if (isAbort(err, signal)) return finish('cancelled');
          const message = err instanceof Error ? err.message : 'The book catalogue could not be searched.';
          pushCoverage({ kind: 'source_unavailable', provider: 'IslamHouse', detail: `A source could not be reached. ${message}` });
        }
      }
      for (const bookId of bookIds) {
        if (!input.ports.readBook || !allow('IslamHouse')) break;
        try {
          const book = await timed('IslamHouse', () => attempt(() => input.ports.readBook!(input.language, bookId, signal), signal));
          const matched = book.blocks.filter(block => passageSupportsTopic(input.question, block.text) || themeWordingSupports(input.question, block.text));
          booksOpened.push({
            id: book.id,
            title: book.title,
            availability: book.availability,
            limitation: book.limitation,
            matched: matched.length,
            blocks: book.blocks.length,
            url: book.url,
          });
          if (book.availability === 'language_unavailable' || book.availability === 'source_unavailable') {
            pushCoverage({
              kind: book.availability,
              provider: 'IslamHouse',
              detail: book.limitation ?? `Item ${book.id} could not be read.`,
            });
            continue;
          }
          if (!book.blocks.length) {
            pushCoverage({
              kind: 'source_unavailable',
              provider: 'IslamHouse',
              detail: book.limitation ?? `Item ${book.id} has no full text in the item API. The catalogue description is not cited as the book.`,
            });
            continue;
          }
          if (!matched.length) {
            pushCoverage({
              kind: 'no_relevant_evidence',
              provider: 'IslamHouse',
              detail: `Item ${book.id} was opened. Its paragraphs did not share a content term with the question, so none are cited.`,
            });
            continue;
          }
          for (const block of matched.slice(0, 4)) {
            const index = book.blocks.findIndex(item => item.id === block.id);
            const around = book.blocks.slice(Math.max(0, index - 1), index + 2).map(item => item.text).join('\n\n');
            const hash = remember('IslamHouse', String(book.id), contentHash(block.text), block.text);
            passages.push({
              contractVersion: VERSION,
              id: `B${book.id}-${block.id}`,
              source: source({
                id: String(book.id),
                provider: 'IslamHouse',
                language: book.language ?? input.language,
                edition: null,
                version: hash,
                title: book.title,
                credits: [],
                canonicalUrl: book.url ?? `https://islamhouse.com`,
                contentType: 'book',
                rights: ISLAMHOUSE_RIGHTS,
                retrievedAt: clock().toISOString(),
                contentHash: hash,
              }),
              text: block.text,
              originalLanguage: book.language ?? input.language,
              arabic: null,
              locator: `${book.title || `IslamHouse ${book.id}`} · ${block.id}`,
              context: around === block.text ? null : `Passage in context:\n${around}`,
              readerRoute: `#/books/item/${book.id}`,
              role: 'source_text',
              publishedGrade: null,
            });
          }
        } catch (err) {
          if (isAbort(err, signal)) return finish('cancelled');
          const message = err instanceof Error ? err.message : 'The book could not be opened.';
          booksOpened.push({ id: bookId, title: '', availability: 'source_unavailable', limitation: message, matched: 0, blocks: 0, url: null });
          pushCoverage({ kind: 'source_unavailable', provider: 'IslamHouse', detail: `Item ${bookId} could not be opened: ${message}` });
        }
      }
    }

    const scienceQuestions = useScience ? plan.subquestions.filter(sub => sub.domain === 'science' || asksScience(sub.text)) : [];
    for (const sub of scienceQuestions) {
      if (!allow('OpenAlex')) break;
      const query = contentTokens(sub.text).slice(0, 8).join(' ');
      try {
        const works = await timed('OpenAlex', () => attempt(() => input.ports.searchScience(query, signal), signal));
        if (works === 'not_configured') {
          pushCoverage({
            kind: 'science_not_configured',
            provider: 'OpenAlex',
            detail: 'Scientific retrieval is not configured. No study was generated to fill the gap.',
          });
          continue;
        }
        if (!works.length) {
          pushCoverage({
            kind: 'no_relevant_evidence',
            provider: 'OpenAlex',
            detail: `OpenAlex returned no works for “${query}”. That is the search result, not a finding that nothing has been studied.`,
          });
          continue;
        }
        for (const work of works) {
          const text = [work.title, work.abstract].filter(Boolean).join('\n\n');
          const hash = remember('OpenAlex', work.id, String(work.year ?? 'undated'), text);
          passages.push(sciencePassage(work, text, clock().toISOString(), hash));
        }
      } catch (err) {
        if (isAbort(err, signal)) return finish('cancelled');
        const message = err instanceof Error ? err.message : 'OpenAlex did not respond.';
        errors.push({ provider: 'OpenAlex', message });
        pushCoverage({
          kind: 'source_unavailable',
          provider: 'OpenAlex',
          detail: `OpenAlex could not be read: ${message} No study was invented in its place.`,
        });
      }
    }

    if (prayerQuestion) {
      for (let index = passages.length - 1; index >= 0; index -= 1) {
        const passage = passages[index];
        if (passage.source.contentType !== 'quran') continue;
        const blob = `${passage.text}\n${passage.arabic ?? ''}`;
        if (/صلاة|صلو|prayer|தொழு|සලාත/i.test(blob)) continue;
        passages.splice(index, 1);
        pushCoverage({
          kind: 'no_relevant_evidence',
          provider: passage.source.provider,
          detail: `${passage.locator} was set aside. It does not connect leaving prayer with fasting, charity, or other deeds.`,
        });
      }
    }
    if (passages.some(item => item.source.provider === 'HadeethEnc' && !item.publishedGrade)) {
      pushCoverage({
        kind: 'scholarly_review_required',
        provider: 'HadeethEnc',
        detail: 'At least one opened hadith had no published grade. No grade was inferred from the website.',
      });
    }
    if (passages.some(item => item.role === 'empirical') && passages.some(item => item.role !== 'empirical')) {
      pushCoverage({
        kind: 'scholarly_review_required',
        provider: 'OpenAlex',
        detail: 'Religious passages and empirical records were both retrieved. They are not treated as proof of each other.',
      });
    }
    if (passages.length) pushCoverage({ kind: 'evidence_found', provider: 'dossier', detail: `${passages.length} passage(s) were opened and kept.` });
    else if (unprocessed) {
      /* The processing note already names the question. A second “nothing matched” note would pretend a search ran. */
    } else if (coverage.some(note => note.kind === 'budget_exhausted')) {
      pushCoverage({
        kind: 'budget_exhausted',
        provider: 'dossier',
        detail: `Research stopped before every planned source was opened. This is incomplete research, not a finding that the sources are silent. The question is still here: ${input.question}`,
      });
    } else if (!coverage.some(note => note.kind === 'source_unavailable' || note.kind === 'science_not_configured' || note.kind === 'language_unavailable')) {
      const opened = coverage.some(note => /was opened/i.test(note.detail));
      pushCoverage({
        kind: 'no_relevant_evidence',
        provider: 'dossier',
        detail: opened
          ? `The opened passages do not address this question. The sources were available. Your question is still here: ${input.question}`
          : `Available evidence does not sufficiently support an answer. Your question is still here: ${input.question}`,
      });
    }
    if (corpusSplit) {
      researchAnswer = {
        paragraphs: formatCorpusCount(corpusSplit),
        insufficientEvidence: false,
        writer: 'retrieved',
      };
    } else if (passages.length) {
      const packet = answerPassages(passages);
      const evidence = packet.map(passageToEvidence);
      let written: ResearchAnswer | null = null;
      if (input.ports.writeAnswer && evidence.length) {
        try {
          const result = await timed('Gemini', () => attempt(() => input.ports.writeAnswer!(input.question, input.language, evidence, signal), signal));
          written = acceptWrittenAnswer(input.question, result, packet, interpretation);
        } catch (err) {
          if (isAbort(err, signal)) return finish('cancelled');
          written = null;
        }
      }
      researchAnswer = written ?? retrievedAnswer(input.question, packet, interpretation);
    }
    if (prayerQuestion) {
      const supportCount = passages.filter(passage => passage.id === 'E6261' || passage.id === 'E65093').length;
      investigation = prayerDeedsInvestigation({ supportCount, providerFailed: hadeethProviderFailed });
      const cited = passages.filter(passage => passage.source.provider === 'HadeethEnc' && ['E6261', 'E65093', 'E65094'].includes(passage.id));
      researchAnswer = prayerDeedsAnswer(input.language, cited);
    } else if (hadeethProviderFailed && passages.length === 0) {
      investigation = 'blocked';
    }
    publish('verify', 4);
    if (signal.aborted) return finish('cancelled');
    return finish('done');
  } catch (err) {
    if (isAbort(err, signal)) return finish('cancelled');
    const message = err instanceof Error ? err.message : 'Research failed.';
    errors.push({ provider: 'research', message });
    job.status = 'error';
    return finish('error');
  }
}

function claimFor(
  sub: ResearchSubquestion,
  passages: EvidencePassage[],
  coverage: CoverageNote[],
  interpretation: QuestionInterpretation,
  split: {
    occurrences: readonly WordingOccurrence[];
    campaigns: readonly CampaignGroup[];
    unnamed: readonly { surah: number; ayah: number }[];
  } | null,
): ClaimEvidence {
  if (sub.domain === 'science' || asksScience(sub.text)) {
    const papers = passages.filter(item => item.role === 'empirical');
    if (coverage.some(note => note.kind === 'science_not_configured')) {
      return {
        claim: sub.text,
        passageIds: [] as string[],
        support: 'insufficient' as const,
        citationExists: false,
        quotationFaithful: null,
        citationRelevant: false,
        note: 'Scientific retrieval is not configured. No study was generated.',
      };
    }
    if (!papers.length) {
      return {
        claim: sub.text,
        passageIds: [] as string[],
        support: 'insufficient' as const,
        citationExists: false,
        quotationFaithful: null,
        citationRelevant: false,
        note: 'No empirical record was retrieved for this part of the question. Religious passages were not used as scientific evidence.',
      };
    }
    const best = [...papers].sort((a, b) => score(sub.text, b.text) - score(sub.text, a.text))[0];
    const check = verifyClaim(sub.text, best.id, papers.map(item => ({ id: item.id, text: item.text })));
    return {
      ...check,
      note:
        check.support === 'supported'
          ? 'The OpenAlex record contains words from this question. The paper was not read. This is not causation and not a religious verdict.'
          : check.note,
    };
  }
  if (interpretation.kind === 'corpus-count') {
    const words = split?.occurrences.length ?? 0;
    const campaigns = split?.campaigns.length ?? 0;
    const unnamed = split?.unnamed.length ?? 0;
    if (!words && !campaigns && !unnamed) {
      const unavailable = coverage.some(note => note.kind === 'source_unavailable' || note.kind === 'language_unavailable');
      return {
        claim: sub.text,
        passageIds: [] as string[],
        support: 'insufficient' as const,
        citationExists: false,
        quotationFaithful: null,
        citationRelevant: false,
        note: unavailable
          ? 'A source could not be reached, so this count was not finished.'
          : 'No counted wording and no named campaign was found in the retrieved text. The sources that responded were available.',
      };
    }
    const ids = [
      ...(split?.occurrences ?? []).map(item => `Q${item.surah}-${item.ayah}`),
      ...(split?.campaigns ?? []).flatMap(group => group.verses.map(verse => `Q${verse.surah}-${verse.ayah}`)),
      ...(split?.unnamed ?? []).map(verse => `Q${verse.surah}-${verse.ayah}`),
    ];
    return {
      claim: sub.text,
      passageIds: [...new Set(ids)].filter(id => passages.some(passage => passage.id === id)).slice(0, 12),
      support: 'supported' as const,
      citationExists: true,
      quotationFaithful: true,
      citationRelevant: true,
      note: `Word occurrences and named campaigns are counted separately. ${words} wording occurrence(s) and ${campaigns} named campaign(s) are listed. Neither count is a sentence in the sources.`,
    };
  }
  if (!sub.queries.length) {
    return {
      claim: sub.text,
      passageIds: [] as string[],
      support: 'insufficient' as const,
      citationExists: false,
      quotationFaithful: null,
      citationRelevant: false,
      note: 'We could not process the question. It is still here.',
    };
  }
  const related = passages.filter(item => {
    if (item.role === 'empirical' || item.context?.startsWith('Neighbouring')) return false;
    const blob = `${item.text}\n${item.arabic ?? ''}`;
    return passageSupportsTopic(sub.text, blob) || themeWordingSupports(sub.text, blob);
  });
  if (!related.length) {
    return {
      claim: sub.text,
      passageIds: [] as string[],
      support: 'insufficient' as const,
      citationExists: false,
      quotationFaithful: null,
      citationRelevant: false,
      note: coverage.some(note => note.kind === 'source_unavailable' || note.kind === 'language_unavailable')
        ? 'A source could not be reached, so this part was not fully checked.'
        : coverage.some(note => note.kind === 'budget_exhausted')
          ? 'Research stopped before this part was fully checked. This is incomplete research, not a finding that the sources are silent.'
          : 'Available evidence does not sufficiently support an answer to this part of the question.',
    };
  }
  const best = [...related].sort((a, b) => score(sub.text, b.text) - score(sub.text, a.text))[0];
  const check = verifyClaim(sub.text, best.id, related.map(item => ({ id: item.id, text: item.text })));
  const passageIds = related.map(item => item.id).slice(0, 8);
  const onSubject = related.some(item => themeWordingSupports(sub.text, `${item.text}\n${item.arabic ?? ''}`));
  if (check.support === 'unsupported' && onSubject) {
    return {
      ...check,
      support: 'insufficient',
      citationRelevant: true,
      passageIds,
      note: 'The retrieved passages are about this subject. They do not establish the claim as asked, and no number or grade was added.',
    };
  }
  if (check.support === 'insufficient' || check.support === 'supported') {
    return {
      ...check,
      passageIds,
      note:
        check.support === 'supported'
          ? check.note
          : 'The retrieved passages share this subject. They are cited for what they say. A word match does not add a number or a grade that they do not state.',
    };
  }
  return check;
}

function studyPassage(record: StudyHadithRecord, lang: Lang, retrievedAt: string, hash: string): EvidencePassage {
  const narrator = record.text.match(/^\s*Narrated\s+([^:]{2,80}):/i)?.[1]?.trim() ?? null;
  const reference = `${record.collectionName} ${record.number}`;
  const place = [record.book ? `book ${record.book}` : null, record.inBook ? `hadith ${record.inBook}` : null].filter(Boolean).join(', ');
  const editionEnds = !/[.!?…"»]$/.test(record.text.trim());
  const collectionId = record.id.split(':')[0] || 'bukhari';
  return {
    contractVersion: VERSION,
    id: `H${record.id.replace(/[^\dA-Za-z]+/g, '-')}`,
    source: source({
      id: record.id,
      provider: 'hadith-api',
      language: lang,
      edition: `eng-${collectionId}`,
      version: hash,
      title: reference,
      credits: narrator ? [{ role: 'narrator', name: narrator }] : [],
      canonicalUrl: record.url,
      contentType: 'hadith',
      rights: STUDY_RIGHTS,
      retrievedAt,
      contentHash: hash,
    }),
    text: record.text,
    originalLanguage: lang,
    arabic: record.arabic,
    locator: reference,
    context: [
      narrator ? `Narrator: ${narrator}.` : null,
      `Collection reference: ${reference}${place ? ` (${place})` : ''}.`,
      record.section ? `Section: ${record.section}.` : null,
      `Arabic text retrieved from https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${collectionId}/${record.number}.min.json.`,
      editionEnds ? 'The English edition file ends with the wording quoted here. No words were added.' : null,
    ]
      .filter(Boolean)
      .join(' '),
    readerRoute: '#/hadith',
    role: 'source_text',
    publishedGrade: record.grade,
  };
}

function hadithPassage(
  record: HadithRecord,
  lang: Lang,
  retrievedAt: string,
  hash: string,
  role: EvidencePassage['role'] = 'source_text',
): EvidencePassage {
  const edition = `hadeethenc-${lang}`;
  return {
    contractVersion: VERSION,
    id: `E${record.id}`,
    source: source({
      id: record.id,
      provider: 'HadeethEnc',
      language: lang,
      edition,
      version: hash,
      title: record.title,
      credits: [],
      canonicalUrl: record.url,
      contentType: 'hadith',
      rights: HADEETH_RIGHTS,
      retrievedAt,
      contentHash: hash,
    }),
    text: record.text,
    originalLanguage: lang,
    arabic: record.arabic,
    locator: [record.attribution, `HadeethEnc ${record.id}`].filter(Boolean).join('. '),
    context: [
      `Language edition: ${edition}.`,
      record.attribution ? `Collection attribution printed on this edition: ${record.attribution}.` : null,
      record.grade ? `Grade printed on this edition: ${record.grade}. This grade is a transmission judgement, not a legal ruling.` : null,
      record.explanation ? `Publisher explanation on this edition, kept as a legal reading and not as the grade: ${record.explanation}` : null,
    ].filter(Boolean).join(' '),
    readerRoute: `#/hadith/${record.id}?lang=${lang}`,
    role,
    publishedGrade: record.grade,
  };
}

const COUNT_QUESTION = /\bhow many\b|\bnumber of\b|\bhow much\b|எத்தனை|කීයක්|كم/i;

function answerPassages(passages: readonly EvidencePassage[]): EvidencePassage[] {
  const primary = passages.filter(passage => passage.role !== 'empirical' && !passage.context?.startsWith('Neighbouring'));
  const study = primary.filter(passage => passage.source.provider === 'hadith-api');
  const ordered = study.length ? [...study, ...primary.filter(passage => passage.source.provider !== 'hadith-api')] : primary;
  return ordered.slice(0, 8);
}

function passageToEvidence(passage: EvidencePassage): Evidence {
  const kind = passage.source.contentType === 'hadith' ? 'hadith' : passage.source.contentType === 'quran' ? 'quran' : 'guide';
  return {
    id: passage.id,
    kind,
    label: passage.locator,
    arabic: passage.arabic,
    text: passage.text,
    attribution: [passage.source.provider, passage.source.title, passage.publishedGrade ? `Grade: ${passage.publishedGrade}` : '']
      .filter(Boolean)
      .join('. '),
    grades: passage.publishedGrade ? [{ name: passage.source.provider, grade: passage.publishedGrade }] : [],
    locator: passage.locator,
    sourceUrl: passage.source.canonicalUrl,
  };
}

function packetBlob(passages: readonly EvidencePassage[]): string {
  return passages.map(passage => `${passage.locator}\n${passage.id}\n${passage.text}\n${passage.arabic ?? ''}\n${passage.publishedGrade ?? ''}`).join('\n');
}

function inventsNumber(question: string, paragraph: string, packet: string): boolean {
  if (!COUNT_QUESTION.test(question)) return false;
  const compact = packet.replace(/,/g, '');
  for (const match of paragraph.matchAll(/\b\d{1,3}:\d{1,3}\b|\b\d[\d,]*\b/g)) {
    const token = match[0];
    const bare = token.replace(/,/g, '');
    if (bare.length < 2) continue;
    if (packet.includes(token) || compact.includes(bare)) continue;
    return true;
  }
  return false;
}

function passageStatesCount(passages: readonly EvidencePassage[]): boolean {
  return passages.some(passage => {
    const text = `${passage.text}\n${passage.arabic ?? ''}`;
    if (!/prophet|messenger|نبي|أنبياء|انبياء|رسل|رسول/i.test(text)) return false;
    return /\b\d{2,}\b|[\u0660-\u0669]{2,}/.test(text);
  });
}

function acceptWrittenAnswer(
  question: string,
  result: { paragraphs: { text: string; citations: string[] }[]; insufficientEvidence: boolean },
  passages: readonly EvidencePassage[],
  interpretation: QuestionInterpretation,
): ResearchAnswer | null {
  const ids = new Set(passages.map(passage => passage.id));
  const packet = packetBlob(passages);
  const paragraphs = result.paragraphs
    .map(paragraph => ({
      text: paragraph.text.replace(/\s+/g, ' ').trim(),
      citations: [...new Set(paragraph.citations.filter(id => ids.has(id)))],
    }))
    .filter(paragraph => paragraph.text && paragraph.citations.length > 0 && !inventsNumber(question, paragraph.text, packet));
  if (!paragraphs.length) return null;
  const asksStatedTotal = interpretation.kind === 'stated-total' || (interpretation.kind !== 'corpus-count' && COUNT_QUESTION.test(question));
  return {
    paragraphs,
    insufficientEvidence: result.insufficientEvidence || (asksStatedTotal && !passageStatesCount(passages)),
    writer: 'assistant',
  };
}

function splitMentions(
  split: { occurrences: readonly WordingOccurrence[]; campaigns: readonly CampaignGroup[]; unnamed: readonly { surah: number; ayah: number }[] },
  surah: number,
  ayah: number,
): boolean {
  return (
    split.occurrences.some(item => item.surah === surah && item.ayah === ayah) ||
    split.campaigns.some(group => group.verses.some(verse => verse.surah === surah && verse.ayah === ayah)) ||
    split.unnamed.some(verse => verse.surah === surah && verse.ayah === ayah)
  );
}

function groupOccurrenceVerses(items: readonly WordingOccurrence[]): WordingOccurrence[][] {
  const groups = new Map<string, WordingOccurrence[]>();
  for (const item of items) {
    const key = `${item.surah}:${item.ayah}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.values()];
}

function occurrenceSnippet(items: readonly WordingOccurrence[], lang: Lang, retrievedAt: string, hash: string): EvidencePassage {
  const first = items[0];
  const english = items.find(item => item.script === 'english');
  const arabic = items.find(item => item.script === 'arabic');
  const edition = arabic && !english ? 'quran-uthmani' : 'en';
  return {
    contractVersion: VERSION,
    id: `Q${first.surah}-${first.ayah}`,
    source: source({
      id: `${first.surah}:${first.ayah}`,
      provider: 'AlQuran',
      language: lang,
      edition,
      version: null,
      title: `Qur'an ${first.surah}:${first.ayah}`,
      credits: [{ role: 'source', name: 'AlQuran Cloud' }],
      canonicalUrl: `https://api.alquran.cloud/v1/ayah/${first.surah}:${first.ayah}/${edition}`,
      contentType: 'quran',
      rights: ALQURAN_RIGHTS,
      retrievedAt,
      contentHash: hash,
    }),
    text: english?.text || arabic?.text || first.text,
    originalLanguage: arabic && !english ? 'ar' : lang,
    arabic: arabic?.text ?? null,
    locator: `Surah ${first.surah}, ayah ${first.ayah}`,
    context: occurrenceContext(items),
    readerRoute: `#/quran/${first.surah}?ayah=${first.ayah}`,
    role: 'translation',
    publishedGrade: null,
  };
}

function retrievedAnswer(
  question: string,
  passages: readonly EvidencePassage[],
  interpretation: QuestionInterpretation,
): ResearchAnswer {
  const cited = passages.slice(0, 6);
  const asksCount = interpretation.kind === 'stated-total' || (interpretation.kind !== 'corpus-count' && COUNT_QUESTION.test(question));
  const statesCount = asksCount && passageStatesCount(cited);
  const locators = cited.map(passage => passage.locator).join('; ');
  const lead = cited[0];
  const text =
    asksCount && !statesCount
      ? `The retrieved passages do not state a total number. They are cited for what they do say: ${locators}.`
      : `Retrieved: ${locators}. ${lead?.publishedGrade ? `Grade printed by the source: ${lead.publishedGrade}. ` : ''}The source text says: “${lead?.text.trim() ?? ''}”`;
  return {
    paragraphs: [{ text, citations: cited.map(passage => passage.id) }],
    insufficientEvidence: asksCount && !statesCount,
    writer: 'retrieved',
  };
}

function versePassage(verse: VerseRecord, lang: Lang, retrievedAt: string, hash: string): EvidencePassage {
  return {
    contractVersion: VERSION,
    id: `Q${verse.surah}-${verse.ayah}`,
    source: source({
      id: `${verse.surah}:${verse.ayah}`,
      provider: 'QuranEnc',
      language: lang,
      edition: verse.edition,
      version: verse.version,
      title: `Qur'an ${verse.surah}:${verse.ayah}`,
      credits: [{ role: 'translator', name: verse.translator }],
      canonicalUrl: verse.url,
      contentType: 'quran',
      rights: QURAN_RIGHTS,
      retrievedAt,
      contentHash: hash,
    }),
    text: verse.translation,
    originalLanguage: lang,
    arabic: verse.arabic,
    locator: `Surah ${verse.surah}, ayah ${verse.ayah}`,
    context: null,
    readerRoute: `#/quran/${verse.surah}?ayah=${verse.ayah}`,
    role: 'translation',
    publishedGrade: null,
  };
}

function sciencePassage(work: ScienceWork, text: string, retrievedAt: string, hash: string): EvidencePassage {
  const authors = work.authors.join(', ');
  return {
    contractVersion: VERSION,
    id: `S${contentHash(work.id)}`,
    source: source({
      id: work.id,
      provider: 'OpenAlex',
      language: 'en',
      edition: null,
      version: work.year ? String(work.year) : null,
      title: work.title,
      credits: work.authors.map(name => ({ role: 'author', name })),
      canonicalUrl: work.url,
      contentType: 'science',
      rights: SCIENCE_RIGHTS,
      retrievedAt,
      contentHash: hash,
    }),
    text,
    originalLanguage: 'en',
    arabic: null,
    locator: [work.studyType, work.year ? String(work.year) : '', work.doi].filter(Boolean).join(' · '),
    context: authors ? `Authors: ${authors}` : null,
    readerRoute: null,
    role: 'empirical',
    publishedGrade: null,
  };
}
