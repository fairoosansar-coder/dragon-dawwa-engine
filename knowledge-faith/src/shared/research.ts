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
  /** True only when every substantive line is a cited passage or a faithful quotation of one. */
  supported: boolean;
  missingCitations: string[];
  /** Quoted text that is not in a cited passage. */
  unfaithful: string[];
  /** A citation was present, but the line is not established as that passage. */
  unverified: string[];
  /** Quotation matching is not a scholarly verdict. */
  review: 'editorial';
  note: string;
}

export const VERIFICATION_NOTE =
  'This check matches citations and quotations to retrieved passages. It does not decide that a paraphrase is true. A human editor reviews the episode before publication.';

/** Explicit retrieval limits. A run that stops here has not read the rest of any library. */
export const RESEARCH_BUDGET = {
  ayahs: 12,
  hadeethPages: 2,
  hadeethOpensPerPage: 3,
  islamhousePages: 2,
  islamhouseOpens: 2,
  categories: 2,
} as const;

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

/**
 * Two published wordings of the same ayah are kept as separate passages.
 * A difference in wording is not recorded as scholarly disagreement.
 */
export function sameAyahDisagreements(references: ResearchReference[]): string[] {
  void references;
  return [];
}

const LATIN_STOP = new Set([
  'what', 'when', 'where', 'which', 'that', 'this', 'with', 'from', 'your', 'have', 'been', 'were', 'they', 'them',
  'their', 'about', 'into', 'does', 'will', 'would', 'could', 'should', 'there', 'these', 'those', 'than', 'then',
  'some', 'such', 'only', 'also', 'just', 'more', 'most', 'other', 'another', 'because', 'while', 'after', 'before',
  'under', 'over', 'between', 'through', 'during', 'without', 'within', 'using', 'used', 'make', 'made', 'like',
  'very', 'really', 'please', 'explain', 'tell', 'the', 'and', 'for', 'are', 'was', 'not', 'but', 'you', 'all',
  'can', 'had', 'her', 'his', 'its', 'our', 'out', 'who', 'how', 'why', 'any', 'may', 'did', 'get', 'got', 'everyday',
]);

const TAMIL_STOP = new Set([
  'என்றால்', 'என்ன', 'என்பது', 'ஒரு', 'இந்த', 'அந்த', 'மற்றும்', 'உள்ள', 'இல்லை', 'என்று', 'ஆகும்', 'உள்ளது',
  'பற்றிய', 'குறித்து', 'என்பதை', 'என்ற', 'அவர்', 'அவர்கள்', 'இது', 'அது',
]);

const SINHALA_STOP = new Set([
  'මොකක්ද', 'කුමක්', 'කුමක්ද', 'යනු', 'සහ', 'හෝ', 'එය', 'මෙය', 'පිළිබඳ', 'ගැන', 'වේ', 'නම්',
]);

/** Content words with generic question words removed. Works for English, Tamil, and Sinhala letters. */
export function contentTokens(text: string): string[] {
  const parts = text.toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const tamil = /[\u0B80-\u0BFF]/.test(part);
    const sinhala = /[\u0D80-\u0DFF]/.test(part);
    if (tamil) {
      if (part.length < 3 || TAMIL_STOP.has(part)) continue;
    } else if (sinhala) {
      if (part.length < 3 || SINHALA_STOP.has(part)) continue;
    } else if (part.length < 4 || LATIN_STOP.has(part)) continue;
    if (seen.has(part)) continue;
    seen.add(part);
    tokens.push(part);
  }
  return tokens;
}

/** A passage supports a topic when its own text contains a distinctive content term. Titles are ignored. */
export function passageSupportsTopic(topic: string, passage: string): boolean {
  const tokens = contentTokens(topic);
  const distinctive = tokens.filter(token => token.length >= 5 || /[\u0B80-\u0BFF\u0D80-\u0DFF]/.test(token));
  const usable = distinctive.length ? distinctive : tokens;
  if (!usable.length) return false;
  const haystack = passage.toLocaleLowerCase('en');
  return usable.some(token => haystack.includes(token));
}

export function searchPhrase(text: string): string {
  return contentTokens(text).slice(0, 8).join(' ').slice(0, 80);
}

/** Name the question whose own wording appears in the passage. A title is never the passage. */
export function claimAddressed(questions: string[], topic: string, passage: string): string {
  const matched = questions.find(question => contentTokens(question).length > 0 && passageSupportsTopic(question, passage));
  if (matched) return `Retrieved for the question: ${matched}`;
  return `Retrieved for the topic: ${topic}`;
}

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['“', '”'],
  ['«', '»'],
  ['「', '」'],
  ['『', '』'],
  ['„', '“'],
  ['"', '"'],
  ['‘', '’'],
];

function quotations(text: string): string[] {
  const found: string[] = [];
  for (const [open, close] of QUOTE_PAIRS) {
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(open, from);
      if (start < 0) break;
      const end = text.indexOf(close, start + open.length);
      if (end < 0) break;
      const quote = compact(text.slice(start + open.length, end));
      if (quote.length >= 8) found.push(quote);
      from = end + close.length;
    }
  }
  return found;
}

const FRAMING = new Set([
  'the', 'book', 'says', 'said', 'say', 'in', 'this', 'section', 'passage', 'source', 'according', 'to', 'here',
  'we', 'read', 'that', 'a', 'an', 'of', 'and', 'its', 'it', 'is', 'as', 'for', 'from', 'on', 'by', 'host',
  'records', 'recorded', 'writes', 'wrote', 'states', 'stated', 'under', 'heading', 'verse', 'ayah', 'hadith',
]);

const ACKNOWLEDGEMENT = /^(yes|no|ok|okay|hello|welcome|thanks|thank you)\.?$/i;

function isSubstantive(text: string): boolean {
  if (!text || ACKNOWLEDGEMENT.test(text)) return false;
  if (quotations(text).length > 0) return true;
  return text.length >= 12 || contentTokens(text).length > 0;
}

function framingOnly(text: string): boolean {
  const tokens = text.toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.length > 0 && tokens.every(token => FRAMING.has(token) || LATIN_STOP.has(token));
}

function lineEstablished(text: string, passages: string[]): boolean {
  const compactLine = compact(text);
  if (passages.some(passage => passage.includes(compactLine) || compactLine.includes(passage))) return true;
  let residue = text;
  for (const quote of quotations(text)) residue = residue.replace(quote, ' ');
  residue = residue.replace(/[“”«»「」『』„"‘’]/g, ' ');
  const compactResidue = compact(residue);
  if (!compactResidue || framingOnly(compactResidue)) return true;
  return passages.some(passage => passage.includes(compactResidue));
}

/**
 * Citation presence, quotation fidelity, and claim support are separate.
 * A valid citation id does not make an unrelated or contradictory paraphrase supported.
 * Where the line is not the retrieved passage, the line stays unverified for a human editor.
 */
export function verifyScript(lines: PodcastLine[], evidence: Evidence[]): ScriptVerification {
  const byId = new Map(evidence.map(item => [item.id, item]));
  const missingCitations: string[] = [];
  const unfaithful: string[] = [];
  const unverified: string[] = [];
  lines.forEach((line, index) => {
    const text = compact(line.text);
    if (!isSubstantive(text)) return;
    const label = `Line ${index + 1}`;
    const citations = line.citations.filter(id => byId.has(id));
    if (citations.length === 0) {
      missingCitations.push(label);
      return;
    }
    const passages = citations.map(id => compact(byId.get(id)?.text ?? '')).filter(Boolean);
    const quoted = quotations(text);
    const quoteFails = quoted.some(quote => !passages.some(passage => passage.includes(quote)));
    if (quoteFails) unfaithful.push(label);
    if (!quoteFails && !lineEstablished(text, passages)) unverified.push(label);
  });
  return {
    supported: missingCitations.length === 0 && unfaithful.length === 0 && unverified.length === 0,
    missingCitations,
    unfaithful,
    unverified,
    review: 'editorial',
    note: VERIFICATION_NOTE,
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
      'terminologyenc.com, saadi.islamenc.com and kids.islamenc.com are not retrieval hosts for this researcher.',
      'GitHub data repositories under IslamHouse-API were not downloaded.',
      'HadeethEnc category trees were not walked. Search uses the phrase API only, and only for the pages this run records.',
    ],
    references: [],
    retrievedNotCited: [],
    unanswered: [],
    disagreements: [],
  };
}

export const SEARCH_RANK_LIMIT =
  'Search rank is not evidence that this is the narration the question names. English “intentions” has ranked another hadith ahead of 4560.';

/** A search row is citable only when the opened passage contains a content term. The title is not evidence. */
export function searchHitSupports(topic: string, title: string, text: string): boolean {
  void title;
  return passageSupportsTopic(topic, text);
}

export function retrievalTimestamp(now = new Date()): string {
  return now.toISOString();
}

export interface PlannedCategory {
  kind: 'knowledge' | 'worship';
  id: string;
  reason: string;
}

export interface ResearchPlan {
  science: boolean;
  searchPhrase: string;
  categories: PlannedCategory[];
  notExamined: string[];
}

/** Choose a bounded set of catalogues. This does not open them and does not treat a title as evidence. */
export function planResearch(topic: string, questions: string[]): ResearchPlan {
  const blob = [topic, ...questions].join('\n');
  const categories: PlannedCategory[] = [];
  const notExamined: string[] = [];
  if (isPrayerTopic(blob)) {
    categories.push({
      kind: 'worship',
      id: 'prayer',
      reason: 'Prayer terms. Tamil item 475013 is requested by id. An empty prayer category is not treated as absence.',
    });
  }
  if (/prophet|seerah|biography|சீரா|නබි/i.test(blob)) {
    categories.push({ kind: 'knowledge', id: 'prophet', reason: 'Category 795, one page. The rest of that category was not opened.' });
  }
  if (/beginner|discover|introduc|non-muslim/i.test(blob)) {
    categories.push({ kind: 'knowledge', id: 'discover', reason: 'Category 768, one page.' });
  }
  if (/deepen|new muslim/i.test(blob)) {
    categories.push({ kind: 'knowledge', id: 'deepen', reason: 'Category 769, one page.' });
  }
  if (!categories.length && contentTokens(blob).length && !asksForScience(blob)) {
    categories.push({
      kind: 'knowledge',
      id: 'discover',
      reason: 'No closer category was named. One page of category 768 is the sample.',
    });
    notExamined.push('Categories 769 and 795 were not opened for this question.');
  }
  const selected = categories.slice(0, RESEARCH_BUDGET.categories);
  if (categories.length > selected.length) {
    notExamined.push(`The category budget is ${RESEARCH_BUDGET.categories}. Further matching categories were not opened.`);
  }
  if (asksForScience(blob)) {
    notExamined.push('Scientific claims were not researched in these religious catalogues.');
  }
  return { science: asksForScience(blob), searchPhrase: searchPhrase(blob), categories: selected, notExamined };
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
