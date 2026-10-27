/**
 * The 14 research categories and the seven sub-agent briefs.
 * A selected card wins. Otherwise the question is classified, and Parallel is told to classify when no card was chosen.
 */

export interface ResearchCategory {
  id: string;
  label: string;
  placeholder: string;
  starters: readonly [string, string, string];
}

export const RESEARCH_CATEGORIES = [
  {
    id: 'comparative-religion',
    label: 'Comparative Religion',
    placeholder: 'Ask how a belief or practice compares with another tradition',
    starters: [
      'What is the difference between Tawhid and the Christian Trinity?',
      'How do the Qur’an and the Torah describe the same prophet?',
      'What does “People of the Book” refer to?',
    ],
  },
  {
    id: 'modern-science',
    label: 'Modern Science & Religion',
    placeholder: 'Ask about a scientific claim and what the sources say',
    starters: [
      'What does embryology say about the stages described in the Qur’an?',
      'How should a scientific paper be read next to a verse?',
      'Which sources separate an empirical finding from a faith claim?',
    ],
  },
  {
    id: 'quran-tafsir',
    label: 'Qur’an & Tafsir',
    placeholder: 'Ask about a verse, its wording, or its explanation',
    starters: [
      'What does Qur’an 2:255 mean, and how should it be applied today?',
      'What do the commentators say about the opening of Surah Al-Baqarah?',
      'How is a verse different from a later explanation of that verse?',
    ],
  },
  {
    id: 'hadith-authentication',
    label: 'Hadith & Authentication',
    placeholder: 'Ask about a narration, its chain, or its grade',
    starters: [
      'What is the hadith about intentions, and how was it graded?',
      'What does the chain of a narration show on its own?',
      'How is a published grade different from a later opinion?',
    ],
  },
  {
    id: 'islamic-history',
    label: 'Islamic History',
    placeholder: 'Ask when something happened, or about a person or event',
    starters: [
      'When did the Battle of Badr take place?',
      'Which book should I read about the life of the Prophet?',
      'What do the sources say about the Hijrah?',
    ],
  },
  {
    id: 'faith-philosophy',
    label: 'Faith & Philosophy',
    placeholder: 'Ask what a belief means',
    starters: [
      'What is Tawhid?',
      'What do the sources say about belief in the unseen?',
      'How is a definition different from a later interpretation?',
    ],
  },
  {
    id: 'fiqh-everyday',
    label: 'Fiqh & Everyday Life',
    placeholder: 'Ask how an act of worship is described',
    starters: [
      'How should wudu be performed?',
      'What do the sources say about the steps of the prayer?',
      'What is the difference between naming an act and describing how it is done?',
    ],
  },
  {
    id: 'culture-vs-religion',
    label: 'Culture vs Religion',
    placeholder: 'Ask what is a local custom and what the sources teach',
    starters: [
      'How can a wedding custom be told apart from a religious duty?',
      'What do the sources say about following local habits?',
      'When is a community practice not a revealed rule?',
    ],
  },
  {
    id: 'contemporary-issues',
    label: 'Contemporary Issues',
    placeholder: 'Ask about a modern ethical question',
    starters: [
      'How do classical ethical frameworks speak about social media?',
      'What do the sources say about artificial intelligence and responsibility?',
      'How should a new technology be discussed without inventing a ruling?',
    ],
  },
  {
    id: 'spirituality',
    label: 'Spirituality',
    placeholder: 'Ask about remembrance, character, or inner worship',
    starters: [
      'What do the sources say about dhikr?',
      'How is ihsan described?',
      'What is the difference between a recorded practice and a personal feeling?',
    ],
  },
  {
    id: 'family-society',
    label: 'Family & Society',
    placeholder: 'Ask about family, neighbors, or life with other people',
    starters: [
      'What are the rights of a neighbor?',
      'What do the sources say about the duties of parents and children?',
      'How is marriage described in the opened sources?',
    ],
  },
  {
    id: 'economics',
    label: 'Economics',
    placeholder: 'Ask about wealth, trade, or a financial teaching',
    starters: [
      'What do the sources say about riba?',
      'How is zakah described?',
      'What is the difference between a financial teaching and a personal calculation?',
    ],
  },
  {
    id: 'scripture-language',
    label: 'Scripture & Language',
    placeholder: 'Ask about Arabic wording, translation, or a language note',
    starters: [
      'What does the Arabic of Ayat al-Kursi say, and what does the translation add?',
      'How should a missing translation be reported?',
      'What is the difference between a word’s wording and its explanation?',
    ],
  },
  {
    id: 'misconceptions',
    label: 'Misconceptions',
    placeholder: 'Ask about a claim you have heard',
    starters: [
      'Is it true that the Qur’an has no historical context?',
      'What do the sources say about a common claim concerning jihad?',
      'How can a popular claim be checked without inventing a debate?',
    ],
  },
] as const satisfies readonly ResearchCategory[];

export type ResearchCategoryId = (typeof RESEARCH_CATEGORIES)[number]['id'];

export type DomainSource = 'selected' | 'classified' | 'unclassified';

export interface SubagentPrompt {
  id: string;
  role: string;
  prompt: string;
}

const SUBAGENTS = [
  ['takhrij', 'Takhrij', 'Survey only the sources this search opened. Do not claim a complete survey of every collection.'],
  ['isnad', 'Isnad', 'Report a narrator chain only when the opened record prints one. Do not draw a chain from memory.'],
  ['rijal', 'Rijal', 'Speak about a narrator only from wording in the opened record. Do not add a grade the source did not print.'],
  ['shawahid', 'Shawahid and matn', 'Compare wordings that were actually opened. Do not treat a repeated citation as independent corroboration.'],
  ['scholars', 'Scholars’ discussion', 'Report a disagreement only when the dossier records one. Do not invent a debate.'],
  ['synthesis', 'Synthesis', 'State what the opened evidence supports and what it leaves open. Do not turn a gap into a finding.'],
  ['hadeethenc', 'HadeethEnc Source Research', 'Cite HadeethEnc only for records that were opened. A missing translation is not an absent subject.'],
] as const;

const SCIENCE = /embryolog|anatom|astronom|cosmolog|geolog|genetic|neuroscien|physiolog|empiric|scientific|\bscience\b|\bexperiment\b|\bfossil\b|\bbiology\b|\bphysics\b|\bchemistry\b/i;
const COMPARATIVE = /trinity|christianity|judaism|hinduism|buddhism|comparative religion|other religions?|people of the book|ahl al-?kit[aā]b/i;
const CULTURE = /culture vs|cultural custom|custom vs|tradition vs religion|\bvs\.? religion\b/i;
const ECONOMICS = /\briba\b|zak[aā][ht]\b|econom|finance|mortgage|cryptocurrenc|\btrade\b|\bwealth\b|bank interest/i;
const CONTEMPORARY = /social media|artificial intelligence|\bai\b|bioethic|climate change|contemporary|modern dilemma|gender ideology|\babortion\b/i;
const FAMILY = /\bfamily\b|\bmarriage\b|\bdivorce\b|\bparents?\b|\bchildren\b|\bneighbors?\b|\bneighbours?\b|\bspouse\b|\bsociety\b/i;
const LANGUAGE = /arabic grammar|root word|etymolog|language of the qur|translation of the word/i;
const HISTORY = /\bbattle\b|\bseerah\b|\bs[iī]rah\b|\bhijra|\bhistory\b|\bcaliph|\bbiograph/i;
const HADITH = /hadith|hadeeth|\bisnad\b|\bisn[aā]d\b|bukhari|authenticat|\bnarration\b/i;
const QURAN = /qur['’ʼ]?an|\bquran\b|\btafsir\b|\btafseer\b|\bayah\b|\bsurah\b|\d{1,3}\s*:\s*\d{1,3}/i;
const SPIRITUAL = /spiritual|\bdhikr\b|\bdua\b|\bihsan\b|iḥsān|tasawwuf/i;
const FAITH = /tawhid|tawheed|tawḥīd|aqidah|aqeedah|philosoph|who is allah|\biman\b|\bbelief\b/i;
const FIQH = /wudu|wudhu|\bfiqh\b|\bhalal\b|\bharam\b|\bfast|salah|\bsalat\b|how should .{0,48}perform|\bprayer\b/i;
const MISCONCEPTION = /misconception|\bmyth\b|is it true that|people think|misunderstand/i;

export function categoryById(id: string | null | undefined): ResearchCategory | null {
  return RESEARCH_CATEGORIES.find(category => category.id === id) ?? null;
}

export function categoryByLabel(label: string | null | undefined): ResearchCategory | null {
  const trimmed = label?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return RESEARCH_CATEGORIES.find(category => category.label === trimmed) ?? null;
}

function category(id: ResearchCategoryId): ResearchCategory {
  const found = categoryById(id);
  if (!found) throw new Error(`Unknown research category: ${id}`);
  return found;
}

/** A first reading of the question. Null when none of the 14 categories is clear. */
export function classifyResearchCategory(question: string): ResearchCategory | null {
  const text = question.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (SCIENCE.test(text) && (QURAN.test(text) || /islam|religion|faith|allah/i.test(text))) return category('modern-science');
  if (SCIENCE.test(text)) return category('modern-science');
  if (COMPARATIVE.test(text)) return category('comparative-religion');
  if (CULTURE.test(text)) return category('culture-vs-religion');
  if (MISCONCEPTION.test(text)) return category('misconceptions');
  if (ECONOMICS.test(text)) return category('economics');
  if (CONTEMPORARY.test(text)) return category('contemporary-issues');
  if (FAMILY.test(text)) return category('family-society');
  if (LANGUAGE.test(text)) return category('scripture-language');
  if (HISTORY.test(text)) return category('islamic-history');
  if (HADITH.test(text) && QURAN.test(text)) return null;
  if (HADITH.test(text)) return category('hadith-authentication');
  if (QURAN.test(text)) return category('quran-tafsir');
  if (SPIRITUAL.test(text)) return category('spirituality');
  if (FAITH.test(text)) return category('faith-philosophy');
  if (FIQH.test(text)) return category('fiqh-everyday');
  return null;
}

export function resolveDomainContext(selected: string | null | undefined, question: string): { label: string | null; source: DomainSource } {
  const chosen = categoryByLabel(selected);
  if (chosen) return { label: chosen.label, source: 'selected' };
  const inferred = classifyResearchCategory(question);
  if (inferred) return { label: inferred.label, source: 'classified' };
  return { label: null, source: 'unclassified' };
}

function stanceFor(label: string | null): string {
  switch (label) {
    case 'Comparative Religion':
      return 'Compare only teachings the opened sources state. Do not treat similarity as identity, and do not invent a position the sources did not give.';
    case 'Modern Science & Religion':
      return 'Distinctly separate empirical evidence from faith claims. A scientific record is not scripture, and a verse is not a laboratory result.';
    case 'Qur’an & Tafsir':
      return 'Keep the verse, its translation, and tafsir in their own roles. A section location is context. It does not by itself answer the meaning.';
    case 'Hadith & Authentication':
      return 'Keep the published grade, the chain, and later commentary distinct. Do not upgrade a narration the source did not grade.';
    case 'Islamic History':
      return 'Date an event only from the sentence that times it. Do not merge two campaigns into one total.';
    case 'Faith & Philosophy':
      return 'Explain the belief from the opened texts. Distinguish a definition from a later interpretation.';
    case 'Fiqh & Everyday Life':
      return 'A passage that names an act does not by itself describe how to perform it. Do not issue a personal ruling.';
    case 'Culture vs Religion':
      return 'Separate a cultural custom from a religious teaching. Do not treat a local habit as a revealed rule.';
    case 'Contemporary Issues':
      return 'Evaluate modern technology and social dilemmas through the classical ethical frameworks the opened sources state. Do not invent a ruling for a new case.';
    case 'Spirituality':
      return 'Describe the worship or remembrance the sources record. Do not turn a personal feeling into a ruling.';
    case 'Family & Society':
      return 'Keep family and social duties with the evidence that states them. Do not generalize one household into a rule for every household.';
    case 'Economics':
      return 'Keep financial teachings with the passages that state them. Do not calculate a personal obligation.';
    case 'Scripture & Language':
      return 'Keep the Arabic wording, the translation, and any language note distinct. A missing translation is not an absent subject.';
    case 'Misconceptions':
      return 'State the claim that was asked and the evidence that answers it. Do not invent a debate the sources do not contain.';
    default:
      return 'No category was selected. Do not assume a specialty until the question is classified into one of the 14 categories.';
  }
}

/** Swap the seven sub-agent briefs for the category. An unknown label keeps the unclassified brief. */
export function promptsForDomain(domainContext: string | null | undefined): SubagentPrompt[] {
  const known = categoryByLabel(domainContext);
  const stance = stanceFor(known?.label ?? null);
  return SUBAGENTS.map(([id, role, base]) => ({
    id,
    role,
    prompt: `${base} ${stance}`,
  }));
}

export function parallelTaskInput(question: string, domainContext: string | null, source: DomainSource): string {
  const labels = RESEARCH_CATEGORIES.map(item => item.label).join('; ');
  const prompts = promptsForDomain(domainContext);
  const briefs = prompts.map(item => `${item.role}: ${item.prompt}`).join('\n');
  if (source === 'selected' && domainContext) {
    return [`domainContext: ${domainContext}`, question, '', 'Sub-agent instructions:', briefs].join('\n');
  }
  if (domainContext) {
    return [
      'The reader did not select a category.',
      `Before dispatching the seven sub-agents, classify this question into exactly one of: ${labels}.`,
      `A first reading places it in ${domainContext}. Confirm or correct that classification, then apply the sub-agent instructions for the confirmed category.`,
      `domainContext: ${domainContext}`,
      question,
      '',
      'Sub-agent instructions for the first reading:',
      briefs,
    ].join('\n');
  }
  const stances = RESEARCH_CATEGORIES.map(item => `${item.label}: ${stanceFor(item.label)}`).join('\n');
  return [
    'The reader did not select a category.',
    `Before dispatching the seven sub-agents, classify this question into exactly one of: ${labels}.`,
    'Then apply that category’s stance. Do not leave the category unnamed.',
    question,
    '',
    'Category stances:',
    stances,
    '',
    'Sub-agent roles before a category is confirmed:',
    briefs,
  ].join('\n');
}
