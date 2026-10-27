import type { EvidencePassage } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';
import { ayahsMentioned, contentTokens, passageSupportsTopic } from '../research.ts';
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
const SCIENCE = /scienti|physics|biology|chemistry|medicine|clinical|metabolic|empirical|\bscience\b|embryolog|anatom|astronom|cosmolog|geolog|genetic|neuroscien|physiolog|அறிவியல்|விஞ்ஞான|විද්‍යා/i;
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

const RECORDED_PRACTICE = /recite|when you go to your bed|before you sleep|give in charity|\bperform wud|\bwash(?:ing)?\b the hands|ஓது|படுக்க|நோன்பு|தொழு|කියව|නිද|උපවාස|සලාත|වුදූ/i;
const METHOD = /\bwash(?:ing)?\b the (?:hands|face|arms|feet|head)|\brinse\b|\bwipe\b|\bthree times\b|\bbegins with\b|\bthen (?:wash|wipe|rinse)\b/i;

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

/**
 * Commentary opened beside a same-language ayah stays available for synthesis.
 * A Tamil or Sinhala tafsir may be missing; the opened Arabic or English commentary is then translated, not discarded.
 * An unrelated verse in the wrong language is not kept by this rule.
 */
export function commentaryAccompaniesOpenedAyah(
  passage: Pick<EvidencePassage, 'text' | 'role' | 'source' | 'locator'>,
  language: Lang,
  passages: readonly Pick<EvidencePassage, 'text' | 'role' | 'context' | 'source' | 'locator'>[],
): boolean {
  if (passage.role !== 'commentary' || passage.source.provider === 'Parallel') return false;
  if (!passage.text.trim() || passageMatchesLanguage(passage, language)) return false;
  return passages.some(item => {
    if (!isOpenedAyah(item) || !passageMatchesLanguage(item, language)) return false;
    const surah = Number(item.source.id.split(':')[0]);
    if (!Number.isFinite(surah) || surah < 1) return false;
    const blob = `${passage.locator} ${passage.source.id}`;
    return passage.source.id === `tafsir-${surah}` || new RegExp(`(?:^|[^\\d])${surah}:`).test(blob);
  });
}

/**
 * An ayah the research engine opened for this question.
 * Keyword overlap with the reader’s sentence is not required.
 * A neighbouring ayah is context and is not itself the answer.
 */
export function isOpenedAyah(passage: Pick<EvidencePassage, 'role' | 'context' | 'source'>): boolean {
  if (passage.role === 'commentary' || passage.role === 'empirical') return false;
  if (passage.context?.startsWith('Neighbouring')) return false;
  return (
    (passage.source.provider === 'QuranEnc' || passage.source.provider === 'AlQuran')
    && passage.source.contentType === 'quran'
  );
}

function passageBlob(passage: EvidencePassage): string {
  return `${passage.text}\n${passage.arabic ?? ''}`;
}

function passageRecord(passage: EvidencePassage): string {
  return `${passageBlob(passage)}\n${passage.context ?? ''}`;
}

const WHEN = /\bwhen\b|\bwhat year\b|\bwhich year\b|\btake place\b|\boccurred\b|\bhappened\b/i;
const TIME = /\b\d{1,4}\s*(?:ah|ce|bh)\b|\b(?:1[0-9]{3}|20[0-9]{2})\b|\b(?:year|month)s?\b|\bhijrah\b|\bhijri\b/i;
const WHEN_STOP = new Set(['when', 'did', 'does', 'take', 'place', 'battle', 'occur', 'occurred', 'happen', 'happened', 'year', 'history', 'library']);

/** A “when” question. A date attached to a different event is not an answer. */
export function asksWhen(question: string): boolean {
  return WHEN.test(question);
}

/** The sentence that times the asked subject. A year beside another name is left out. */
export function timingClause(question: string, blob: string): string | null {
  if (!asksWhen(question)) return null;
  const subjects = contentTokens(question).filter(token => !WHEN_STOP.has(token) && token.length >= 4);
  if (!subjects.length) return null;
  const sentences = blob.replace(/\s+/g, ' ').split(/(?<=[.!?؟])\s/);
  for (const sentence of sentences) {
    const text = sentence.split(/Language edition:/i)[0].trim();
    const lower = text.toLocaleLowerCase('en');
    if (!subjects.some(token => lower.includes(token))) continue;
    const match = text.match(TIME);
    if (!match || match.index == null) continue;
    const start = Math.max(0, match.index - 90);
    const end = Math.min(text.length, match.index + match[0].length + 90);
    let window = text.slice(start, end).trim();
    if (!subjects.some(token => window.toLocaleLowerCase('en').includes(token))) continue;
    if (start > 0) window = `…${window}`;
    if (end < text.length) window = `${window}…`;
    return window;
  }
  return null;
}

function supportsQuestion(question: string, passage: EvidencePassage): boolean {
  return passageSupportsTopic(question, passageBlob(passage));
}

function partAnswered(kind: MaterialKind, passages: readonly EvidencePassage[], question: string): boolean {
  const topical = passages.filter(passage => supportsQuestion(question, passage));
  const named = passages.filter(passage => isNamedReference(question, passage));
  if (kind === 'meaning') return passages.some(explains);
  if (kind === 'application') return passages.some(discussesApplication);
  if (kind === 'explanation' || kind === 'purpose') {
    if (passages.some(isOpenedAyah)) return true;
    return topical.some(passage => definesSubject(question, passage));
  }
  if (kind === 'authentication') {
    return topical.some(passage => passage.publishedGrade || /isnad|chain of narration|fabricat|authentic|grade/i.test(`${passage.text}\n${passage.context ?? ''}`));
  }
  if (kind === 'comparison') {
    return topical.length >= 2 || topical.some(passage => /differ|unlike|whereas|comparison|வேறுபாடு|වෙනස/i.test(passage.text));
  }
  if (kind === 'practice') {
    return topical.some(passage => {
      if (/\bhow should\b|\bhow do\b|\bhow to\b|எப்படி|කෙසේ/i.test(question)) return METHOD.test(passage.text);
      return recordsPractice(passage.text) || WORSHIP.test(`${passage.text}\n${passage.locator}`);
    });
  }
  if (kind === 'science') {
    return passages.some(passage =>
      (passage.role === 'empirical' || passage.source.contentType === 'science') && supportsQuestion(question, passage),
    );
  }
  if (kind === 'history') {
    if (asksWhen(question)) return passages.some(passage => timingClause(question, passageRecord(passage)));
    return topical.some(passage => HISTORY.test(`${passage.text}\n${passage.context ?? ''}\n${passage.locator}`));
  }
  if (kind === 'worship') return topical.some(passage => WORSHIP.test(`${passage.text}\n${passage.locator}`));
  if (kind === 'hadith') return [...topical, ...named].some(passage => passage.source.contentType === 'hadith');
  if (kind === 'quran') {
    return passages.some(passage => passage.source.contentType === 'quran' && (isOpenedAyah(passage) || named.includes(passage) || topical.includes(passage)));
  }
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
      if (explained) {
        const translatedCommentary = sameLanguage.some(passage =>
          passage.role === 'commentary'
          && passage.source.provider !== 'Parallel'
          && !passageMatchesLanguage(passage, input.language),
        );
        return translatedCommentary && (input.language === 'ta' || input.language === 'si')
          ? { ...part, status: 'answered', note: 'The opened commentary is read in the selected language from the Arabic or English wording that was opened. Nothing beyond that wording is added.' }
          : { ...part, status: 'answered', note: 'An attributed explanation in the selected language addresses this part.' };
      }
      return { ...part, status: 'unresolved', note: 'A quotation was not treated as the meaning. No attributed explanation in the selected language addresses it.' };
    }
    if (part.kind === 'application') {
      return applied
        ? { ...part, status: 'answered', note: 'A retrieved passage discusses the modern application.' }
        : { ...part, status: 'unresolved', note: applicationNote(input.language) };
    }
    if (part.kind === 'locate') {
      return partAnswered('locate', sameLanguage, input.question) || sameLanguage.some(isOpenedAyah)
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
    if (part.kind === 'practice' && !partAnswered('practice', sameLanguage, input.question) && sameLanguage.some(passage => supportsQuestion(input.question, passage))) {
      return { ...part, status: 'unresolved', note: 'A passage names this act. It does not describe how it is performed, so that part stays open.' };
    }
    if (part.kind === 'history' && asksWhen(input.question) && !partAnswered('history', sameLanguage, input.question)) {
      return { ...part, status: 'unresolved', note: 'The opened records do not state when this happened, so that part stays open.' };
    }
    if (partAnswered(part.kind, sameLanguage, input.question)) {
      return { ...part, status: 'answered', note: 'A passage in the selected language addresses this part.' };
    }
    if (sameLanguage.some(isOpenedAyah)) {
      return { ...part, status: 'unresolved', note: 'The opened ayah stays with the reader. What the opened commentary does not state is left unnamed.' };
    }
    return { ...part, status: 'unresolved', note: 'No passage in the selected language addresses this part of the question.' };
  });

  const unresolved = [...new Set(parts.filter(part => part.status === 'unresolved').map(part => part.note))];
  let investigation: 'complete' | 'partial' | 'blocked' = 'complete';
  if (input.providerFailed && sameLanguage.length === 0) investigation = 'blocked';
  else if (parts.some(part => part.status === 'unresolved') || sameLanguage.length === 0) investigation = 'partial';
  return { parts, investigation, unresolved, wrongLanguage };
}

const DEFINES = /\b(?:means|meaning of|is to|refers to|defined as|consists of|known as|that is|namely)\b|\bis (?:to|the|a|an)\b|என்பது|යනු/i;

/** A “what is” question asks for a definition. Naming the subject in another claim does not answer it. */
function definitionQuestion(question: string): boolean {
  if (!/\bwhat is\b|\bwhat are\b|என்றால் என்ன|என்பது என்ன|යනු කුමක්/i.test(question)) return false;
  const kinds = new Set(materialParts(question).map(part => part.kind));
  return [...kinds].every(kind => kind === 'explanation' || kind === 'purpose');
}

function definesSubject(question: string, passage: EvidencePassage): boolean {
  if (!definitionQuestion(question)) return true;
  if (passage.role === 'commentary' || passage.source.provider === 'Parallel') return true;
  return DEFINES.test(`${passage.text}\n${passage.context ?? ''}`);
}

function relevantTo(questions: readonly string[], passage: EvidencePassage): boolean {
  if (isOpenedAyah(passage)) return true;
  if (questions.some(question => isNamedReference(question, passage))) return true;
  const blob = passageRecord(passage);
  const topical = questions.some(question => passageSupportsTopic(question, blob) || themeWordingSupports(question, blob));
  if (!topical) return false;
  if (questions.length && questions.every(asksWhen) && !questions.some(question => timingClause(question, blob))) return false;
  return questions.every(question => definesSubject(question, passage));
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
