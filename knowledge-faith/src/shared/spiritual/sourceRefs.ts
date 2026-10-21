/**
 * Pointers to primary texts. The text itself is always fetched from the named edition at read time,
 * so the app never stores or retypes scripture.
 */
export type SourceRef = QuranSource | HadithSource;

export interface QuranSource {
  kind: 'quran';
  /** "9:60" or a range "2:183-185". */
  ref: string;
}

export interface HadithSource {
  kind: 'hadith';
  collection: string;
  /** Number in the hadith-api (fawazahmed0) edition, which is what the app fetches. */
  number: number;
  /**
   * Conventional reference when it differs from the hadith-api number, e.g. Sahih Muslim uses
   * sequential numbers in hadith-api but most printed works cite Muhammad Fu'ad Abd al-Baqi's numbering.
   */
  conventional?: { number: string; system: string };
}

export const q = (ref: string): QuranSource => ({ kind: 'quran', ref });
export const h = (collection: string, number: number, conventional?: string): HadithSource => ({
  kind: 'hadith',
  collection,
  number,
  ...(conventional ? { conventional: { number: conventional, system: "Abd al-Baqi" } } : {}),
});

export function sourceId(s: SourceRef): string {
  return s.kind === 'quran' ? `q:${s.ref}` : `h:${s.collection}:${s.number}`;
}

export function parseSourceId(id: string): SourceRef | null {
  const quran = /^q:(\d{1,3}:\d{1,3}(?:-\d{1,3})?)$/.exec(id);
  if (quran) return q(quran[1]);
  const hadith = /^h:([a-z]+):(\d{1,5})$/.exec(id);
  if (hadith) return h(hadith[1], Number(hadith[2]));
  return null;
}
