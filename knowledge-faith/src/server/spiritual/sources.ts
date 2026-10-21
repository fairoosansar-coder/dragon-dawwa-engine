import type { Lang } from '../../shared/sources.ts';
import { parseRefs } from '../../shared/refs.ts';
import { hadithTranslationLabel, SOURCE_REGISTRY, type ResolvedSource } from '../../shared/spiritual/registry.ts';
import type { Hadith, Verse } from '../../shared/types.ts';
import type { SourceFetchers } from '../gemini.ts';

export const MAX_SOURCES_PER_REQUEST = 24;

/** Resolves registry ids to texts from the named editions. Unknown ids are dropped. */
export async function resolveSources(ids: string[], lang: Lang, fetchers: SourceFetchers): Promise<ResolvedSource[]> {
  const unique = [...new Set(ids)].filter(id => SOURCE_REGISTRY.has(id)).slice(0, MAX_SOURCES_PER_REQUEST);
  return Promise.all(
    unique.map(async (id): Promise<ResolvedSource> => {
      const ref = SOURCE_REGISTRY.get(id)!;
      const base = { id, ref, lang, fallback: false, unavailable: false, grades: [] };
      if (ref.kind === 'quran') {
        const verses: Verse[] = await fetchers.verses(parseRefs(ref.ref), lang).catch(() => []);
        return verses.length ? { ...base, verses } : { ...base, unavailable: true };
      }
      let hadith: Hadith | null = await fetchers.hadith(ref, lang).catch(() => null);
      // Some Tamil entries are empty upstream; fall back to English and say so.
      if (!hadith && lang !== 'en') hadith = await fetchers.hadith(ref, 'en').catch(() => null);
      if (!hadith) return { ...base, unavailable: true };
      return {
        ...base,
        hadith: { ...hadith, translation: hadithTranslationLabel(ref.collection, hadith.lang) },
        fallback: hadith.lang !== lang,
        grades: hadith.grades,
      };
    }),
  );
}
