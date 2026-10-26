import type { EvidencePassage } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';

export type MaterialKind = 'locate' | 'meaning' | 'application' | 'worship' | 'history' | 'science' | 'hadith' | 'quran' | 'books';

export interface MaterialPart {
  id: string;
  kind: MaterialKind;
  text: string;
}

const MEANING = /mean(?:ing|s)?|explain|implication|interpret|\bwhy\b|நிலை|அர்த்த|விளக்க|අර්ථ|තත්ත්ව|ඇයි|කියන්නේ/i;
const APPLICATION = /today|modern|nowadays|appl(?:y|ication)|contemporary|இன்று|நவீன|අද|නූතන|යොදව/i;
const WORSHIP = /pray|prayer|ṣalāh|salah|fast|fasting|charit|zakat|wudu|worship|தொழு|நோன்பு|தர்ம|සලාත|උපවාස|දාන|වන්දන/i;
const HISTORY = /when did|history|seerah|sīrah|biography|battle|\byear\b|சரித்திர|வரலாறு|ඉතිහාස|සීරා/i;
const SCIENCE = /scienti|physics|biology|medicine|empirical|\bscience\b|அறிவியல்|விஞ்ஞான|විද්‍යා/i;
const HADITH = /hadith|hadeeth|\bhades\b|narration|bukhari|muslim|ஹதீஸ்|හදීස්|حديث/i;
const QURAN = /qur['’]?an|\bverse\b|\bayah\b|\bsurah\b|குர்ஆன்|வசனம்|කුර්ආන|වැකි|قرآن/i;
const BOOKS = /\bbooks?\b|\blibrary\b|\bvolume\b|புத்தக|நூல்|පොත්|පොත/i;

export function materialParts(question: string): MaterialPart[] {
  const text = question.replace(/\s+/g, ' ').trim();
  const parts: MaterialPart[] = [];
  const push = (kind: MaterialKind) => {
    if (!parts.some(part => part.kind === kind)) parts.push({ id: kind, kind, text });
  };
  push('locate');
  if (MEANING.test(text)) push('meaning');
  if (APPLICATION.test(text)) push('application');
  if (WORSHIP.test(text)) push('worship');
  if (HISTORY.test(text)) push('history');
  if (SCIENCE.test(text)) push('science');
  if (HADITH.test(text)) push('hadith');
  if (QURAN.test(text)) push('quran');
  if (BOOKS.test(text) && !/people of the books?/i.test(text)) push('books');
  return parts;
}

function scriptKind(text: string): 'ta' | 'si' | 'en' | 'ar' | 'other' {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  if (/[\u0600-\u06FF]/.test(text) && !/[A-Za-z]/.test(text)) return 'ar';
  if (/[A-Za-z]/.test(text)) return 'en';
  return 'other';
}

/** A passage can support an answer only in the language the reader asked for. Arabic may sit beside that text. */
export function passageMatchesLanguage(passage: Pick<EvidencePassage, 'text' | 'role'>, language: Lang): boolean {
  const script = scriptKind(passage.text);
  if (script === 'ar' || script === 'other') return true;
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

function discussesApplication(passage: EvidencePassage): boolean {
  return APPLICATION.test(`${passage.text}\n${passage.context ?? ''}`);
}

function partAnswered(kind: MaterialKind, passages: readonly EvidencePassage[]): boolean {
  if (kind === 'meaning') return passages.some(explains);
  if (kind === 'application') return passages.some(discussesApplication);
  if (kind === 'science') return passages.some(passage => passage.role === 'empirical' || passage.source.contentType === 'science');
  if (kind === 'history') return passages.some(passage => HISTORY.test(`${passage.text}\n${passage.context ?? ''}\n${passage.locator}`));
  if (kind === 'worship') return passages.some(passage => WORSHIP.test(`${passage.text}\n${passage.locator}`));
  if (kind === 'hadith') return passages.some(passage => passage.source.contentType === 'hadith');
  if (kind === 'quran') return passages.some(passage => passage.source.contentType === 'quran');
  if (kind === 'books') return passages.some(passage => passage.source.contentType === 'book');
  return passages.some(passage => passage.text.trim().length > 20);
}

/**
 * Every material part is answered from a same-language passage, or marked unresolved.
 * A quotation does not answer a request for meaning or modern application.
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
  const quoted = sameLanguage.some(passage => passage.text.trim().length > 20);
  const explained = sameLanguage.some(explains);
  const applied = sameLanguage.some(discussesApplication);

  const parts: ReviewedPart[] = requested.map(part => {
    if (input.providerFailed && sameLanguage.length === 0) {
      return { ...part, status: 'unresolved', note: 'The source did not respond, so this part is not answered. That is a provider failure, not a finding that the subject is absent.' };
    }
    if (wrongLanguage) {
      return { ...part, status: 'unresolved', note: `The opened text is not in the selected language (${input.language}). It is not used as the answer.` };
    }
    if (part.kind === 'meaning') {
      return explained
        ? { ...part, status: 'answered', note: 'An attributed explanation in the selected language addresses this part.' }
        : { ...part, status: 'unresolved', note: 'A quotation was not treated as the meaning. No attributed explanation in the selected language addresses it.' };
    }
    if (part.kind === 'application') {
      return applied
        ? { ...part, status: 'answered', note: 'A retrieved passage discusses the modern application.' }
        : { ...part, status: 'unresolved', note: 'Identifying a quotation does not answer the modern application. That part stays open.' };
    }
    if (part.kind === 'locate') {
      return quoted
        ? { ...part, status: 'answered', note: 'A passage in the selected language was opened for this part.' }
        : { ...part, status: 'unresolved', note: 'No passage in the selected language was opened for this part.' };
    }
    if (partAnswered(part.kind, sameLanguage)) {
      return { ...part, status: 'answered', note: 'A passage in the selected language addresses this part.' };
    }
    return { ...part, status: 'unresolved', note: 'No passage in the selected language was opened for this part.' };
  });

  const unresolved = parts.filter(part => part.status === 'unresolved').map(part => `${part.kind}: ${part.note}`);
  let investigation: 'complete' | 'partial' | 'blocked' = 'complete';
  if (input.providerFailed && sameLanguage.length === 0) investigation = 'blocked';
  else if (parts.some(part => part.status === 'unresolved')) investigation = 'partial';
  return { parts, investigation, unresolved, wrongLanguage };
}
