import { randomUUID } from 'node:crypto';
import type {
  CoverageNote,
  EvidencePassage,
  ResearchDossierView,
  ResearchJobView,
  ResearchSubquestion,
  SourceRecord,
} from '../../shared/contracts/v1.ts';
import type { Lang } from '../../shared/sources.ts';
import { contentTokens, passageSupportsTopic } from '../../shared/research.ts';
import { verifyClaim } from '../../shared/research/claims.ts';
import { asksScience, decomposeQuestion } from '../../shared/research/decompose.ts';
import { ayahsMentioned } from '../../shared/research.ts';
import { ISLAMHOUSE_RIGHTS } from '../../shared/sourceRegistry.ts';
import { UpstreamError } from '../http.ts';
import { contentHash, createContentIndex, type ContentIndex } from './contentIndex.ts';
import type { ScienceWork } from './science.ts';

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

export interface ResearchPorts {
  searchHadeeth(lang: Lang, phrase: string, page: number, signal: AbortSignal): Promise<HadithHit[]>;
  loadHadeeth(lang: Lang, id: string, signal: AbortSignal): Promise<HadithRecord>;
  getVerses(refs: { surah: number; ayah: number }[], lang: Lang, signal: AbortSignal): Promise<VerseRecord[]>;
  searchScience(query: string, signal: AbortSignal): Promise<ScienceWork[] | 'not_configured'>;
  suggestSearch?(
    question: string,
    lang: Lang,
    signal: AbortSignal,
  ): Promise<{ available: boolean; failed: boolean; phrases: string[]; ayahs: { surah: number; ayah: number }[] }>;
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
}): Promise<ResearchRun> {
  const signal = input.signal ?? new AbortController().signal;
  const index = input.index ?? createContentIndex();
  const clock = input.now ?? (() => new Date());
  const started = clock();
  const startedMs = started.getTime();
  const calls: Record<string, number> = {};
  const timings: Record<string, number> = {};
  const coverage: CoverageNote[] = [];
  const errors: { provider: string; message: string }[] = [];
  const passages: EvidencePassage[] = [];
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
    const claims = plan.subquestions.map(sub => claimFor(sub, passages, coverage));
    const unresolved = claims.filter(claim => claim.support !== 'supported').map(claim => `${claim.claim} — ${claim.note}`);
    if (status === 'cancelled') unresolved.unshift('The research job was cancelled. Any passages below are partial.');
    return {
      job,
      dossier: {
        contractVersion: VERSION,
        jobId: job.id,
        passages,
        claims,
        unresolved,
        disagreements: [],
        verificationNote:
          'Citation existence, quotation fidelity and claim support are checked separately. A citation id alone is not support. This is not a scholarly verdict and not a claim of complete coverage.',
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
    if (clock().getTime() - startedMs > BUDGET.timeMs) {
      pushCoverage({ kind: 'budget_exhausted', provider, detail: 'The time budget ended before every planned request ran.' });
      return false;
    }
    calls[provider] = (calls[provider] ?? 0) + 1;
    if (calls[provider] > BUDGET.callsPerSource) {
      pushCoverage({ kind: 'budget_exhausted', provider, detail: `The per-source request budget (${BUDGET.callsPerSource}) was reached.` });
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
    const queries: { sub: ResearchSubquestion; phrase: string }[] = [];
    for (const sub of plan.subquestions) {
      if (sub.domain === 'science' || asksScience(sub.text)) continue;
      for (const phrase of sub.queries) {
        if (queries.length >= BUDGET.queries) break;
        if (!queries.some(item => item.phrase === phrase)) queries.push({ sub, phrase });
      }
    }
    const unprocessed = religious.length > 0 && queries.length === 0;
    if (unprocessed) {
      pushCoverage({
        kind: 'no_relevant_evidence',
        provider: 'planner',
        detail: `We could not process the question. It is still here: ${input.question}`,
      });
    }
    publish('search', 2);
    const hits: (HadithHit & { subId: string })[] = [];
    for (const query of queries) {
      if (!allow('HadeethEnc')) break;
      try {
        const rows = await timed('HadeethEnc', () => attempt(() => input.ports.searchHadeeth(input.language, query.phrase, 1, signal), signal));
        if (!rows.length) {
          pushCoverage({
            kind: 'no_relevant_evidence',
            provider: 'HadeethEnc',
            detail: `Search returned no records for “${query.phrase}”. Other searches still run.`,
          });
        }
        for (const row of rows) {
          if (!hits.some(hit => hit.id === row.id)) hits.push({ ...row, subId: query.sub.id });
        }
      } catch (err) {
        if (isAbort(err, signal)) return finish('cancelled');
        const message = err instanceof Error ? err.message : 'HadeethEnc search failed.';
        errors.push({ provider: 'HadeethEnc', message });
        pushCoverage({
          kind: 'source_unavailable',
          provider: 'HadeethEnc',
          detail: `A source could not be reached. HadeethEnc search failed: ${message} This is not a finding that the subject is absent.`,
        });
        continue;
      }
    }

    const perSub = Math.max(1, Math.floor(BUDGET.opens / Math.max(1, religious.length)));
    const chosen: HadithHit[] = [];
    let unseen = 0;
    for (const sub of religious) {
      const mine = hits.filter(hit => hit.subId === sub.id && !chosen.some(item => item.id === hit.id));
      const preferred = mine.filter(hit => score(sub.text, hit.title) > 0).sort((a, b) => score(sub.text, b.title) - score(sub.text, a.title));
      const queue = [...preferred, ...mine.filter(hit => !preferred.includes(hit))];
      unseen += Math.max(0, queue.length - perSub);
      for (const hit of queue.slice(0, perSub)) chosen.push(hit);
    }
    if (unseen > 0) {
      pushCoverage({
        kind: 'budget_exhausted',
        provider: 'HadeethEnc',
        detail: `${unseen} search rows were not opened. A title was only used to choose what to open.`,
      });
    }
    publish('read', 3);
    await pool(chosen, BUDGET.concurrency, signal, async hit => {
      if (!allow('HadeethEnc')) return;
      try {
        const record = await timed('HadeethEnc', () => attempt(() => input.ports.loadHadeeth(input.language, hit.id, signal), signal));
        if (!passageSupportsTopic(input.question, record.text) && !plan.subquestions.some(sub => passageSupportsTopic(sub.text, record.text))) {
          pushCoverage({
            kind: 'no_relevant_evidence',
            provider: 'HadeethEnc',
            detail: `HadeethEnc ${record.id} was opened. Its text did not contain a content term from the question, so it is not cited.`,
          });
          return;
        }
        const hash = remember('HadeethEnc', record.id, contentHash(record.text), record.text);
        passages.push(hadithPassage(record, input.language, clock().toISOString(), hash));
      } catch (err) {
        if (isAbort(err, signal)) throw abortError();
        const message = err instanceof Error ? err.message : 'The hadith record could not be opened.';
        const language = /not available/i.test(message);
        errors.push({ provider: 'HadeethEnc', message });
        pushCoverage({
          kind: language ? 'language_unavailable' : 'source_unavailable',
          provider: 'HadeethEnc',
          detail: language
            ? `HadeethEnc ${hit.id} is not available in ${input.language}. Another language was not substituted.`
            : `HadeethEnc ${hit.id} could not be opened: ${message}`,
        });
      }
    });
    if (signal.aborted) return finish('cancelled');

    const namedAyahs = ayahsMentioned(input.question);
    const ayahs = [...namedAyahs];
    for (const ayah of suggestedAyahs) {
      if (ayahs.length >= 6) break;
      if (!ayahs.some(item => item.surah === ayah.surah && item.ayah === ayah.ayah)) ayahs.push(ayah);
    }
    const namedKeys = new Set(namedAyahs.map(ayah => `${ayah.surah}:${ayah.ayah}`));
    if (ayahs.length && allow('QuranEnc')) {
      try {
        const verses = await timed('QuranEnc', () => attempt(() => input.ports.getVerses(ayahs, input.language, signal), signal));
        const found = new Set(verses.map(verse => `${verse.surah}:${verse.ayah}`));
        for (const verse of verses) {
          const key = `${verse.surah}:${verse.ayah}`;
          const named = namedKeys.has(key);
          const verseText = `${verse.arabic}\n${verse.translation}`;
          if (!named && !passageSupportsTopic(input.question, verseText) && !plan.subquestions.some(sub => passageSupportsTopic(sub.text, verseText))) {
            pushCoverage({
              kind: 'no_relevant_evidence',
              provider: 'QuranEnc',
              detail: `Qur’an ${key} was opened. Its wording did not share a content term with the question, so it is not cited.`,
            });
            continue;
          }
          const hash = remember('QuranEnc', key, verse.version ?? contentHash(verse.translation), verse.translation);
          passages.push(versePassage(verse, input.language, clock().toISOString(), hash));
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

    const scienceQuestions = plan.subquestions.filter(sub => sub.domain === 'science' || asksScience(sub.text));
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
    } else if (!coverage.some(note => note.kind === 'source_unavailable' || note.kind === 'science_not_configured' || note.kind === 'language_unavailable')) {
      pushCoverage({
        kind: 'no_relevant_evidence',
        provider: 'dossier',
        detail: `Available evidence does not sufficiently support an answer. Your question is still here: ${input.question}`,
      });
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

function claimFor(sub: ResearchSubquestion, passages: EvidencePassage[], coverage: CoverageNote[]) {
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
  const related = passages.filter(item => item.role !== 'empirical' && passageSupportsTopic(sub.text, item.text));
  if (!related.length) {
    return {
      claim: sub.text,
      passageIds: [] as string[],
      support: 'insufficient' as const,
      citationExists: false,
      quotationFaithful: null,
      citationRelevant: false,
      note: coverage.some(note => note.kind === 'source_unavailable')
        ? 'A source could not be reached, so this part was not fully checked.'
        : 'Available evidence does not sufficiently support an answer to this part of the question.',
    };
  }
  const best = [...related].sort((a, b) => score(sub.text, b.text) - score(sub.text, a.text))[0];
  return verifyClaim(sub.text, best.id, related.map(item => ({ id: item.id, text: item.text })));
}

function hadithPassage(record: HadithRecord, lang: Lang, retrievedAt: string, hash: string): EvidencePassage {
  return {
    contractVersion: VERSION,
    id: `E${record.id}`,
    source: source({
      id: record.id,
      provider: 'HadeethEnc',
      language: lang,
      edition: null,
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
    context: record.explanation ? `HadeethEnc explanation on this record: ${record.explanation}` : null,
    readerRoute: `#/hadith/${record.id}?lang=${lang}`,
    role: 'source_text',
    publishedGrade: record.grade,
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
