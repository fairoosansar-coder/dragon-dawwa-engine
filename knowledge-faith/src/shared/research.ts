import type { Lang } from './sources.ts';
import { SOURCE_CHECK_DATE } from './sourceRegistry.ts';
import type { Evidence, PodcastLine, PodcastScript } from './types.ts';

export interface ResearchReference {
  id: string;
  provider: 'IslamHouse' | 'QuranEnc' | 'HadeethEnc';
  itemId: string;
  title: string;
  authors: string[];
  translators: string[];
  version: string | null;
  passage: string;
  passageLanguage: string;
  arabic: string | null;
  locator: string;
  /** Never invented. Reflow text uses `locator` instead of a page number. */
  printedPage: null;
  pdfPage: null;
  surah: number | null;
  ayah: number | null;
  hadithId: string | null;
  collection: string | null;
  grade: string | null;
  url: string;
  retrievedOn: string;
  claim: string;
  limitations: string[];
}

export interface ResearchDossier {
  topic: string;
  questions: string[];
  lang: Lang;
  examined: string[];
  notExamined: string[];
  references: ResearchReference[];
  /** Opened, then left uncited because the text was not support for the question. */
  retrievedNotCited: { itemId: string; title: string; reason: string }[];
  unanswered: string[];
  disagreements: string[];
}

export interface ScriptVerification {
  supported: boolean;
  missingCitations: string[];
  unfaithful: string[];
}

const SCIENCE = /\b(scientific proof|science proves|physics|biology|chemistry|medicine|medical|evolution)\b/i;

export function asksForScience(text: string): boolean {
  return SCIENCE.test(text);
}

export function isIntentionTopic(text: string): boolean {
  return /intention|intentions|habit|sincer|ikhlas|purity|உளத்தூய்|நோக்க/i.test(text);
}

export function isPrayerTopic(text: string): boolean {
  return /prayer|salah|தொழுகை|475013/i.test(text);
}

export function ayahsMentioned(text: string): { surah: number; ayah: number }[] {
  const found: { surah: number; ayah: number }[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/(?:^|[^\d])(\d{1,3})\s*:\s*(\d{1,3})(?!\d)/g)) {
    const surah = Number(match[1]);
    const ayah = Number(match[2]);
    if (surah < 1 || surah > 114 || ayah < 1 || ayah > 286) continue;
    const key = `${surah}:${ayah}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ surah, ayah });
  }
  return found;
}

export function referenceEvidence(reference: ResearchReference): Evidence {
  const kind = reference.provider === 'QuranEnc' ? 'quran' : reference.provider === 'HadeethEnc' ? 'hadith' : 'guide';
  return {
    id: reference.id,
    kind,
    label: `${reference.provider} ${reference.itemId}`,
    arabic: reference.arabic,
    text: reference.passage,
    attribution: [
      reference.title,
      reference.authors.length ? `Author: ${reference.authors.join('; ')}` : '',
      reference.translators.length ? `Translator: ${reference.translators.join('; ')}` : '',
      reference.version ? `Version: ${reference.version}` : '',
      reference.locator,
      reference.grade ? `Grade: ${reference.grade}` : '',
      reference.url,
      `Retrieved ${reference.retrievedOn}`,
      ...reference.limitations,
    ]
      .filter(Boolean)
      .join('. '),
    grades: reference.grade ? [{ name: reference.provider, grade: reference.grade }] : [],
    locator: reference.locator,
    sourceUrl: reference.url,
    passageLanguage: reference.passageLanguage,
    retrievedOn: reference.retrievedOn,
    itemId: reference.itemId,
    limitations: reference.limitations,
  };
}

export function sameAyahDisagreements(references: ResearchReference[]): string[] {
  const groups = new Map<string, ResearchReference[]>();
  for (const reference of references) {
    if (!reference.surah || !reference.ayah) continue;
    const key = `${reference.surah}:${reference.ayah}`;
    groups.set(key, [...(groups.get(key) ?? []), reference]);
  }
  const notes: string[] = [];
  for (const [key, group] of groups) {
    const wordings = new Set(group.map(item => item.passage.replace(/\s+/g, ' ').trim()));
    if (group.length > 1 && wordings.size > 1) {
      notes.push(`Qur’an ${key} has more than one retrieved wording: ${group.map(item => item.provider + ' ' + item.itemId).join('; ')}.`);
    }
  }
  return notes;
}

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function quotations(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/[“"]([^”"]{12,})[”"]/g)) found.push(compact(match[1] ?? ''));
  return found.filter(Boolean);
}

/** A line may cite only passages that contain its quotation. A substantive line needs a citation. */
export function verifyScript(lines: PodcastLine[], evidence: Evidence[]): ScriptVerification {
  const byId = new Map(evidence.map(item => [item.id, item]));
  const missingCitations: string[] = [];
  const unfaithful: string[] = [];
  lines.forEach((line, index) => {
    const text = compact(line.text);
    if (!text) return;
    const citations = line.citations.filter(id => byId.has(id));
    const substantive = text.length > 40;
    if (substantive && citations.length === 0) missingCitations.push(`Line ${index + 1}`);
    const quoted = quotations(text);
    if (!quoted.length) return;
    const passages = citations.map(id => compact(byId.get(id)?.text ?? ''));
    for (const quote of quoted) {
      if (!passages.some(passage => passage.includes(quote))) unfaithful.push(`Line ${index + 1}`);
    }
  });
  return {
    supported: missingCitations.length === 0 && unfaithful.length === 0,
    missingCitations,
    unfaithful,
  };
}

export function emptyDossier(topic: string, questions: string[], lang: Lang): ResearchDossier {
  return {
    topic,
    questions,
    lang,
    examined: [],
    notExamined: [
      'The IslamHouse service catalogue was used as a directory, not as the text of every listed service.',
      'Categories 768, 769 and 795 were not read beyond the pages recorded in the source registry.',
      'terminologyenc.com, saadi.islamenc.com and kids.islamenc.com are not retrieval hosts for this researcher.',
      'GitHub data repositories under IslamHouse-API were not downloaded.',
    ],
    references: [],
    retrievedNotCited: [],
    unanswered: [],
    disagreements: [],
  };
}

export const SEARCH_RANK_LIMIT =
  'Search rank is not evidence that this is the narration the question names. English “intentions” has ranked another hadith ahead of 4560.';

/** A search row is citable only when the opened text contains a topic word of at least four characters. */
export function searchHitSupports(topic: string, title: string, text: string): boolean {
  const token = topic.toLowerCase().split(/[^\p{L}\p{N}]+/u).find(part => part.length >= 4);
  if (!token) return false;
  return `${title}\n${text}`.toLowerCase().includes(token);
}

export function checkedOn(): string {
  return SOURCE_CHECK_DATE;
}

export function attachVerification(script: PodcastScript, verification: ScriptVerification, unanswered: string[]): PodcastScript & {
  verification: ScriptVerification;
  unanswered: string[];
} {
  return { ...script, verification, unanswered };
}
