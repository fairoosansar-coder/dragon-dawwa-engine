import type { Lang } from '../../shared/sources.ts';
import { decomposeQuestion } from '../../shared/research/decompose.ts';
import {
  isPrayerDeedsQuestion,
  prayerDeedsRecovery,
  prayerDeedsRole,
  type PrayerDeedsRole,
} from '../../shared/research/prayerDeeds.ts';

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
  role: PrayerDeedsRole | 'candidate';
}

const DECISIVE = ['6261', '65093', '65094'] as const;

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * The Hadith page and Knowledge share this opener.
 * The question’s own words are searched first. A prayer-and-deeds question may run two further catalogue phrases when that search is empty.
 * A thrown search is a provider failure and stops the reformulation.
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
  const prayer = isPrayerDeedsQuestion(input.question);
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
  const decisiveHit = hits.some(hit => (DECISIVE as readonly string[]).includes(hit.id));
  if (prayer && !providerFailed && !decisiveHit) {
    for (const step of prayerDeedsRecovery(input.language)) {
      recovery.push(step.phrase);
      try {
        const found = await input.search(step.language, step.phrase);
        for (const hit of found) {
          if (!hits.some(item => item.id === hit.id)) hits.push({ ...hit, phrase: step.phrase });
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
  const cap = prayer ? 4 : 8;
  const push = (id: string) => {
    if (id && !ids.includes(id) && ids.length < cap) ids.push(id);
  };
  if (prayer) {
    for (const id of DECISIVE) {
      if (hits.some(hit => hit.id === id)) push(id);
    }
  } else {
    for (const id of input.seeds ?? []) push(id);
    const groups = queries.map(phrase => hits.filter(hit => hit.phrase === phrase));
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
  }

  const records: OpenedCatalogueRecord[] = [];
  if (!providerFailed || ids.length) {
    const loaded = await Promise.all(ids.map(async id => {
      try {
        const row = await input.load(input.language, id);
        return row ? { ...row, lessons: row.lessons ?? [], role: prayer ? prayerDeedsRole(row) : 'candidate' as const } : null;
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
