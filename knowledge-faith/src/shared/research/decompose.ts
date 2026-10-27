import type { QuestionDomain, ResearchSubquestion } from '../contracts/v1.ts';
import { contentTokens } from '../research.ts';

const SCIENCE = /\b(scientific|science|physics|biology|chemistry|medicine|medical|clinical|metabolic|empirical|evolution|peer-reviewed|journal|embryolog\w*|anatom\w*|astronom\w*|cosmolog\w*|geolog\w*|genetic\w*|neuroscien\w*|physiolog\w*|zoolog\w*|botan\w*|meteorolog\w*|paleontolog\w*|fossil|experiment)\b/i;
const PRACTICE = /\b(how should|how do|how to|what should|steps|perform|pray|wudu|fast)\b/i;
const HISTORY = /\b(when did|history|seerah|biography|battle|year)\b/i;
const SCRIPTURE = /\b(qur'an|quran|verse|ayah|hadith|hadeeth|narration|surah)\b/i;

const EXTRA_STOP = new Set([
  'someone', 'something', 'anything', 'people', 'person', 'thing', 'things', 'need', 'needs',
  'number', 'said', 'being', 'taught', 'about', 'place', 'take', 'read', 'does', 'say', 'described',
]);

const SPELLING: Record<string, readonly string[]> = {
  neighbor: ['neighbor', 'neighbour'],
  neighbour: ['neighbor', 'neighbour'],
  neighbors: ['neighbors', 'neighbours'],
  neighbours: ['neighbors', 'neighbours'],
  zakah: ['zakah', 'zakat'],
  zakat: ['zakah', 'zakat'],
  salah: ['salah', 'prayer'],
  salat: ['salah', 'prayer'],
  intention: ['intention', 'intentions'],
  intentions: ['intention', 'intentions'],
  tawhid: ['tawhid', 'tawheed'],
  tawheed: ['tawhid', 'tawheed'],
  wudu: ['wudu', 'wudhu'],
  wudhu: ['wudu', 'wudhu'],
  wuzu: ['wudu', 'wudhu'],
};

/** Search phrases only. They are not copied into the answer. */
const SEARCH_EQUIVALENTS: Record<string, readonly string[]> = {
  தொழுகை: ['prayer', 'salah', 'صلاة'],
  தொழு: ['prayer', 'صلاة'],
  நோன்பு: ['fasting', 'صوم'],
  ஜகாத்: ['zakat', 'زكاة'],
  தர்மம்: ['charity', 'zakat'],
  ஹதீஸ்: ['hadith', 'حديث'],
  குர்ஆன்: ['quran', 'قرآن'],
  நோக்கம்: ['intention', 'نية'],
  தவ்ஹீத்: ['tawhid', 'tawheed', 'توحيد'],
  தவ்ஹீது: ['tawhid', 'توحيد'],
  வுழு: ['wudu', 'وضوء'],
  සලාත්: ['prayer', 'salah', 'صلاة'],
  උපවාස: ['fasting', 'صوم'],
  හදීස්: ['hadith', 'حديث'],
  කුර්ආන: ['quran', 'قرآن'],
  තව්හීද්: ['tawhid', 'tawheed', 'توحيد'],
  අසල්වැසියා: ['neighbor', 'neighbour'],
  அண்டை: ['neighbor', 'neighbour'],
  tawhid: ['توحيد', 'oneness'],
  tawheed: ['توحيد', 'oneness'],
  wudu: ['ablution', 'وضوء'],
  wudhu: ['ablution', 'وضوء'],
  wuzu: ['ablution', 'وضوء'],
  seerah: ['sirah', 'biography'],
  sirah: ['seerah', 'biography'],
  biography: ['seerah', 'sirah'],
};

export interface RetrievalPlan {
  domain: QuestionDomain;
  subquestions: ResearchSubquestion[];
}

function domainOf(text: string): QuestionDomain {
  const science = SCIENCE.test(text);
  const practice = PRACTICE.test(text);
  const history = HISTORY.test(text);
  const scripture = SCRIPTURE.test(text) || /\d{1,3}\s*:\s*\d{1,3}/.test(text);
  const flags = [science, practice, history, scripture].filter(Boolean).length;
  if (flags > 1) return 'mixed';
  if (science) return 'science';
  if (practice) return 'practice';
  if (history) return 'history';
  if (scripture) return 'scripture';
  return 'explanation';
}

function sentences(question: string): string[] {
  const parts = question
    .split(/\n+|(?<=[.!?؟])\s+/)
    .map(part => part.trim())
    .filter(part => part.length > 1);
  return parts.length ? parts : [question.trim()].filter(Boolean);
}

function tokens(text: string): string[] {
  return contentTokens(text).filter(token => !EXTRA_STOP.has(token));
}

function queriesFor(text: string): string[] {
  const words = tokens(text).slice(0, 6);
  if (!words.length) return [];
  const queries: string[] = [];
  const push = (query: string) => {
    if (query && !queries.includes(query) && queries.length < 3) queries.push(query);
  };
  push(words.join(' '));
  for (const word of [...words].sort((a, b) => b.length - a.length)) push(word);
  for (const word of words) {
    for (const variant of SPELLING[word] ?? []) {
      if (variant === word) continue;
      push(words.map(item => (item === word ? variant : item)).join(' '));
      push(variant);
    }
  }
  for (const word of words) {
    for (const variant of SEARCH_EQUIVALENTS[word] ?? []) {
      if (queries.length >= 5) break;
      if (!queries.includes(variant)) queries.push(variant);
    }
  }
  if (words.length === 1 && /\bwhat is\b|\bwhat are\b|என்றால் என்ன|என்பது என்ன|යනු කුමක්/i.test(text) && queries.length < 5) {
    const meaning = `${words[0]} meaning`;
    if (!queries.includes(meaning)) queries.push(meaning);
  }
  if (words.includes('life') && (words.includes('prophet') || words.includes('messenger'))) {
    for (const extra of ['seerah', 'biography']) {
      if (queries.length >= 5) break;
      if (!queries.includes(extra)) queries.push(extra);
    }
  }
  return queries;
}

/** Distinctive wording and translation variants a catalogue can match when a phrase search is too broad. */
export function narrationVariants(question: string): string[] {
  const variants: string[] = [];
  const push = (query: string) => {
    const text = query.replace(/\s+/g, ' ').trim();
    if (text && !variants.includes(text) && variants.length < 4) variants.push(text);
  };
  const torah = /\b(?:torah|tawrah|taurat|tawrat)\b/i.test(question);
  const hebrew = /\bhebrew\b/i.test(question);
  const arabic = /\barabic\b/i.test(question);
  const explain = /\b(?:expound|explain|interpret)\b/i.test(question);
  const people = /people of the book/i.test(question);
  if (people) push('People of the Book');
  if (torah && hebrew) {
    push('Torah in Hebrew');
    push('Tawrah Hebrew');
  }
  if (explain && arabic) {
    push('expound in Arabic');
    push('explain in Arabic');
  }
  if (torah && !hebrew) push('Torah');
  return variants;
}

/**
 * Split a question into subquestions and short search queries.
 * The full prompt is not one of the queries.
 */
export function decomposeQuestion(question: string): RetrievalPlan {
  const cleaned = question.replace(/\s+/g, ' ').trim();
  const parts = sentences(cleaned).slice(0, 4);
  const subquestions = parts.map((text, index) => ({
    id: `q${index + 1}`,
    text,
    domain: domainOf(text),
    queries: domainOf(text) === 'science' ? [] : queriesFor(text),
  }));
  const variants = narrationVariants(cleaned);
  const host = subquestions.find(item => item.domain !== 'science');
  if (host) {
    for (const variant of variants) {
      if (!host.queries.includes(variant) && host.queries.length < 6) host.queries.push(variant);
    }
  }
  const domains = new Set(subquestions.map(item => item.domain));
  const domain = domains.size === 1 ? [...domains][0] : 'mixed';
  return { domain, subquestions };
}

export function asksScience(text: string): boolean {
  return SCIENCE.test(text);
}
