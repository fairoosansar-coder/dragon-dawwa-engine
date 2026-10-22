import type { QuestionDomain, ResearchSubquestion } from '../contracts/v1.ts';
import { contentTokens } from '../research.ts';

const SCIENCE = /\b(scientific|science|physics|biology|chemistry|medicine|medical|clinical|metabolic|empirical|evolution|peer-reviewed|journal)\b/i;
const PRACTICE = /\b(how should|how do|how to|what should|steps|perform|pray|wudu|fast)\b/i;
const HISTORY = /\b(when did|history|seerah|biography|battle|year)\b/i;
const SCRIPTURE = /\b(qur'an|quran|verse|ayah|hadith|hadeeth|narration|surah)\b/i;

const EXTRA_STOP = new Set([
  'someone', 'something', 'anything', 'people', 'person', 'thing', 'things', 'need', 'needs',
  'number', 'said', 'being', 'taught', 'about',
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
  return queries;
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
  const domains = new Set(subquestions.map(item => item.domain));
  const domain = domains.size === 1 ? [...domains][0] : 'mixed';
  return { domain, subquestions };
}

export function asksScience(text: string): boolean {
  return SCIENCE.test(text);
}
