/** What a question can mean, decided before any source is opened. */

export interface QuestionScope {
  id: string;
  text: string;
  sources: Array<'quran' | 'hadith'>;
}

export interface QuestionInterpretation {
  meaning: string;
  scopes: QuestionScope[];
  /** Catalogue phrases to try before the question’s own tokens. */
  searchPhrases: string[];
  /** A fetched passage can be about this subject even when it uses another word. */
  synonyms: string[];
  /** Search Hadith as well when the assigned desk was only the Qur’an. */
  consultHadith: boolean;
}

const COUNT = /\bhow many\b|\bnumber of\b|\bhow much\b|எத்தனை|කීයක්|කී\s*දෙන|كم/i;
const PROPHETS = /prophet|messenger|\bnabi\b|anbiya|\brasul\b|\brusul\b|نبي|أنبياء|انبياء|رسل|رسول|தீர்க்கதரிசி|இறைத்தூதர்|නබි|රසූල්/i;
const QURAN_ONLY = /\b(?:in|from|inside) the qur['’ʼ]?an\b|\bayahs?\b|\bverses?\b|\bsurah\b/i;

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
};

/**
 * Separate the readings of a question before search.
 * A count can mean “what is named” or “is a total stated”. Those are not the same search.
 */
export function interpretQuestion(question: string): QuestionInterpretation {
  const text = question.replace(/\s+/g, ' ').trim();
  if (!text) return EMPTY;
  const prophets = PROPHETS.test(text);
  const count = COUNT.test(text);
  const quranOnly = QURAN_ONLY.test(text);
  if (prophets && count) {
    const sources: Array<'quran' | 'hadith'> = quranOnly ? ['quran'] : ['quran', 'hadith'];
    return {
      meaning:
        'This asks how many prophets there are. One reading is which prophets the opened passages name. The other is whether any opened passage states a total number. A verse that says “messengers” is still about this subject.',
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
    };
  }
  if (count && !quranOnly) {
    return {
      meaning: 'This asks for a number. The Qur’an and Hadith are both searched. A search that misses the exact wording does not end the investigation.',
      scopes: [
        { id: 'quran-number', text: 'Does an opened Qur’an passage state this number?', sources: ['quran'] },
        { id: 'hadith-number', text: 'Does an opened hadith state this number?', sources: ['hadith'] },
      ],
      searchPhrases: [],
      synonyms: [],
      consultHadith: true,
    };
  }
  return EMPTY;
}
