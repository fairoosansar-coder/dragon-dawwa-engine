import type { ResearchAssignmentView, ResearchNoticeId, ResearchScope, ResearchTeamId } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';
import { contentTokens } from '../research.ts';
import { resolveDomainContext } from './agentConfig.ts';
import { matchingThemes } from './themes.ts';

const QURAN =
  /qur['’ʼ]?an|\bquran\b|\bverse\b|\bayah\b|\baya\b|\bsurah\b|\bsura\b|\btafsir\b|\btafseer\b|\bmushaf\b|குர்ஆன்|குரான்|வசனம்|ஆயத்|சூரா|தஃப்சீர்|කුර්ආන|වැකි|ආයත|සූරා|තෆ්සීර්|قرآن|آية|سورة|تفسير|\d{1,3}\s*:\s*\d{1,3}/i;

const HADITH =
  /hadith|hadeeth|\bhadees\b|\bhadis\b|(?:true|real)\s+hades|\bnarration\b|\bnarrator\b|\bisnad\b|\bisnaad\b|\bsanad\b|\bbukhari\b|\bmuslim\b|\btirmidhi\b|abu dawud|nasai|nasa['’]?i|ibn majah|\bsahih\b|\bhasan\b|da['’]?if|\bmatn\b|\btakhrij\b|\brijal\b|\brawi\b|ஹதீஸ்|ஹதீத்|புகாரி|முஸ்லிம்|இஸ்னாத்|விவரிப்பாளர்|හදීස්|බුහාරි|මුස්ලිම්|ඉස්නාද්|حديث|إسناد|بخاري|مسلم/i;

const BOOKS = /\bbooks?\b|\bkitab\b|\blibrary\b|\bvolume\b|புத்தக|நூல்|கிதாப்|පොත|පොත්|ග්‍රන්ථ|كتاب/i;

const STUDY_COLLECTIONS: { id: string; pattern: RegExp }[] = [
  { id: 'bukhari', pattern: /bukh|بخاري/i },
  { id: 'muslim', pattern: /\bmuslim\b|مسلم/i },
  { id: 'abudawud', pattern: /abu dawud|abudawud|أبي داود|ابي داود/i },
  { id: 'tirmidhi', pattern: /tirmidh/i },
  { id: 'nasai', pattern: /nasa['’]?i|\bnasai\b/i },
  { id: 'ibnmajah', pattern: /ibn majah|\bmajah\b/i },
  { id: 'malik', pattern: /muwatta|\bmalik\b/i },
];

export type ResearchTask = 'verify-narration' | 'book-research' | 'general';

/** “People of the Book” and the Torah are scripture names, not a request to open the book library. */
function libraryText(text: string): string {
  return text
    .replace(/people of the books?/gi, ' ')
    .replace(/ahl al-?kit[aā]b/gi, ' ')
    .replace(/أهل الكتاب/g, ' ')
    .replace(/\b(?:torah|tawrah|taurat|tawrat)\b/gi, ' ')
    .replace(/التوراة/g, ' ');
}

function isVerifyNarration(text: string): boolean {
  if (/\b(?:is\s+this|is\s+it|is\s+that)\s+true\b/i.test(text)) return true;
  if (/\b(?:true|real)\s+hades\b/i.test(text)) return true;
  return HADITH.test(text) && /\b(?:true|authentic|verify|verified|correct)\b/i.test(text);
}

/** Classify the task before choosing a library. A narration check is not a book-catalogue request. */
export function classifyResearchTask(question: string): ResearchTask {
  const text = question.replace(/\s+/g, ' ').trim();
  if (isVerifyNarration(text)) return 'verify-narration';
  if (BOOKS.test(libraryText(text))) return 'book-research';
  return 'general';
}

export function namedStudyCollections(text: string): string[] {
  const found: string[] = [];
  for (const collection of STUDY_COLLECTIONS) {
    if (collection.pattern.test(text) && !found.includes(collection.id)) found.push(collection.id);
  }
  return found;
}

const VAGUE =
  /^(what about (this|that|it)|explain( this| that| it)?|why\??|how\??|what\??|இது|அது|ஏன்|මෙය|ඇයි|එය)\s*[?.!؟]*$/i;

export interface CoordinationInput {
  question: string;
  entry: ResearchScope;
  language: Lang;
  bookId?: number | null;
  /** A forward already happened for this question. */
  forwarded?: boolean;
  /** The reader already answered the one clarification. */
  clarified?: boolean;
  priorQuestion?: string | null;
  /** A category card label. An unknown value is ignored and the question is classified instead. */
  domainContext?: string | null;
}

export interface CoordinationDecision {
  action: 'research' | 'forward' | 'clarify';
  assignment: ResearchAssignmentView;
  clarificationId: 'meaning' | null;
  fingerprint: string;
}

function signalsOf(text: string): { quran: boolean; hadith: boolean; books: boolean } {
  return {
    quran: QURAN.test(text),
    hadith: HADITH.test(text),
    books: BOOKS.test(libraryText(text)),
  };
}

function namedTeams(flags: { quran: boolean; hadith: boolean; books: boolean }): ResearchTeamId[] {
  const teams: ResearchTeamId[] = [];
  if (flags.quran) teams.push('quran');
  if (flags.hadith) teams.push('hadith');
  if (flags.books) teams.push('books');
  return teams;
}

function generalTeams(_question: string, entry: ResearchScope): ResearchTeamId[] {
  // The desk is context. A general question is still read from the Qur'an and Hadith.
  const teams: ResearchTeamId[] = ['quran', 'hadith'];
  if (entry === 'books') teams.push('books');
  return teams;
}

export function questionNeedsClarification(question: string): boolean {
  const trimmed = question.replace(/\s+/g, ' ').trim();
  if (!trimmed) return true;
  if (VAGUE.test(trimmed)) return true;
  if (QURAN.test(trimmed) || HADITH.test(trimmed) || BOOKS.test(trimmed) || matchingThemes(trimmed).length) return false;
  return contentTokens(trimmed).length === 0;
}

export function researchFingerprint(
  question: string,
  language: string,
  assignment: Pick<ResearchAssignmentView, 'scope' | 'teams' | 'bookId' | 'domainContext' | 'domainSource'>,
): string {
  const normalized = question.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
  const teams = [...assignment.teams].sort().join('+');
  const domain = assignment.domainContext ? `|${assignment.domainSource ?? 'selected'}|${assignment.domainContext}` : '';
  return `${assignment.scope}|${language}|${assignment.bookId ?? ''}|${teams}|${normalized}${domain}`;
}

function assignmentFor(
  scope: ResearchScope,
  teams: ResearchTeamId[],
  bookId: number | null,
  noticeId: ResearchNoticeId | null,
  forwardedFrom: ResearchScope | null,
): ResearchAssignmentView {
  return { scope, teams, bookId: scope === 'books' || teams.includes('books') ? bookId : null, noticeId, forwardedFrom };
}

/**
 * Choose the specialists for a question. The open section stays the scope.
 * A selected book is added only when the question names no other corpus.
 */
export function coordinateQuestion(input: CoordinationInput): CoordinationDecision {
  const question = input.question.replace(/\s+/g, ' ').trim();
  const bookId = input.bookId && input.bookId > 0 ? input.bookId : null;
  const own = signalsOf(question);
  const ownTeams = namedTeams(own);
  const prior = input.priorQuestion?.replace(/\s+/g, ' ').trim() ?? '';
  const followed = ownTeams.length || !prior ? own : signalsOf(`${prior}\n${question}`);
  const teamsNamed = namedTeams(followed);
  const unclear = questionNeedsClarification(question) && teamsNamed.length === 0;

  const domain = resolveDomainContext(input.domainContext, question);
  const finish = (decision: Omit<CoordinationDecision, 'fingerprint'>): CoordinationDecision => {
    const assignment = { ...decision.assignment, domainContext: domain.label, domainSource: domain.source };
    return {
      ...decision,
      assignment,
      fingerprint: researchFingerprint(question, input.language, assignment),
    };
  };

  if (unclear && !input.clarified) {
    return finish({
      action: 'clarify',
      clarificationId: 'meaning',
      assignment: assignmentFor(input.entry, generalTeams(question, input.entry), bookId, null, null),
    });
  }

  // The open section is context. It does not decide which specialists may run, and it does not move the reader.
  let teams = teamsNamed.length ? [...teamsNamed] : generalTeams(`${prior}\n${question}`, input.entry);
  if (isVerifyNarration(question) && !teams.includes('hadith')) teams = ['hadith', ...teams];
  if (/\bwhen did\b|\bhistory of\b|\bseerah\b|\bs[iī]rah\b|\bbiograph/i.test(question) && !teams.includes('books')) teams.push('books');
  if (bookId && teamsNamed.length === 0 && !teams.includes('books')) teams.push('books');
  return finish({
    action: 'research',
    clarificationId: null,
    assignment: assignmentFor(input.entry, teams, bookId, null, null),
  });
}
