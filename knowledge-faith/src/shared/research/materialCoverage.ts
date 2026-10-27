import type { EvidencePassage } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';
import { ayahsMentioned, passageSupportsTopic } from '../research.ts';
import { themeWordingSupports } from './themes.ts';

export type MaterialKind =
  | 'locate'
  | 'explanation'
  | 'meaning'
  | 'purpose'
  | 'authentication'
  | 'comparison'
  | 'application'
  | 'practice'
  | 'worship'
  | 'history'
  | 'science'
  | 'hadith'
  | 'quran'
  | 'books'
  | 'recommendation';

export interface MaterialPart {
  id: string;
  kind: MaterialKind;
  text: string;
}

const MEANING = /mean(?:ing|s)?|explain|implication|interpret|\bwhy\b|நிலை|அர்த்த|விளக்க|අර්ථ|තත්ත්ව|ඇයි|කියන්නේ/i;
const EXPLANATION = /what is|what are|என்றால் என்ன|என்பது என்ன|යනු කුමක්|මොකක්ද|කුමක්ද/i;
const PURPOSE = /\bpurpose\b|for what reason|ஏன்|ඇයි|අරමුණ/i;
const AUTHENTICATION = /\bauthenticat|\bisnad\b|\bisnaad\b|chain of narration|fabricat|weak hadith|சரியானதா|දුර්වල/i;
const COMPARISON = /\bcompare\b|\bcomparison\b|difference between|\bversus\b|\bvs\.?\b|வேறுபாடு|වෙනස/i;
const APPLICATION = /today|modern|nowadays|appl(?:y|ication)|contemporary|இன்று|நவீன|අද|නූතන|යොදව/i;
const PRACTICE = /how should|how do i|how to|\bsteps\b|\bperform\b|எப்படி|කෙසේ/i;
const WORSHIP = /pray|prayer|ṣalāh|salah|fast|fasting|charit|zakat|wudu|worship|தொழு|நோன்பு|தர்ம|සලාත|උපවාස|දාන|වන්දන/i;
const HISTORY = /when did|history|seerah|sīrah|biography|battle|\byear\b|சரித்திர|வரலாறு|ඉතිහාස|සීරා/i;
const SCIENCE = /scienti|physics|biology|chemistry|medicine|clinical|metabolic|empirical|\bscience\b|அறிவியல்|விஞ்ஞான|විද්‍යා/i;
const HADITH = /hadith|hadeeth|\bhades\b|narration|bukhari|muslim|ஹதீஸ்|හදීස්|حديث/i;
const QURAN = /qur['’]?an|\bverse\b|\bayah\b|\bsurah\b|குர்ஆன்|வசனம்|කුර්ආන|වැකි|قرآن/i;
const BOOKS = /\bbooks?\b|\blibrary\b|\bvolume\b|புத்தக|நூல்|පොත්|පොත/i;
const RECOMMENDATION = /\brecommend\b|which book should|book should i read|புத்தகம் பரிந்துரை|පොතක් නිර්දේශ/i;
const LOCATE = /where (?:is|does|can)|which (?:verse|ayah|hadith|narration)|எங்கு|කොහේ/i;

const PART_LABEL: Record<MaterialKind, string> = {
  locate: 'Passage',
  explanation: 'Explanation',
  meaning: 'Meaning',
  purpose: 'Purpose',
  authentication: 'Authentication',
  comparison: 'Comparison',
  application: 'Modern application',
  practice: 'Practice',
  worship: 'Worship',
  history: 'History',
  science: 'Science',
  hadith: 'Hadith',
  quran: "Qur'an",
  books: 'Books',
  recommendation: 'Book recommendation',
};

/** English control label. The internal kind is not shown to the reader. */
export function materialPartLabel(kind: string): string {
  return PART_LABEL[kind as MaterialKind] ?? 'This part';
}

export function materialParts(question: string): MaterialPart[] {
  const text = question.replace(/\s+/g, ' ').trim();
  const parts: MaterialPart[] = [];
  const push = (kind: MaterialKind) => {
    if (!parts.some(part => part.kind === kind)) parts.push({ id: kind, kind, text });
  };
  if (MEANING.test(text)) push('meaning');
  if (EXPLANATION.test(text) && !MEANING.test(text)) push('explanation');
  if (PURPOSE.test(text)) push('purpose');
  if (AUTHENTICATION.test(text)) push('authentication');
  if (COMPARISON.test(text)) push('comparison');
  if (APPLICATION.test(text)) push('application');
  if (PRACTICE.test(text) && WORSHIP.test(text)) push('practice');
  else if (PRACTICE.test(text) && !APPLICATION.test(text)) push('practice');
  if (WORSHIP.test(text)) push('worship');
  if (HISTORY.test(text)) push('history');
  if (SCIENCE.test(text)) push('science');
  if (HADITH.test(text)) push('hadith');
  if (QURAN.test(text)) push('quran');
  if (BOOKS.test(text) && !/people of the books?/i.test(text)) push('books');
  if (RECOMMENDATION.test(text)) push('recommendation');
  if (LOCATE.test(text) || ayahsMentioned(text).length > 0) push('locate');
  if (!parts.length) push('explanation');
  return parts;
}

function scriptKind(text: string): 'ta' | 'si' | 'en' | 'ar' | 'other' {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  if (/[\u0600-\u06FF]/.test(text) && !/[A-Za-z]/.test(text)) return 'ar';
  if (/[A-Za-z]/.test(text)) return 'en';
  return 'other';
}

/**
 * Answer text must use the selected language’s script.
 * Arabic may remain in the passage’s separate arabic field. Arabic-only text is not a Tamil, Sinhala, or English answer.
 */
export function passageMatchesLanguage(passage: Pick<EvidencePassage, 'text' | 'role'>, language: Lang): boolean {
  const script = scriptKind(passage.text);
  if (script === 'ar' || script === 'other') return false;
  return script === language;
}

export interface ReviewedPart extends MaterialPart {
  status: 'answered' | 'unresolved';
  note: string;
}

function explains(passage: EvidencePassage): boolean {
  const blob = `${passage.text}\n${passage.context ?? ''}`;
  if (passage.source.provider === 'Parallel') return MEANING.test(blob);
  return passage.role === 'commentary' || /publisher explanation/i.test(passage.context ?? '');
}

const APPLICATION_DISCUSSION = /modern application|applied today|applies today|contemporary application|how (?:this|it) (?:is |should be )?applied|இன்று பயன்ப|நவீன பயன்பாடு|අද යොද|නූතන යෙදුම/i;

/** A word such as “today” inside a quotation is not a modern application. */
export function discussesApplication(passage: EvidencePassage): boolean {
  if (passage.role === 'source_text' || passage.role === 'translation') return false;
  const context = (passage.context ?? '').replace(passage.text, ' ');
  return APPLICATION_DISCUSSION.test(context);
}

const RECORDED_PRACTICE = /recite|when you go to your bed|before you sleep|give in charity|perform wud|wash(?:ing)? the hands|ஓது|படுக்க|நோன்பு|தொழு|කියව|නිද|උපවාස|සලාත|වුදූ/i;

/** A narration can record a practice without settling a modern-application question. */
export function recordsPractice(text: string): boolean {
  return RECORDED_PRACTICE.test(text);
}

function hasRef(blob: string, surah: number, ayah: number): boolean {
  const patterns = [
    new RegExp(`(?:^|[^\\d])${surah}:${ayah}(?!\\d)`),
    new RegExp(`(?:^|[^\\d])${surah}-${ayah}(?!\\d)`),
    new RegExp(`surah ${surah}, ayah ${ayah}(?!\\d)`),
  ];
  return patterns.some(pattern => pattern.test(blob));
}

/** The question named this verse. The translation does not have to repeat the number. */
export function isNamedReference(question: string, passage: Pick<EvidencePassage, 'id' | 'locator' | 'source'>): boolean {
  const refs = ayahsMentioned(question);
  if (!refs.length) return false;
  const blob = `${passage.id} ${passage.locator} ${passage.source.id}`.toLocaleLowerCase('en');
  return refs.some(ref => hasRef(blob, ref.surah, ref.ayah));
}

function passageBlob(passage: EvidencePassage): string {
  return `${passage.text}\n${passage.arabic ?? ''}`;
}

function supportsQuestion(question: string, passage: EvidencePassage): boolean {
  return passageSupportsTopic(question, passageBlob(passage));
}

function partAnswered(kind: MaterialKind, passages: readonly EvidencePassage[], question: string): boolean {
  const topical = passages.filter(passage => supportsQuestion(question, passage));
  const named = passages.filter(passage => isNamedReference(question, passage));
  if (kind === 'meaning') return passages.some(explains);
  if (kind === 'application') return passages.some(discussesApplication);
  if (kind === 'explanation' || kind === 'purpose') return topical.length > 0;
  if (kind === 'authentication') {
    return topical.some(passage => passage.publishedGrade || /isnad|chain of narration|fabricat|authentic|grade/i.test(`${passage.text}\n${passage.context ?? ''}`));
  }
  if (kind === 'comparison') {
    return topical.length >= 2 || topical.some(passage => /differ|unlike|whereas|comparison|வேறுபாடு|වෙනස/i.test(passage.text));
  }
  if (kind === 'practice') return topical.some(passage => recordsPractice(passage.text) || WORSHIP.test(`${passage.text}\n${passage.locator}`));
  if (kind === 'science') {
    return passages.some(passage =>
      (passage.role === 'empirical' || passage.source.contentType === 'science') && supportsQuestion(question, passage),
    );
  }
  if (kind === 'history') return topical.some(passage => HISTORY.test(`${passage.text}\n${passage.context ?? ''}\n${passage.locator}`));
  if (kind === 'worship') return topical.some(passage => WORSHIP.test(`${passage.text}\n${passage.locator}`));
  if (kind === 'hadith') return [...topical, ...named].some(passage => passage.source.contentType === 'hadith');
  if (kind === 'quran') return [...topical, ...named].some(passage => passage.source.contentType === 'quran');
  if (kind === 'books' || kind === 'recommendation') return topical.some(passage => passage.source.contentType === 'book');
  return named.length > 0 || topical.some(passage => passage.text.trim().length > 20);
}

function applicationNote(language: Lang): string {
  if (language === 'ta') return 'ஒரு மேற்கோளை அடையாளம் காண்பது நவீன நடைமுறையை விளக்குவதில்லை. இந்தப் பகுதி திறந்தே இருக்கிறது.';
  if (language === 'si') return 'උපුටා දැක්වීමක් හඳුනා ගැනීම නූතන යෙදුමට පිළිතුරක් නොවේ. මෙම කොටස විවෘතව පවතී.';
  return 'Identifying a quotation does not answer the modern application. That part stays open.';
}

/**
 * Every material part is answered from a same-language passage, or marked unresolved.
 * A quotation does not answer a request for meaning or modern application.
 * Opening any long passage does not finish a question.
 */
export function reviewMaterialCoverage(input: {
  question: string;
  language: Lang;
  passages: readonly EvidencePassage[];
  providerFailed?: boolean;
}): {
  parts: ReviewedPart[];
  investigation: 'complete' | 'partial' | 'blocked';
  unresolved: string[];
  wrongLanguage: boolean;
} {
  const requested = materialParts(input.question);
  const sameLanguage = input.passages.filter(passage => passageMatchesLanguage(passage, input.language));
  const wrongLanguage = input.passages.length > 0 && sameLanguage.length === 0;
  const explained = sameLanguage.some(explains);
  const applied = sameLanguage.some(discussesApplication);

  const parts: ReviewedPart[] = requested.map(part => {
    if (input.providerFailed && sameLanguage.length === 0) {
      return { ...part, status: 'unresolved', note: 'The source did not respond, so this part is not answered. That is a provider failure, not a finding that the subject is absent.' };
    }
    if (wrongLanguage) {
      return { ...part, status: 'unresolved', note: `The opened text is not in the selected language (${input.language}). A missing translation is not a finding that the subject is absent.` };
    }
    if (part.kind === 'meaning') {
      return explained
        ? { ...part, status: 'answered', note: 'An attributed explanation in the selected language addresses this part.' }
        : { ...part, status: 'unresolved', note: 'A quotation was not treated as the meaning. No attributed explanation in the selected language addresses it.' };
    }
    if (part.kind === 'application') {
      return applied
        ? { ...part, status: 'answered', note: 'A retrieved passage discusses the modern application.' }
        : { ...part, status: 'unresolved', note: applicationNote(input.language) };
    }
    if (part.kind === 'locate') {
      return partAnswered('locate', sameLanguage, input.question)
        ? { ...part, status: 'answered', note: 'The named passage was opened. Its location is context for the rest of the question.' }
        : { ...part, status: 'unresolved', note: 'The named passage was not opened in the selected language.' };
    }
    if (part.kind === 'science' && !partAnswered('science', sameLanguage, input.question)) {
      return { ...part, status: 'unresolved', note: 'No empirical record in the selected language addresses this part. Scripture is not scientific evidence.' };
    }
    if (part.kind === 'authentication' && !partAnswered('authentication', sameLanguage, input.question)) {
      return { ...part, status: 'unresolved', note: 'No source grade or chain discussion addresses whether this report is authentic.' };
    }
    if (part.kind === 'comparison' && !partAnswered('comparison', sameLanguage, input.question)) {
      return { ...part, status: 'unresolved', note: 'The opened passages do not set the two sides of this comparison out.' };
    }
    if (partAnswered(part.kind, sameLanguage, input.question)) {
      return { ...part, status: 'answered', note: 'A passage in the selected language addresses this part.' };
    }
    return { ...part, status: 'unresolved', note: 'No passage in the selected language addresses this part of the question.' };
  });

  const unresolved = [...new Set(parts.filter(part => part.status === 'unresolved').map(part => part.note))];
  let investigation: 'complete' | 'partial' | 'blocked' = 'complete';
  if (input.providerFailed && sameLanguage.length === 0) investigation = 'blocked';
  else if (parts.some(part => part.status === 'unresolved') || sameLanguage.length === 0) investigation = 'partial';
  return { parts, investigation, unresolved, wrongLanguage };
}

function relevantTo(questions: readonly string[], passage: EvidencePassage): boolean {
  if (questions.some(question => isNamedReference(question, passage))) return true;
  const blob = `${passageBlob(passage)}\n${passage.context ?? ''}`;
  return questions.some(question => passageSupportsTopic(question, blob) || themeWordingSupports(question, blob));
}

function discussesKeptVerse(verse: EvidencePassage, commentary: EvidencePassage): boolean {
  const [surah, ayah] = verse.source.id.split(':').map(Number);
  if (!surah || !ayah) return false;
  const blob = `${commentary.locator} ${commentary.source.id} ${commentary.id}`.toLocaleLowerCase('en');
  return hasRef(blob, surah, ayah) || commentary.source.id === `tafsir-${surah}`;
}

function isNeighbour(verse: EvidencePassage, other: EvidencePassage): boolean {
  const [surah, ayah] = verse.source.id.split(':').map(Number);
  const [otherSurah, otherAyah] = other.source.id.split(':').map(Number);
  return surah === otherSurah && Number.isFinite(ayah) && Number.isFinite(otherAyah) && Math.abs(ayah - otherAyah) === 1;
}

/**
 * Drop passages that do not address the question.
 * A named verse stays, because the reference is the passage. A neighbouring verse stays only beside one that was kept.
 */
export function retainRelevantPassages(input: {
  question: string;
  subquestions?: readonly string[];
  passages: readonly EvidencePassage[];
  corpusCount?: boolean;
  science?: boolean;
}): { kept: EvidencePassage[]; rejected: EvidencePassage[] } {
  if (input.corpusCount) return { kept: [...input.passages], rejected: [] };
  const questions = [input.question, ...(input.subquestions ?? [])].filter(Boolean);
  const relevant = (passage: EvidencePassage) => relevantTo(questions, passage);
  const primary = input.passages.filter(passage => {
    if (passage.source.provider === 'Parallel' || passage.role === 'commentary' || passage.context?.startsWith('Neighbouring')) return false;
    if (passage.role === 'empirical') return Boolean(input.science) && relevant(passage);
    return relevant(passage);
  });
  const parallel = input.passages.filter(passage => passage.source.provider === 'Parallel' && relevant(passage));
  const commentary = input.passages.filter(passage =>
    passage.role === 'commentary'
    && passage.source.provider !== 'Parallel'
    && (relevant(passage) || primary.some(verse => discussesKeptVerse(verse, passage))),
  );
  const neighbours = input.passages.filter(passage =>
    passage.context?.startsWith('Neighbouring') && primary.some(verse => isNeighbour(verse, passage)),
  );
  const ids = new Set([...primary, ...commentary, ...parallel, ...neighbours].map(passage => passage.id));
  return {
    kept: input.passages.filter(passage => ids.has(passage.id)),
    rejected: input.passages.filter(passage => !ids.has(passage.id)),
  };
}
