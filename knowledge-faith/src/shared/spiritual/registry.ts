import type { Lang } from '../sources.ts';
import type { Grade, Hadith, Verse } from '../types.ts';
import { ALL_GUIDES, DUAS, TOPICS } from './catalog.ts';
import { OCCASIONS } from './calendar.ts';
import { sourceId, type SourceRef } from './sourceRefs.ts';
import { ZAKAH_PROFILES } from './zakah.ts';

/**
 * Every primary text the section cites. The sources endpoint only resolves ids in this registry, so the
 * section cannot be used to proxy arbitrary upstream requests and conventional numbering is never lost.
 */
export const SOURCE_REGISTRY: ReadonlyMap<string, SourceRef> = new Map(
  [
    ...TOPICS.flatMap(t => t.sources),
    ...ALL_GUIDES.flatMap(g => g.guide.sources),
    ...DUAS.map(d => d.source),
    ...OCCASIONS.flatMap(o => o.evidence),
    ...ZAKAH_PROFILES.flatMap(p => p.sources),
  ].map(s => [sourceId(s), s] as const),
);

/**
 * Translator names as declared by hadith-api's editions index. Editions without a declared translator are
 * labelled with the edition id rather than a guessed name.
 */
const HADITH_TRANSLATORS: Record<string, string> = {
  'eng-bukhari': 'Muhsin Khan',
  'eng-muslim': 'Abdul Hamid Siddiqui',
};

export function hadithTranslationLabel(collection: string, lang: Lang): string {
  const edition = `${lang === 'ta' ? 'tam' : 'eng'}-${collection}`;
  const translator = HADITH_TRANSLATORS[edition];
  return translator ? `${translator} (hadith-api ${edition})` : `hadith-api ${edition}; translator not named by the edition`;
}

export interface ResolvedSource {
  id: string;
  ref: SourceRef;
  /** Requested reading language. */
  lang: Lang;
  verses?: Verse[];
  hadith?: Hadith & { translation: string };
  /** The requested language has no translation in the named editions, so another language is shown. */
  fallback: boolean;
  /** The text could not be retrieved right now. */
  unavailable: boolean;
  grades: Grade[];
}
