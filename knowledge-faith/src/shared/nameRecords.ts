import type { AsmaName } from './types.ts';
import type { TermArticle } from './terminology.ts';

export interface NameListEntry {
  id: string;
  arabic: string;
  transliteration: string;
  titleMeaning: string | null;
  aladhanNumber: number | null;
  aladhanMeaning: string | null;
}

export interface NamesCatalogue {
  terminology: { status: 'ok'; count: number; url: string; terms: NameListEntry[] } | { status: 'unavailable'; message: string };
  aladhan: { status: 'ok'; count: number; unmatched: AsmaName[] } | { status: 'unavailable'; message: string };
  languages: { en: string; ta: string; si: string };
  note: string;
  rights: { source: string; conditions: string; generatedWork: boolean; checkedOn: string };
}

export interface NameDetail {
  id: string;
  arabic: string;
  transliteration: string;
  titleMeaning: string | null;
  aladhan: { number: number; transliteration: string; meaning: string } | null;
  transliterationsDiffer: boolean;
  article: TermArticle;
  canonicalUrl: string;
  retrievedAt: string;
  contentHash: string;
  index: 'fresh' | 'updated' | 'new';
  rights: { source: string; conditions: string; generatedWork: boolean; checkedOn: string };
  commentaryNote: string;
}
