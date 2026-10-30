import type { AgentContribution, ClaimEvidence, CoverageNote, EvidencePassage, ResearchTeamId } from '../../shared/contracts/v1.ts';

export interface OpenedBook {
  id: number;
  title: string;
  availability: string;
  limitation: string | null;
  matched: number;
  blocks: number;
  url: string | null;
}

export interface TafsirAttempt {
  surah: number;
  ok: boolean;
  detail: string;
}

const HADITH_ROLES = [
  ['takhrij', 'Takhrij'],
  ['isnad', 'Isnad'],
  ['rijal', 'Rijal'],
  ['shawahid', 'Shawahid and matn'],
  ['scholars', 'Scholars’ discussion'],
  ['synthesis', 'Synthesis'],
  ['hadeethenc', 'HadeethEnc Source Research'],
] as const;

const QURAN_ROLES = [
  ['text', 'Qur’an text'],
  ['translation', 'Translation'],
  ['tafsir', 'Tafsir'],
  ['context', 'Contextual research'],
  ['evidence', 'Evidence review'],
] as const;

const BOOK_ROLES = [
  ['discovery', 'Discovery'],
  ['fulltext', 'Full-text retrieval'],
  ['passage', 'Passage analysis'],
  ['comparison', 'Comparison'],
  ['reference', 'Reference checking'],
] as const;

function agent(team: ResearchTeamId, id: string, role: string, status: AgentContribution['status'], detail: string): AgentContribution {
  return { id: `${team}-${id}`, team, role, status, detail };
}

function idle(team: ResearchTeamId, roles: readonly (readonly [string, string])[], detail: string): AgentContribution[] {
  return roles.map(([id, role]) => agent(team, id, role, 'not_run', detail));
}

export function buildAgentContributions(input: {
  teams: readonly ResearchTeamId[];
  question: string;
  passages: readonly EvidencePassage[];
  coverage: readonly CoverageNote[];
  claims: readonly ClaimEvidence[];
  queries: readonly string[];
  books: readonly OpenedBook[];
  tafsir: readonly TafsirAttempt[];
  contextCount: number;
}): AgentContribution[] {
  const contributions: AgentContribution[] = [];
  if (input.teams.includes('hadith')) contributions.push(...hadithAgents(input));
  if (input.teams.includes('quran')) contributions.push(...quranAgents(input));
  if (input.teams.includes('books')) contributions.push(...bookAgents(input));
  return contributions;
}

function hadithAgents(input: {
  passages: readonly EvidencePassage[];
  coverage: readonly CoverageNote[];
  queries: readonly string[];
}): AgentContribution[] {
  const records = input.passages.filter(passage => passage.source.provider === 'HadeethEnc');
  const notes = input.coverage.filter(note => note.provider === 'HadeethEnc' || note.provider === 'planner');
  const attempted = input.queries.length > 0 || notes.length > 0 || records.length > 0;
  if (!attempted) {
    return idle('hadith', HADITH_ROLES, 'The Hadith team was assigned, but no HadeethEnc search ran.');
  }
  const failed = notes.some(note => note.kind === 'source_unavailable' || note.kind === 'language_unavailable');
  const searchDetail = [
    input.queries.length ? `Searches: ${input.queries.join(' · ')}.` : 'No search phrase was built.',
    records.length
      ? `Opened ${records.length} record(s): ${records.map(record => `${record.locator}${record.publishedGrade ? ` (grade printed by the source: ${record.publishedGrade})` : ' (no grade printed)'}`).join('; ')}.`
      : 'No HadeethEnc record was opened.',
    ...notes.map(note => note.detail),
  ].join(' ');

  const sourceAgent = agent(
    'hadith',
    'hadeethenc',
    'HadeethEnc Source Research',
    failed && records.length === 0 ? 'unavailable' : 'ran',
    searchDetail,
  );

  const takhrij = agent(
    'hadith',
    'takhrij',
    'Takhrij',
    records.length || input.queries.length ? 'ran' : 'not_run',
    records.length
      ? `The opened records are the takhrij for this search. ${records.map(record => record.locator).join('; ')}. This list is only what was opened. It is not a complete survey of every collection.`
      : 'Searches ran and no record was opened, so there is no source list to survey.',
  );

  const chain = records.find(record => record.locator.split(/\s+(?:from|عن)\s+/i).length >= 2);
  const isnad = chain
    ? agent('hadith', 'isnad', 'Isnad', 'ran', `A narrator sequence is printed on ${chain.locator}. The map uses only those names.`)
    : agent('hadith', 'isnad', 'Isnad', 'not_run', 'The opened records did not include a narrator-by-narrator chain, so no chain was assessed and no chain map was drawn.');

  const judged = records.filter(record => /thiqa|trustworthy|weak|liar|matruk|majhul|صدوق|ضعيف|ثقة/i.test(`${record.text} ${record.context ?? ''}`));
  const rijal = judged.length
    ? agent('hadith', 'rijal', 'Rijal', 'ran', `The opened text contains narrator wording: ${judged.map(record => record.locator).join('; ')}. No narrator was graded beyond that wording.`)
    : agent('hadith', 'rijal', 'Rijal', 'not_run', 'Narrator biographies were not in the opened records, so no narrator was assessed.');

  const shawahid =
    records.length >= 2
      ? agent(
          'hadith',
          'shawahid',
          'Shawahid and matn',
          'ran',
          `These records were opened together: ${records.map(record => record.locator).join('; ')}. Their wording is kept in the report. Differences are not resolved into one narration.`,
        )
      : agent('hadith', 'shawahid', 'Shawahid and matn', 'not_run', 'Fewer than two narrations were opened, so corroboration was not compared.');

  const explained = records.filter(record => record.context);
  const scholars = explained.length
    ? agent(
        'hadith',
        'scholars',
        'Scholars’ discussion',
        'ran',
        explained.map(record => `${record.locator}: ${record.context}`).join(' '),
      )
    : agent('hadith', 'scholars', 'Scholars’ discussion', 'not_run', 'The opened records did not include a scholarly discussion, so none was written.');

  const synthesis = agent(
    'hadith',
    'synthesis',
    'Synthesis',
    'ran',
    `Question: ${inputQueries(input.queries)} Opened: ${records.length}. ${records.map(record => record.locator).join('; ') || 'No record was opened.'} Grades stay as printed. A missing chain, narrator note, or discussion is left missing.`,
  );

  return [takhrij, isnad, rijal, shawahid, scholars, synthesis, sourceAgent];
}

function inputQueries(queries: readonly string[]): string {
  return queries.length ? queries.join(' · ') : 'no phrase';
}

function quranAgents(input: {
  question: string;
  passages: readonly EvidencePassage[];
  claims: readonly ClaimEvidence[];
  tafsir: readonly TafsirAttempt[];
  contextCount: number;
  coverage: readonly CoverageNote[];
}): AgentContribution[] {
  const verses = input.passages.filter(passage => passage.source.provider === 'QuranEnc' && passage.role !== 'commentary');
  const arabic = verses.filter(passage => passage.arabic);
  const translated = verses.filter(passage => passage.text.trim());
  const commentary = input.passages.filter(passage => passage.role === 'commentary');
  const tried = verses.length > 0 || input.tafsir.length > 0 || input.coverage.some(note => note.provider === 'QuranEnc');
  if (!tried) {
    return idle('quran', QURAN_ROLES, 'No verse was identified, so the Qur’an team did not open a text.');
  }
  const locators = verses.map(passage => passage.locator).join('; ');
  const text = arabic.length
    ? agent('quran', 'text', 'Qur’an text', 'ran', `Arabic was retrieved for ${locators}.`)
    : agent('quran', 'text', 'Qur’an text', 'unavailable', 'A verse was requested and the Arabic text did not come back.');
  const translators = [...new Set(translated.flatMap(passage => passage.source.credits.map(credit => credit.name).filter(Boolean)))];
  const translation = translated.length
    ? agent('quran', 'translation', 'Translation', 'ran', `Translation retrieved${translators.length ? ` (${translators.join(', ')})` : ''} for ${locators}.`)
    : agent('quran', 'translation', 'Translation', 'unavailable', 'The verse request did not include a translation.');
  const tafsirFailed = input.tafsir.filter(item => !item.ok);
  const tafsir = commentary.length
    ? agent('quran', 'tafsir', 'Tafsir', 'ran', `Al-Mukhtasar was opened for the cited ayahs. ${commentary.map(passage => passage.locator).join('; ')}.`)
    : tafsirFailed.length
      ? agent('quran', 'tafsir', 'Tafsir', 'unavailable', tafsirFailed.map(item => item.detail).join(' '))
      : agent('quran', 'tafsir', 'Tafsir', 'not_run', 'No commentary was requested because no verse was kept.');
  const context = input.contextCount
    ? agent('quran', 'context', 'Contextual research', 'ran', `${input.contextCount} neighbouring ayah(s) were opened so the cited verse is not read alone.`)
    : agent('quran', 'context', 'Contextual research', 'not_run', 'No neighbouring ayah was opened.');
  const evidence = agent(
    'quran',
    'evidence',
    'Evidence review',
    'ran',
    input.claims.length
      ? input.claims.map(claim => `${claim.support}: ${claim.note}`).join(' ')
      : 'The retrieved verses were checked against the question. A citation is not support by itself.',
  );
  return [text, translation, tafsir, context, evidence];
}

function bookAgents(input: { books: readonly OpenedBook[]; passages: readonly EvidencePassage[]; coverage: readonly CoverageNote[] }): AgentContribution[] {
  const bookPassages = input.passages.filter(passage => passage.source.provider === 'IslamHouse');
  if (!input.books.length) {
    const stopped = input.coverage.some(note => note.kind === 'budget_exhausted');
    return [
      agent(
        'books',
        'discovery',
        'Discovery',
        stopped ? 'unavailable' : 'ran',
        stopped
          ? 'The time budget ended before a book was opened. This is incomplete research, not a finding that the library is silent.'
          : 'The book search ran. No readable item was opened.',
      ),
      ...idle('books', BOOK_ROLES.slice(1), 'No book was opened, so this role did not run.'),
    ];
  }
  const discovery = agent(
    'books',
    'discovery',
    'Discovery',
    'ran',
    `Items opened: ${input.books.map(book => `${book.title || 'Untitled'} (${book.id})`).join('; ')}.`,
  );
  const withText = input.books.filter(book => book.blocks > 0);
  const withoutText = input.books.filter(book => book.blocks === 0);
  const fulltext = withText.length
    ? agent('books', 'fulltext', 'Full-text retrieval', 'ran', `Full text was read for ${withText.map(book => book.id).join(', ')}.`)
    : agent(
        'books',
        'fulltext',
        'Full-text retrieval',
        'unavailable',
        withoutText.map(book => book.limitation || `Item ${book.id} did not include readable text. The catalogue description is not the book.`).join(' '),
      );
  const passage = bookPassages.length
    ? agent('books', 'passage', 'Passage analysis', 'ran', `${bookPassages.length} passage(s) share the question’s terms and are quoted in the report.`)
    : agent(
        'books',
        'passage',
        'Passage analysis',
        withText.length ? 'ran' : 'not_run',
        withText.length
          ? 'The opened text did not share a content term with the question, so no paragraph is cited as support.'
          : 'There was no full text to analyse.',
      );
  const comparison =
    bookPassages.length >= 2
      ? agent('books', 'comparison', 'Comparison', 'ran', 'More than one book passage was kept. They are listed separately and are not merged into one statement.')
      : agent('books', 'comparison', 'Comparison', 'not_run', 'Fewer than two book passages were kept, so nothing was compared.');
  const reference = agent(
    'books',
    'reference',
    'Reference checking',
    'ran',
    input.books
      .map(book => `${book.id}: ${book.availability}. ${book.url ?? 'No canonical URL.'} ${book.limitation ?? ''}`.trim())
      .join(' '),
  );
  return [discovery, fulltext, passage, comparison, reference];
}
