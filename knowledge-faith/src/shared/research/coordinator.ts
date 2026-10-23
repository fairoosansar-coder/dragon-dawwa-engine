import type { ResearchAssignmentView, ResearchNoticeId, ResearchScope, ResearchTeamId } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';
import { contentTokens } from '../research.ts';
import { matchingThemes } from './themes.ts';

const QURAN =
  /qur['’ʼ]?an|\bquran\b|\bverse\b|\bayah\b|\baya\b|\bsurah\b|\bsura\b|\btafsir\b|\btafseer\b|\bmushaf\b|குர்ஆன்|குரான்|வசனம்|ஆயத்|சூரா|தஃப்சீர்|කුර්ආන|වැකි|ආයත|සූරා|තෆ්සීර්|قرآن|آية|سورة|تفسير|\d{1,3}\s*:\s*\d{1,3}/i;

const HADITH =
  /hadith|hadeeth|\bnarration\b|\bnarrator\b|\bisnad\b|\bisnaad\b|\bsanad\b|\bbukhari\b|\bmuslim\b|\btirmidhi\b|abu dawud|nasai|nasa['’]?i|ibn majah|\bsahih\b|\bhasan\b|da['’]?if|\bmatn\b|\btakhrij\b|\brijal\b|\brawi\b|ஹதீஸ்|ஹதீத்|புகாரி|முஸ்லிம்|இஸ்னாத்|விவரிப்பாளர்|හදීස්|බුහාරි|මුස්ලිම්|ඉස්නාද්|حديث|إسناد|بخاري|مسلم/i;

const BOOKS = /\bbooks?\b|\bkitab\b|\blibrary\b|\bvolume\b|புத்தக|நூல்|கிதாப்|පොත|පොත්|ග්‍රන්ථ|كتاب/i;

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
}

export interface CoordinationDecision {
  action: 'research' | 'forward' | 'clarify';
  assignment: ResearchAssignmentView;
  clarificationId: 'meaning' | null;
  fingerprint: string;
}

function signalsOf(text: string, bookId: number | null): { quran: boolean; hadith: boolean; books: boolean } {
  const quran = QURAN.test(text);
  const hadith = HADITH.test(text);
  const booksNamed = BOOKS.test(text);
  const exclusiveOther = quran !== hadith && (quran || hadith) && !booksNamed;
  return {
    quran,
    hadith,
    books: booksNamed || (bookId !== null && !exclusiveOther),
  };
}

function namedTeams(flags: { quran: boolean; hadith: boolean; books: boolean }): ResearchTeamId[] {
  const teams: ResearchTeamId[] = [];
  if (flags.quran) teams.push('quran');
  if (flags.hadith) teams.push('hadith');
  if (flags.books) teams.push('books');
  return teams;
}

function generalTeams(question: string, entry: ResearchScope): ResearchTeamId[] {
  if (entry === 'quran') return ['quran'];
  if (entry === 'hadith') return ['hadith'];
  if (entry === 'books') return ['books'];
  // A general Islamic question is read from the Qur'an and Hadith. Books join only when a book is selected or named.
  if (matchingThemes(question).length || contentTokens(question).length) return ['quran', 'hadith'];
  return ['quran', 'hadith'];
}

export function questionNeedsClarification(question: string): boolean {
  const trimmed = question.replace(/\s+/g, ' ').trim();
  if (!trimmed) return true;
  if (VAGUE.test(trimmed)) return true;
  if (QURAN.test(trimmed) || HADITH.test(trimmed) || BOOKS.test(trimmed) || matchingThemes(trimmed).length) return false;
  return contentTokens(trimmed).length === 0;
}

export function researchFingerprint(question: string, language: string, assignment: Pick<ResearchAssignmentView, 'scope' | 'teams' | 'bookId'>): string {
  const normalized = question.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
  const teams = [...assignment.teams].sort().join('+');
  return `${assignment.scope}|${language}|${assignment.bookId ?? ''}|${teams}|${normalized}`;
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
 * Choose the team for a question. A forward happens once. The same wording keeps one fingerprint.
 */
export function coordinateQuestion(input: CoordinationInput): CoordinationDecision {
  const question = input.question.replace(/\s+/g, ' ').trim();
  const bookId = input.bookId && input.bookId > 0 ? input.bookId : null;
  const own = signalsOf(question, bookId);
  const ownTeams = namedTeams(own);
  const prior = input.priorQuestion?.replace(/\s+/g, ' ').trim() ?? '';
  const followed = ownTeams.length || !prior ? own : signalsOf(`${prior}\n${question}`, bookId);
  const teamsNamed = namedTeams(followed);
  const unclear = questionNeedsClarification(question) && teamsNamed.length === 0;

  const finish = (decision: Omit<CoordinationDecision, 'fingerprint'>): CoordinationDecision => ({
    ...decision,
    fingerprint: researchFingerprint(question, input.language, decision.assignment),
  });

  if (unclear && !input.clarified) {
    return finish({
      action: 'clarify',
      clarificationId: 'meaning',
      assignment: assignmentFor(input.entry, generalTeams(question, input.entry), bookId, null, null),
    });
  }

  const spanning = teamsNamed.length >= 2;
  const scope: ResearchScope = spanning ? 'knowledge' : teamsNamed[0] ?? input.entry;
  const teams = spanning || teamsNamed.length === 1 ? (spanning ? teamsNamed : teamsNamed) : generalTeams(`${prior}\n${question}`, input.entry);
  const destination = spanning ? 'knowledge' : scope;
  const shouldForward = destination !== input.entry;
  const noticeId: ResearchNoticeId | null = !shouldForward
    ? null
    : destination === 'hadith'
      ? 'forward-hadith'
      : destination === 'quran'
        ? 'forward-quran'
        : destination === 'books'
          ? 'forward-books'
          : 'forward-knowledge';

  if (shouldForward && input.forwarded) {
    const stay = generalTeams(question, input.entry);
    return finish({
      action: 'research',
      clarificationId: null,
      assignment: assignmentFor(input.entry, stay.length ? stay : [input.entry === 'knowledge' ? 'quran' : input.entry], bookId, null, null),
    });
  }

  return finish({
    action: shouldForward ? 'forward' : 'research',
    clarificationId: null,
    assignment: assignmentFor(destination, teams, bookId, shouldForward ? noticeId : null, shouldForward ? input.entry : null),
  });
}
