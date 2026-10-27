/** Usual passages to open for a topic. The text is still fetched. These numbers are not an answer. */

export interface ThemeAyah {
  surah: number;
  ayah: number;
}

export interface ResearchTheme {
  id: string;
  worshipTopic: string | null;
  test: RegExp;
  /** Words that show the fetched translation is about this theme. */
  synonyms: readonly string[];
  ayahs: readonly ThemeAyah[];
}

export const RESEARCH_THEMES: readonly ResearchTheme[] = [
  {
    id: 'fasting',
    worshipTopic: 'fasting',
    test: /fast|sawm|siyam|siyam|roza|நோன்பு|நோன்ப|உபவாச|උපවාස|صوم|صيام/i,
    synonyms: ['fast', 'fasting', 'sawm', 'நோன்பு', 'நோன்ப', 'உபவாச', 'උපවාස', 'صوم', 'صيام'],
    ayahs: [
      { surah: 2, ayah: 183 },
      { surah: 2, ayah: 184 },
      { surah: 2, ayah: 185 },
      { surah: 2, ayah: 187 },
    ],
  },
  {
    id: 'prayer',
    worshipTopic: 'prayer',
    test: /prayer|salah|salat|தொழுகை|සලාත|صلاة/i,
    synonyms: ['prayer', 'salah', 'தொழுகை', 'සලාත', 'صلاة'],
    ayahs: [
      { surah: 2, ayah: 43 },
      { surah: 2, ayah: 238 },
      { surah: 29, ayah: 45 },
    ],
  },
  {
    id: 'zakah',
    worshipTopic: 'zakah',
    test: /zakah|zakat|zakāt|ஜகாத்|සකාත්|زكاة/i,
    synonyms: ['zakah', 'zakat', 'ஜகாத்', 'සකාත්', 'زكاة'],
    ayahs: [
      { surah: 2, ayah: 43 },
      { surah: 9, ayah: 60 },
    ],
  },
  {
    id: 'hajj',
    worshipTopic: 'hajj',
    test: /hajj|umrah|ஹஜ்|හජ්|حج|عمرة/i,
    synonyms: ['hajj', 'umrah', 'ஹஜ்', 'හජ්', 'حج'],
    ayahs: [
      { surah: 2, ayah: 196 },
      { surah: 3, ayah: 97 },
    ],
  },
  {
    id: 'charity',
    worshipTopic: null,
    test: /charity|sadaqah|தர்மம்|දානය|صدقة/i,
    synonyms: ['charity', 'sadaqah', 'தர்மம்', 'දානය', 'صدقة'],
    ayahs: [
      { surah: 2, ayah: 261 },
      { surah: 2, ayah: 267 },
    ],
  },
  {
    id: 'prophets',
    worshipTopic: null,
    test: /prophet|messenger|\bnabi\b|anbiya|\brasul\b|\brusul\b|نبي|أنبياء|انبياء|رسل|رسول|தீர்க்கதரிசி|இறைத்தூதர்|නබි|රසූල්/i,
    synonyms: ['prophet', 'prophets', 'messenger', 'messengers', 'nabi', 'anbiya', 'rasul', 'rusul', 'نبي', 'أنبياء', 'انبياء', 'رسل', 'رسول'],
    ayahs: [
      { surah: 4, ayah: 163 },
      { surah: 4, ayah: 164 },
      { surah: 40, ayah: 78 },
      { surah: 33, ayah: 40 },
    ],
  },
];

export function matchingThemes(text: string): ResearchTheme[] {
  return RESEARCH_THEMES.filter(theme => theme.test.test(text));
}

export function themeAyahs(text: string): ThemeAyah[] {
  const found: ThemeAyah[] = [];
  for (const theme of matchingThemes(text)) {
    for (const ayah of theme.ayahs) {
      if (!found.some(item => item.surah === ayah.surah && item.ayah === ayah.ayah)) found.push({ ...ayah });
    }
  }
  return found;
}

export function worshipTopicForQuestion(text: string): string | null {
  return matchingThemes(text).find(theme => theme.worshipTopic)?.worshipTopic ?? null;
}

/** A theme verse may be cited when its fetched wording contains the theme, even if the question used another synonym. */
export function themeWordingSupports(question: string, passage: string): boolean {
  const haystack = passage.toLocaleLowerCase('en');
  return matchingThemes(question).some(theme => theme.synonyms.some(word => haystack.includes(word.toLocaleLowerCase('en'))));
}

/**
 * The reader is asking about faith, an ayah, or a theological theme.
 * A study suggestion may then be kept even when the translation does not repeat the question.
 * An unrelated request, such as a lost bicycle, does not qualify.
 */
const SCRIPTURE_QUESTION =
  /allah|god\b|lord|qur['’]?an|\bayah\b|\bverse\b|\bsurah\b|islam|\biman\b|\bfaith\b|tawakkul|tawakkal|hardship|\btrial\b|tribulation|wisdom|revelation|jibril|jibreel|jibrael|gabriel|\bwahy\b|worship|pray|mercy|forgiv|\bsabr\b|\bqadr\b|resent|dislike|\bhate\b|hateful|jihad|taqwa|reliance|\brely\b|struggl|burden|prescribed|decree|\bpatient\b|blessing|\bafflict/i;

export function questionInvitesScripture(question: string): boolean {
  return SCRIPTURE_QUESTION.test(question) || matchingThemes(question).length > 0;
}
