import type { Lang } from '../../shared/sources.ts';
import { decomposeQuestion } from '../../shared/research/decompose.ts';

export interface CatalogueHit {
  id: string;
  title: string;
}

export interface CatalogueRecord {
  id: string;
  title: string;
  text: string;
  arabic: string | null;
  grade: string | null;
  attribution: string | null;
  explanation: string | null;
  lessons: string[];
  url: string;
}

export interface OpenedCatalogueRecord extends CatalogueRecord {
  role: 'candidate';
}

/** At most two shorter phrases from the question’s own queries. No fixed catalogue ids. */
export function boundedRecoveryPhrases(queries: readonly string[]): string[] {
  const next: string[] = [];
  for (const query of queries) {
    const words = query.split(/\s+/).filter(Boolean);
    if (words.length > 3) next.push(words.slice(0, 3).join(' '));
    if (words.length > 1) next.push(words[words.length - 1]);
  }
  return [...new Set(next)].filter(phrase => phrase.length >= 3 && !queries.includes(phrase)).slice(0, 2);
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * The Hadith page and Knowledge share this opener.
 * The question’s own words are searched first. If that search is empty, at most two shorter phrases from those words are tried.
 * A thrown search is a provider failure and stops the reformulation. Record ids are never chosen in advance.
 */
export async function openHadeethEncForQuestion(input: {
  question: string;
  language: Lang;
  seeds?: readonly string[];
  /** Queries already chosen for this job. When omitted, they are read from the question. */
  queries?: readonly string[];
  search: (language: Lang, phrase: string) => Promise<CatalogueHit[]>;
  load: (language: Lang, id: string) => Promise<CatalogueRecord | null>;
}): Promise<{
  queries: string[];
  recovery: string[];
  records: OpenedCatalogueRecord[];
  errors: { provider: string; message: string }[];
  providerFailed: boolean;
}> {
  const plan = decomposeQuestion(input.question);
  const queries = [...new Set((input.queries ?? plan.subquestions.flatMap(item => item.queries)).map(item => item.trim()).filter(Boolean))].slice(0, 8);
  if (!queries.length && input.question.trim().length >= 3) queries.push(input.question.trim().slice(0, 80));
  const errors: { provider: string; message: string }[] = [];
  const hits: (CatalogueHit & { phrase: string })[] = [];
  let providerFailed = false;

  const searched = await Promise.all(queries.map(async phrase => {
    try {
      const found = await input.search(input.language, phrase.slice(0, 100));
      return { phrase, found };
    } catch (err) {
      if (isAbort(err)) throw err;
      errors.push({ provider: 'HadeethEnc', message: err instanceof Error ? err.message : 'HadeethEnc search failed.' });
      return { phrase, found: null as CatalogueHit[] | null };
    }
  }));
  if (searched.length > 0 && searched.every(item => item.found === null)) providerFailed = true;
  for (const batch of searched) {
    if (!batch.found) continue;
    for (const hit of batch.found) {
      if (!hits.some(item => item.id === hit.id)) hits.push({ ...hit, phrase: batch.phrase });
    }
  }

  const recovery: string[] = [];
  if (!providerFailed && hits.length === 0) {
    for (const phrase of boundedRecoveryPhrases(queries)) {
      recovery.push(phrase);
      try {
        const found = await input.search(input.language, phrase.slice(0, 100));
        for (const hit of found) {
          if (!hits.some(item => item.id === hit.id)) hits.push({ ...hit, phrase });
        }
      } catch (err) {
        if (isAbort(err)) throw err;
        providerFailed = true;
        errors.push({ provider: 'HadeethEnc', message: err instanceof Error ? err.message : 'HadeethEnc search failed.' });
        break;
      }
    }
  }

  const ids: string[] = [];
  const cap = 8;
  const push = (id: string) => {
    if (id && !ids.includes(id) && ids.length < cap) ids.push(id);
  };
  for (const id of input.seeds ?? []) push(id);
  const groups = [...queries, ...recovery].map(phrase => hits.filter(hit => hit.phrase === phrase));
  for (let round = 0; ids.length < cap; round += 1) {
    let added = false;
    for (const group of groups) {
      const hit = group[round];
      if (!hit) continue;
      const before = ids.length;
      push(hit.id);
      if (ids.length !== before) added = true;
    }
    if (!added) break;
  }

  const records: OpenedCatalogueRecord[] = [];
  if (!providerFailed || ids.length) {
    const loaded = await Promise.all(ids.map(async id => {
      try {
        const row = await input.load(input.language, id);
        return row ? { ...row, lessons: row.lessons ?? [], role: 'candidate' as const } : null;
      } catch (err) {
        if (isAbort(err)) throw err;
        errors.push({
          provider: 'HadeethEnc',
          message: err instanceof Error ? err.message : `HadeethEnc ${id} could not be opened.`,
        });
        return null;
      }
    }));
    for (const row of loaded) {
      if (row) records.push(row);
    }
  }

  return {
    queries,
    recovery,
    records,
    errors,
    providerFailed: providerFailed && records.length === 0,
  };
}
