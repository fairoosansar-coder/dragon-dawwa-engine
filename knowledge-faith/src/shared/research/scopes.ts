/** What a question can mean, decided before any source is opened. */

import { contentTokens } from '../research.ts';

export interface QuestionScope {
  id: string;
  text: string;
  sources: Array<'quran' | 'hadith'>;
}

export type QuestionKind = 'corpus-count' | 'stated-total' | 'general';
export type QuestionCorpus = 'quran' | 'hadith' | 'either';

export interface QuestionInterpretation {
  meaning: string;
  scopes: QuestionScope[];
  /** Catalogue phrases to try before the question’s own tokens. */
  searchPhrases: string[];
  /** A fetched passage can be about this subject even when it uses another word. */
  synonyms: string[];
  /** Search Hadith as well when the assigned desk was only the Qur’an. */
  consultHadith: boolean;
  /** How the count, if any, should be read. */
  kind: QuestionKind;
  /** The corpus the question names. `either` means it did not limit the search. */
  corpus: QuestionCorpus;
  /** The subject left after question words and corpus names are removed. */
  subject: string;
}

const COUNT = /\bhow many\b|\bnumber of\b|\bhow much\b|\bhow often\b|எத்தனை|කීයක්|කී\s*දෙන|كم/i;
const OCCURRENCE = /\bmentions?\b|\bmentioned\b|\bmentioning\b|\bhow many times\b|\bhow often\b|\boccurrences?\b|\bspoken of\b|\bspeak(?:s|ing)? about\b|\btalk(?:s|ed|ing)? about\b/i;
const PROPHETS = /prophet|messenger|\bnabi\b|anbiya|\brasul\b|\brusul\b|نبي|أنبياء|انبياء|رسل|رسول|தீர்க்கதரிசி|இறைத்தூதர்|නබි|රසූල්/i;
const QURAN_CORPUS = /\bqur['’ʼ]?an\b/i;
const HADITH_CORPUS = /\b(?:hadith|hadeeth|hades|hadees|hadis|bukhari|sahih)\b/i;

const FRAME = new Set([
  'many', 'much', 'often', 'times', 'time', 'mentions', 'mention', 'mentioned', 'mentioning',
  'occurrences', 'occurrence', 'occurs', 'occur', 'speaks', 'speak', 'speaking', 'spoken',
  'talks', 'talk', 'talked', 'talking', 'quran', 'qur', 'islam', 'islamic', 'narrate', 'narrates',
  'narrated', 'recorded', 'record', 'records', 'says', 'said', 'tell', 'tells', 'true', 'word',
  'words', 'verse', 'verses', 'ayah', 'ayahs', 'surah', 'passage', 'passages', 'text', 'number',
]);

const PROPHET_SYNONYMS = [
  'prophet',
  'prophets',
  'messenger',
  'messengers',
  'nabi',
  'anbiya',
  'rasul',
  'rusul',
  'نبي',
  'أنبياء',
  'انبياء',
  'رسل',
  'رسول',
];

const EMPTY: QuestionInterpretation = {
  meaning: '',
  scopes: [],
  searchPhrases: [],
  synonyms: [],
  consultHadith: false,
  kind: 'general',
  corpus: 'either',
  subject: '',
};

function corpusOf(text: string): QuestionCorpus {
  const quran = QURAN_CORPUS.test(text);
  const hadith = HADITH_CORPUS.test(text);
  if (quran && !hadith) return 'quran';
  if (hadith && !quran) return 'hadith';
  return 'either';
}

/** Subject words. Question frames and the corpus name are not the subject. */
export function questionSubject(question: string): string {
  return contentTokens(question)
    .filter(token => !FRAME.has(token))
    .slice(0, 4)
    .join(' ');
}

function cleanPhrase(phrase: string): string {
  return phrase
    .replace(/\bqur['’ʼ]?an\b/gi, ' ')
    .replace(/\b(?:mentioned|mentions|mention|number of|how many|how often|in the|in)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Short retrieval phrases. They find candidates. They do not decide relevance. */
export function retrievalPhrases(interpretation: QuestionInterpretation, extra: readonly string[]): string[] {
  const phrases: string[] = [];
  const push = (value: string) => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (text.length < 3 || text.length > 32) return;
    if (phrases.some(item => item.toLocaleLowerCase('en') === text.toLocaleLowerCase('en'))) return;
    phrases.push(text);
  };
  if (interpretation.subject) push(interpretation.subject);
  for (const phrase of [...interpretation.searchPhrases, ...extra]) push(cleanPhrase(phrase));
  return phrases.slice(0, 3);
}

/**
 * Separate the readings of a question before search.
 * A count of mentions is not the same question as a total a source would have to state.
 */
export function interpretQuestion(question: string): QuestionInterpretation {
  const text = question.replace(/\s+/g, ' ').trim();
  if (!text) return EMPTY;
  const prophets = PROPHETS.test(text);
  const count = COUNT.test(text);
  const occurrence = OCCURRENCE.test(text);
  const corpus = corpusOf(text);
  const subject = questionSubject(text);
  if (prophets && count) {
    const quranOnly = corpus === 'quran';
    const sources: Array<'quran' | 'hadith'> = quranOnly ? ['quran'] : ['quran', 'hadith'];
    return {
      meaning:
        'This asks how many prophets there are. One reading is which prophets the opened passages name. The other is whether any opened passage states a total number. A verse that says “messengers” is still about this subject. The number of opened passages is not that total.',
      scopes: [
        {
          id: 'named',
          text: 'Which prophets or messengers do the opened passages name or describe?',
          sources,
        },
        {
          id: 'total',
          text: 'Do the opened passages state a total number of prophets?',
          sources,
        },
      ],
      searchPhrases: ['prophets', 'messengers', 'عدد الأنبياء', 'الأنبياء'],
      synonyms: PROPHET_SYNONYMS,
      consultHadith: !quranOnly,
      kind: 'stated-total',
      corpus,
      subject,
    };
  }
  if (count && (occurrence || corpus === 'quran')) {
    const sources: Array<'quran' | 'hadith'> = corpus === 'hadith' ? ['hadith'] : ['quran'];
    const place = corpus === 'hadith' ? 'Hadith' : 'Qur’an';
    const topic = subject || 'this subject';
    return {
      meaning: `This asks how “${topic}” is mentioned in the ${place}. The word-occurrence reading counts Arabic and English wordings in the corpus, after the same wording in the same verse is counted once. The historical-event reading lists the campaigns the retrieved passages narrate, apart from that word count. A battle verse that does not contain a counted wording is not a word occurrence. A wording hit that does not narrate a campaign is not a battle. Neither count is a sentence that already states a total.`,
      scopes: [
        {
          id: 'occurrence',
          text: `Which Arabic and English wordings occur, and which verse holds each after the same wording in the same verse is counted once?`,
          sources,
        },
        {
          id: 'event',
          text: 'Which campaigns do the retrieved passages narrate, apart from the word count?',
          sources,
        },
      ],
      searchPhrases: subject ? [subject] : [],
      synonyms: [],
      consultHadith: corpus === 'hadith',
      kind: 'corpus-count',
      corpus,
      subject,
    };
  }
  if (count && corpus !== 'quran') {
    return {
      meaning: 'This asks for a number. The Qur’an and Hadith are both searched. A search that misses the exact wording does not end the investigation.',
      scopes: [
        { id: 'quran-number', text: 'Does an opened Qur’an passage state this number?', sources: ['quran'] },
        { id: 'hadith-number', text: 'Does an opened hadith state this number?', sources: ['hadith'] },
      ],
      searchPhrases: [],
      synonyms: [],
      consultHadith: true,
      kind: 'stated-total',
      corpus,
      subject,
    };
  }
  return { ...EMPTY, corpus, subject };
}
