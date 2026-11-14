/**
 * Dedicated preloaded 7-agent dossiers for Qur'an & The Modern World hub cards.
 * These must never reuse the gold-ring benchmark content.
 */

import type {
  ModernScienceForesight,
  RoundtableTurn,
  SevenAgentResearchDossier,
  SpecialistAgentFinding,
} from '../shared/sevenAgentTypes.ts';
import {
  matchModernWorldBenchmark,
  modernWorldBenchmarkById,
  modernWorldReportId,
  type ModernWorldBenchmark,
} from '../shared/modernWorldBenchmarks.ts';

const AGENT_HEADERS = {
  quran_tafsir: {
    title: 'Agent 01 · Qur’anic Foundation & Tafsir',
    personaName: 'Dr. Layla al-Qasimi',
    roleBadge: 'Qur’anic Exegesis & Contextual Revelation',
  },
  hadith_sunnah: {
    title: 'Agent 02 · Prophetic Hadith & Sunnah Evidence',
    personaName: 'Dr. Tariq al-Mansoor',
    roleBadge: 'Kutub al-Sittah & Primary Hadith Retrieval',
  },
  isnad_rijal: {
    title: 'Agent 03 · Isnad & Authenticity Verification',
    personaName: 'Sheikh Imran al-Hasani',
    roleBadge: 'Narrator Chain (Rijal) & Grading Audit',
  },
  fiqh_consensus: {
    title: 'Agent 04 · Classical Fiqh & Scholarly Consensus',
    personaName: 'Shaykh Farhan al-Rashed',
    roleBadge: 'Four Sunni Schools, Ijma‘ & Practical Exceptions',
  },
  linguistic_maqasid: {
    title: 'Agent 05 · Linguistic Roots & Maqasid Wisdom',
    personaName: 'Dr. Amina al-Kindi',
    roleBadge: 'Arabic Morphology & Higher Ethical Objectives',
  },
  modern_science: {
    title: 'Agent 06 · Modern Science & Prophetic Foresight (1 Step Ahead)',
    personaName: 'Dr. Zainab al-Mubarak',
    roleBadge: 'Biomedical, Physiological & Empirical Foresight',
  },
  executive_synthesis: {
    title: 'Agent 07 · Executive Verdict & Practical Guidance',
    personaName: 'Sheikh Yusuf al-Azhari',
    roleBadge: 'Final Synthesis & Actionable Seeker Takeaway',
  },
} as const;

function packDossier(input: {
  id: string;
  question: string;
  verdictHeadline: string;
  verdictClassification: string;
  confidenceScore: number;
  executiveSummary: string;
  agents: SpecialistAgentFinding[];
  scienceForesight: ModernScienceForesight;
  roundtableTurns: RoundtableTurn[];
}): SevenAgentResearchDossier {
  return {
    ...input,
    lang: 'en',
    roundtableScriptText: input.roundtableTurns
      .map(turn => `${turn.speaker.toUpperCase()}: ${turn.text}`)
      .join('\n\n'),
    createdAt: new Date().toISOString(),
  };
}

function twentyThreeYearDossier(question: string): SevenAgentResearchDossier {
  const agents: SpecialistAgentFinding[] = [
    {
      agentNumber: 1,
      agentId: 'quran_tafsir',
      ...AGENT_HEADERS.quran_tafsir,
      verdictBadge: 'WAHY · GRADUAL CIVILIZATIONAL REFORM',
      confidenceScore: '98.8%',
      arabicQuote: 'وَكَذَٰلِكَ أَوْحَيْنَآ إِلَيْكَ رُوحًۭا مِّنْ أَمْرِنَا ۚ مَا كُنتَ تَدْرِى مَا ٱلْكِتَـٰبُ وَلَا ٱلْإِيمَـٰنُ',
      arabicReference: 'Surah Ash-Shura 42:52 · Surah Al-‘Alaq 96:1–5 · Surah Al-Jumu‘ah 62:2',
      summary:
        'The Qur’an frames the Prophet’s mission as revelation (Wahy) teaching an unlettered messenger and a previously unlettered community—reciting verses, purifying character, and instructing the Book and Wisdom over a measured span rather than a sudden political coup.',
      keyPoints: [
        'Ash-Shura 42:52: Allah sent a Spirit from His command; the Messenger did not previously know the Book or faith—evidence that the civilizational program begins with Wahy, not prior schooling.',
        'Al-‘Alaq 96:1–5 opens with “Read” and literacy-by-revelation, anchoring the 23-year arc in knowledge and moral formation.',
        'Al-Jumu‘ah 62:2 describes the unlettered Messenger who “recites Our signs, purifies them, and teaches them the Book and Wisdom”—the Qur’anic summary of the transformation.',
      ],
      citations: ['Qur’an 42:52', 'Qur’an 96:1–5', 'Qur’an 62:2', 'Tafsir Ibn Kathir 62:2'],
    },
    {
      agentNumber: 2,
      agentId: 'hadith_sunnah',
      ...AGENT_HEADERS.hadith_sunnah,
      verdictBadge: 'SEERAH · MAKKAH TO MADINAH ARC',
      confidenceScore: '98.4%',
      arabicQuote: 'بُعِثْتُ بِجَوَامِعِ الْكَلِمِ',
      arabicReference: 'Sahih al-Bukhari 2977 · Sahih Muslim 523 · Seerah literature on the 13 + 10 year span',
      summary:
        'Authentic reports and classical Seerah chronology place roughly thirteen years of Makkan moral formation and about ten years of Madinan state-building—together the well-known ~23-year prophetic mission that reshaped Arabian society.',
      keyPoints: [
        'The Prophet ﷺ was sent at about age forty; the Qur’an and Seerah describe him as unlettered (ummi) yet conveying concise, transformative speech (jawami‘ al-kalim — Bukhari 2977).',
        'Makkan phase: creed, patience, and character under persecution; Madinan phase: law, treaties, justice, and communal institutions.',
        'The mission’s success is measured in ethical and legal reform—not invented battlefield tallies—grounded in opened Seerah and Hadith.',
      ],
      citations: ['Sahih al-Bukhari 2977', 'Sahih Muslim 523', 'Ibn Hisham / classical Seerah chronology'],
    },
    {
      agentNumber: 3,
      agentId: 'isnad_rijal',
      ...AGENT_HEADERS.isnad_rijal,
      verdictBadge: 'MULTIPLE ATTESTATION · SEERAH CONSENSUS',
      confidenceScore: '97.9%',
      summary:
        'The 23-year span and the unlettered status of the Messenger are mass-attested themes across Qur’anic self-description and early biographical transmission; historians differ on peripheral details, not on the overall Makkah–Madinah arc.',
      keyPoints: [
        'Qur’anic self-description (ummi / teaching the Book) is mutawatir in meaning across multiple surahs.',
        'Early Maghazi and Seerah compilers (Ibn Ishaq via Ibn Hisham, Ibn Sa‘d) converge on the ~13 + ~10 year structure.',
        'Where numbers of battles or peripheral dates conflict, Dragon Dawwa reports only opened consensus and withholds invented precision.',
      ],
      citations: ['Qur’an 7:157–158', 'Ibn Hisham', 'Ibn Sa‘d, Tabaqat'],
    },
    {
      agentNumber: 4,
      agentId: 'fiqh_consensus',
      ...AGENT_HEADERS.fiqh_consensus,
      verdictBadge: 'GRADUAL LEGISLATION · PUBLIC INTEREST',
      confidenceScore: '97.5%',
      summary:
        'Classical usul recognizes gradual revelation (tadrij) as Divine pedagogy: creed before detailed law, moral restraint before full social statutes—explaining how a fractured tribal society could absorb a coherent Shariah without collapsing.',
      keyPoints: [
        'Tadrij: intoxicants, inheritance, and social statutes arrived in stages after tawhid and purification.',
        'Madinan legislation built institutions—mosque, consultation (shura), contracts, and hudud with evidentiary safeguards.',
        'Scholars across schools treat the Seerah as the lived application of Qur’an and Sunnah, not a separate invented code.',
      ],
      citations: ['Al-Shatibi, Al-Muwafaqat (tadrij)', 'Classical fiqh introductions on Makki/Madani'],
    },
    {
      agentNumber: 5,
      agentId: 'linguistic_maqasid',
      ...AGENT_HEADERS.linguistic_maqasid,
      verdictBadge: 'WAHY · UMMI · HIKMAH',
      confidenceScore: '97.2%',
      summary:
        'Wahy (revelation), ummi (unlettered), and hikmah (wisdom) form the linguistic spine of the transformation claim: guidance arrives from outside human schooling, yet produces measured wisdom that reforms individuals and polities.',
      keyPoints: [
        'Wahy denotes God-given communication, not self-authored philosophy.',
        'Ummi underscores that the source of the civilizational curriculum is revelation, not prior literacy institutions.',
        'Hikmah in 62:2 pairs with the Book—law plus lived wisdom—explaining durable civilizational outcomes.',
      ],
      citations: ['Lisan al-‘Arab (w-h-y)', 'Qur’an 62:2', 'Al-Raghib, Mufradat'],
    },
    {
      agentNumber: 6,
      agentId: 'modern_science',
      ...AGENT_HEADERS.modern_science,
      verdictBadge: '🔬 1 STEP AHEAD · SOCIAL TRANSFORMATION SCIENCE',
      confidenceScore: '96.8%',
      isScienceSpotlight: true,
      summary:
        'Contemporary sociology of religion, behavioral change science, and organizational psychology describe staged norm change, identity fusion, and institutional trust-building—patterns that the 23-year prophetic pedagogy enacted long before these disciplines existed.',
      keyPoints: [
        'Staged behavior change: modern models (awareness → commitment → institutionalization) echo Makkan creed-building before Madinan legislation.',
        'Social capital & trust: Medina’s constitution-like agreements and mosque-centered civic life prefigure research on shared sacred norms reducing intra-group violence.',
        'Literacy and meaning: a revelation-driven knowledge culture mobilized memory, public recitation, and ethical literacy across a previously oral, fragmented society.',
        'Revelation first: believers follow Wahy out of devotion; empirical social science later describes mechanisms the Seerah already practiced.',
      ],
      citations: [
        'Sociology of religion & staged norm change',
        'Social capital / sacred value research',
        'Cognitive science of oral transmission & literacy',
      ],
    },
    {
      agentNumber: 7,
      agentId: 'executive_synthesis',
      ...AGENT_HEADERS.executive_synthesis,
      verdictBadge: 'FINAL VERDICT · WAHY-DRIVEN 23-YEAR CIVILIZATION',
      confidenceScore: '98.6%',
      summary:
        'The 23-year Prophetic transformation is the Qur’an-and-Seerah account of how Wahy taught an unlettered messenger after age forty to purify a people, build institutions, and seed a lasting global civilization—without inventing citations or collapsing the dossier into an unrelated topic.',
      keyPoints: [
        'Direct answer: Revelation enabled moral, legal, and institutional reform across ~13 Makkan + ~10 Madinan years.',
        'Evidence spine: Qur’an 42:52, 62:2, 96:1–5 plus authentic Seerah chronology and jawami‘ al-kalim reports.',
        'Topic lock: this hub card stays on Wahy and the 23-year civilizational arc—never a leftover jewelry ruling from another research run.',
        'Seeker takeaway: study Wahy as pedagogy—creed, character, then institutions—mirroring the Prophetic sequence.',
      ],
      citations: ['Qur’an 62:2', 'Qur’an 42:52', 'Sahih al-Bukhari 2977', 'Classical Seerah'],
    },
  ];

  const scienceForesight: ModernScienceForesight = {
    headline: 'How the 23-Year Prophetic Pedagogy Stands 1 Step Ahead of Modern Social Science',
    badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
    summary:
      'Modern research on staged behavior change, sacred values, and institutional trust describes mechanisms that the Makkah-to-Madinah prophetic sequence enacted fourteen centuries earlier through Wahy.',
    empiricalPillars: [
      {
        domain: 'Staged Norm Change',
        finding:
          'Behavioral science shows durable reform when identity and belief stabilize before complex legal rules are imposed.',
        oneStepAheadNote:
          'Makkan tawhid and purification preceded Madinan statutes—tadrij as Divine staged design.',
      },
      {
        domain: 'Sacred Values & Social Cohesion',
        finding:
          'Shared transcendent commitments can reduce opportunistic conflict and raise cooperation costs for betrayal.',
        oneStepAheadNote:
          'The mosque, brotherhood, and covenantal ethics forged cohesion that tribal blood-feuds could not.',
      },
      {
        domain: 'Oral-to-Literate Knowledge Culture',
        finding:
          'Public recitation, memorization, and teaching create high-fidelity transmission networks.',
        oneStepAheadNote:
          '“Read” and teaching the Book (96:1–5; 62:2) built a civilization of learning from revelation.',
      },
    ],
    methodologicalNote:
      'Islamic history is grounded in opened Qur’an and Seerah; social-science parallels illustrate hikmah without replacing revelation.',
  };

  const roundtableTurns: RoundtableTurn[] = [
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: `Assalamu Alaikum. Today’s 7-Agent Roundtable examines the hub question: “${question}” We will stay on Wahy and the 23-year civilizational arc—not unrelated jewelry rulings.`,
    },
    {
      speaker: 'Dr. Tariq al-Mansoor',
      role: 'Agent 02 · Hadith & Seerah Specialist',
      voiceProfile: 'tariq',
      text: 'The authentic Seerah places the mission after age forty across roughly thirteen Makkan and ten Madinan years. Bukhari 2977 notes jawami‘ al-kalim—concise speech with vast reforming power—fitting an ummi messenger taught by Wahy.',
    },
    {
      speaker: 'Shaykh Farhan al-Rashed',
      role: 'Agent 04 · Classical Fiqh & Consensus Lead',
      voiceProfile: 'yusuf',
      text: 'Usul scholars highlight tadrij: creed and character first, then detailed law. That sequence is how a fractured Arabian society could absorb a coherent Shariah without social collapse.',
    },
    {
      speaker: 'Dr. Zainab al-Mubarak',
      role: 'Agent 06 · Modern Science & 1-Step-Ahead Foresight',
      voiceProfile: 'noor',
      text: 'Contemporary staged-change and social-capital research rediscovers what the Seerah already practiced: stabilize identity and sacred norms, then institutionalize justice. Revelation led; empirical models followed.',
    },
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: 'Synthesis: the 23-year transformation is Wahy teaching Book and Wisdom (62:2)—a full seven-agent dossier on Prophetic civilization, never a leftover gold-ring paragraph.',
    },
  ];

  return packDossier({
    id: modernWorldReportId('twenty-three-year'),
    question,
    verdictHeadline:
      'Revelation (Wahy) Taught an Unlettered Messenger After Age 40 to Reform a Fractured Society Across ~23 Years into an Enduring Civilization',
    verdictClassification: 'QUR’AN + SEERAH · CIVILIZATIONAL PEDAGOGY',
    confidenceScore: 98.4,
    executiveSummary:
      'Across roughly thirteen Makkan and ten Madinan years, Wahy enabled the Prophet ﷺ—unlettered and beginning after age forty—to purify belief, form character, and build institutions. Qur’an 42:52, 62:2, and 96:1–5 with authentic Seerah chronology explain this transformation. This dedicated hub dossier stays on the 23-year prophetic arc and must never reuse an unrelated prior research topic.',
    agents,
    scienceForesight,
    roundtableTurns,
  });
}

function primordialUniversalityDossier(question: string): SevenAgentResearchDossier {
  const agents: SpecialistAgentFinding[] = [
    {
      agentNumber: 1,
      agentId: 'quran_tafsir',
      ...AGENT_HEADERS.quran_tafsir,
      verdictBadge: 'ADAM · ONE HUMANITY · FITRAH',
      confidenceScore: '98.9%',
      arabicQuote: 'يَـٰٓأَيُّهَا ٱلنَّاسُ ٱتَّقُوا۟ رَبَّكُمُ ٱلَّذِى خَلَقَكُم مِّن نَّفْسٍۢ وَٰحِدَةٍ',
      arabicReference: 'Surah An-Nisa 4:1 · Surah Al-A‘raf 7:172 · Surah Ar-Rum 30:30',
      summary:
        'The Qur’an addresses all people from a single soul (Adam), records the primordial covenant, and names the upright Fitrah—so Islam presents itself as humanity’s original orientation, not a late ethnic cult.',
      keyPoints: [
        'An-Nisa 4:1: humanity created from one soul—Adam as shared father.',
        'Al-A‘raf 7:172: the primordial covenant (alastu bi-rabbikum) with the children of Adam.',
        'Ar-Rum 30:30: set your face to the upright religion, Fitrah of Allah upon which He created people.',
      ],
      citations: ['Qur’an 4:1', 'Qur’an 7:172', 'Qur’an 30:30'],
    },
    {
      agentNumber: 2,
      agentId: 'hadith_sunnah',
      ...AGENT_HEADERS.hadith_sunnah,
      verdictBadge: 'FITRAH HADITH · UNIVERSAL BIRTH',
      confidenceScore: '98.6%',
      arabicQuote: 'كُلُّ مَوْلُودٍ يُولَدُ عَلَى الْفِطْرَةِ',
      arabicReference: 'Sahih al-Bukhari 1358 · Sahih Muslim 2658',
      summary:
        'The Prophet ﷺ taught that every child is born upon the Fitrah; parental and social environments then shape religious identity—affirming a universal starting point rather than inherited tribal exclusivism.',
      keyPoints: [
        'Bukhari 1358 / Muslim 2658: every newborn is upon the Fitrah.',
        'Prophetic genealogy preaching links the final message to earlier prophets culminating in Adam.',
        'Universal da‘wah language (“O mankind”) mirrors Qur’anic address.',
      ],
      citations: ['Sahih al-Bukhari 1358', 'Sahih Muslim 2658'],
    },
    {
      agentNumber: 3,
      agentId: 'isnad_rijal',
      ...AGENT_HEADERS.isnad_rijal,
      verdictBadge: 'SAHIH · WIDELY TRANSMITTED FITRAH REPORT',
      confidenceScore: '98.2%',
      summary:
        'The Fitrah hadith is preserved in the Sahihayn with strong chains; the Adam-from-one-soul theme is Qur’anic and thus beyond isnad dispute.',
      keyPoints: [
        'Sahihayn transmission of the Fitrah report is accepted across Sunni scholarship.',
        'Qur’anic verses on Adam and Fitrah require no isnad grading.',
        'Peripheral Israeliyyat stories about Adam are filtered; only opened Qur’an/Hadith drive this dossier.',
      ],
      citations: ['Sahih al-Bukhari 1358 isnad', 'Sahih Muslim 2658 isnad'],
    },
    {
      agentNumber: 4,
      agentId: 'fiqh_consensus',
      ...AGENT_HEADERS.fiqh_consensus,
      verdictBadge: 'EQUAL DIGNITY · SHARED ORIGIN',
      confidenceScore: '97.7%',
      summary:
        'Fiqh and creed texts treat human dignity (karamah) and equal origin from Adam as axioms that forbid racial supremacy and ground universal moral accountability.',
      keyPoints: [
        'Karamah of the children of Adam (Qur’an 17:70) informs legal dignity.',
        'No race holds salvific privilege; taqwa is the measure (49:13).',
        'Da‘wah and justice obligations apply across peoples because of shared Fitrah.',
      ],
      citations: ['Qur’an 17:70', 'Qur’an 49:13'],
    },
    {
      agentNumber: 5,
      agentId: 'linguistic_maqasid',
      ...AGENT_HEADERS.linguistic_maqasid,
      verdictBadge: 'FITRAH · HANIF · UMMAH',
      confidenceScore: '97.4%',
      summary:
        'Fitrah denotes the primordial disposition toward recognizing the Creator; hanif names upright monotheism; together they frame Islam as restoration, not invention.',
      keyPoints: [
        'Fitrah: innate orientation, not blank cultural relativism.',
        'Hanif: Abrahamic uprightness preceding later distortions.',
        'Maqasid: preserve religion and dignity for all descendants of Adam.',
      ],
      citations: ['Lisan al-‘Arab (f-t-r)', 'Qur’an 30:30'],
    },
    {
      agentNumber: 6,
      agentId: 'modern_science',
      ...AGENT_HEADERS.modern_science,
      verdictBadge: '🔬 1 STEP AHEAD · SHARED HUMAN ORIGINS',
      confidenceScore: '96.5%',
      isScienceSpotlight: true,
      summary:
        'Genetics and anthropology affirm a single human family; developmental psychology observes early predispositions toward agency-detection and moral intuition—resonating with Fitrah without replacing revelation.',
      keyPoints: [
        'Common human ancestry models align with “from one soul” as a moral-universal claim.',
        'Cross-cultural moral intuitions echo a shared baseline disposition.',
        'Revelation names Fitrah; science later maps universal human traits.',
      ],
      citations: ['Human population genetics (shared ancestry)', 'Moral psychology / early cognition studies'],
    },
    {
      agentNumber: 7,
      agentId: 'executive_synthesis',
      ...AGENT_HEADERS.executive_synthesis,
      verdictBadge: 'FINAL VERDICT · ISLAM AS PRIMORDIAL FITRAH',
      confidenceScore: '98.5%',
      summary:
        'Islam teaches primordial universality from Adam: one humanity, a primordial covenant, and Fitrah—making the message restoration of the original human orientation rather than a late regional religion.',
      keyPoints: [
        'Cite 4:1, 7:172, 30:30 and Bukhari 1358 / Muslim 2658.',
        'Reject racial or ethnic monopolies on guidance (49:13).',
        'Topic lock: keep this dossier on Adam, Fitrah, and universal humanity.',
      ],
      citations: ['Qur’an 4:1', 'Qur’an 30:30', 'Sahih al-Bukhari 1358'],
    },
  ];

  const scienceForesight: ModernScienceForesight = {
    headline: 'How Fitrah Teaching Stands 1 Step Ahead of Universal Human-Nature Research',
    badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
    summary:
      'Modern genetics and moral psychology describe shared human origins and early predispositions that resonate with the Qur’anic Fitrah and Adam narratives.',
    empiricalPillars: [
      {
        domain: 'Shared Human Ancestry',
        finding: 'Population genetics supports a single interconnected human family.',
        oneStepAheadNote: 'Qur’an 4:1 taught moral unity from one soul long before genetic models.',
      },
      {
        domain: 'Early Moral Cognition',
        finding: 'Infants show proto-moral expectations across cultures.',
        oneStepAheadNote: 'Fitrah names an innate orientation toward truth and accountability.',
      },
      {
        domain: 'Cross-Cultural Sacred Intuition',
        finding: 'Humans widely posit transcendent meaning and obligation.',
        oneStepAheadNote: '7:172 frames a primordial acknowledgment of Lordship.',
      },
    ],
    methodologicalNote:
      'Science may illustrate Fitrah; creed remains grounded in opened revelation.',
  };

  const roundtableTurns: RoundtableTurn[] = [
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: `Assalamu Alaikum. Our question: “${question}” We examine Adam, Fitrah, and universal humanity.`,
    },
    {
      speaker: 'Dr. Tariq al-Mansoor',
      role: 'Agent 02 · Hadith Specialist',
      voiceProfile: 'tariq',
      text: 'Bukhari 1358 and Muslim 2658 state every child is born upon the Fitrah. That Prophetic teaching pairs with Qur’an 4:1 on creation from one soul.',
    },
    {
      speaker: 'Shaykh Farhan al-Rashed',
      role: 'Agent 04 · Fiqh Lead',
      voiceProfile: 'yusuf',
      text: 'Because humanity shares Adam’s origin, fiqh rejects racial supremacy and measures nobility by taqwa (49:13).',
    },
    {
      speaker: 'Dr. Zainab al-Mubarak',
      role: 'Agent 06 · Science Foresight',
      voiceProfile: 'noor',
      text: 'Genetics and moral psychology rediscover shared origins and early predispositions—echoing Fitrah while revelation remains first.',
    },
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: 'Verdict: Islam is primordial Fitrah for the children of Adam—not a late tribal invention, and not an unrelated jewelry dossier.',
    },
  ];

  return packDossier({
    id: modernWorldReportId('primordial-universality'),
    question,
    verdictHeadline:
      'Islam Teaches Primordial Universality from Adam: One Humanity, Fitrah, and a Shared Covenant—Not a Late Regional Religion',
    verdictClassification: 'QUR’AN + SAHIH · FITRAH UNIVERSALISM',
    confidenceScore: 98.3,
    executiveSummary:
      'Qur’an 4:1, 7:172, and 30:30 with Sahihayn Fitrah reports present Adam as the shared father of humanity and Islam as restoration of Fitrah. This dedicated hub dossier never substitutes an unrelated prior research topic.',
    agents,
    scienceForesight,
    roundtableTurns,
  });
}

function microSunnahScienceDossier(question: string): SevenAgentResearchDossier {
  const agents: SpecialistAgentFinding[] = [
    {
      agentNumber: 1,
      agentId: 'quran_tafsir',
      ...AGENT_HEADERS.quran_tafsir,
      verdictBadge: 'HALAL NOURISHMENT · MODERATION',
      confidenceScore: '98.1%',
      arabicQuote: 'يَـٰٓأَيُّهَا ٱلنَّاسُ كُلُوا۟ مِمَّا فِى ٱلْأَرْضِ حَلَـٰلًۭا طَيِّبًۭا',
      arabicReference: 'Surah Al-Baqarah 2:168 · Surah Al-A‘raf 7:31 · Surah Al-Baqarah 2:183',
      summary:
        'The Qur’an links lawful wholesome food, avoidance of excess, and fasting as worship—forming the ethical frame for micro-Sunnah practices around diet, restraint, and resilience.',
      keyPoints: [
        '2:168: eat of what is lawful and good.',
        '7:31: eat and drink but do not be excessive.',
        '2:183: fasting prescribed so that you may attain taqwa.',
      ],
      citations: ['Qur’an 2:168', 'Qur’an 7:31', 'Qur’an 2:183'],
    },
    {
      agentNumber: 2,
      agentId: 'hadith_sunnah',
      ...AGENT_HEADERS.hadith_sunnah,
      verdictBadge: 'DATES · FASTING · SLEEP & DHIKR',
      confidenceScore: '98.0%',
      arabicQuote: 'مَنْ تَصَبَّحَ بِسَبْعِ تَمَرَاتٍ عَجْوَةٍ لَمْ يَضُرَّهُ ذَلِكَ الْيَوْمَ سَمٌّ وَلَا سِحْرٌ',
      arabicReference: 'Sahih al-Bukhari 5445 · Sahih Muslim 2047 · fasting & sleep etiquette reports',
      summary:
        'Opened Hadith encourage dates (especially as prophetic food culture), fasting beyond Ramadan in known sunnah patterns, balanced sleep, and remembrance that steadies the heart—micro practices with macro health and spiritual effects.',
      keyPoints: [
        'Dates and prophetic food culture appear in Sahihayn dietary chapters (e.g., Bukhari 5445 on ‘ajwah in its textual scope).',
        'Fasting sunnahs (e.g., Mondays/Thursdays, ‘Arafah, ‘Ashura’) are widely transmitted; grades must stay with opened collections.',
        'Sleep etiquette and night prayer cultivate resilience without inventing biomedical study citations.',
      ],
      citations: ['Sahih al-Bukhari 5445', 'Sahih Muslim 2047', 'Sunnah fasting chapters'],
    },
    {
      agentNumber: 3,
      agentId: 'isnad_rijal',
      ...AGENT_HEADERS.isnad_rijal,
      verdictBadge: 'PREFER SAHIHAYN · NO INVENTED GRADES',
      confidenceScore: '97.6%',
      summary:
        'This dossier privileges Sahihayn and clearly graded sunnah reports; weak wellness hadiths are not upgraded, and modern papers are not fabricated as Prophetic footnotes.',
      keyPoints: [
        'Dietary and fasting reports in Bukhari/Muslim carry highest confidence.',
        'Unverified “medical miracle” chains are excluded.',
        'Science notes are analogies, not forged isnads.',
      ],
      citations: ['Sahihayn methodology', 'Classical hadith grading norms'],
    },
    {
      agentNumber: 4,
      agentId: 'fiqh_consensus',
      ...AGENT_HEADERS.fiqh_consensus,
      verdictBadge: 'MANDUB MICRO-HABITS · RAMADAN FARD',
      confidenceScore: '97.3%',
      summary:
        'Schools distinguish obligatory fasting (Ramadan) from recommended micro-sunnahs; dates and sleep etiquette are generally mandub cultural sunnahs within broader adab.',
      keyPoints: [
        'Ramadan fasting is fard; extra fasts are sunnah/mandub with known exceptions.',
        'Moderation (avoiding israf) is a shared ethical rule.',
        'Medical inability creates concessions—fiqh already encodes care of the body.',
      ],
      citations: ['Classical fasting chapters', 'Adab al-akl discussions'],
    },
    {
      agentNumber: 5,
      agentId: 'linguistic_maqasid',
      ...AGENT_HEADERS.linguistic_maqasid,
      verdictBadge: 'HIKMAH · PRESERVE LIFE & MIND',
      confidenceScore: '97.0%',
      summary:
        'Maqasid protect life (nafs) and intellect (‘aql); micro-sunnahs of nourishment, fasting, and calm remembrance serve those ends through habit, not spectacle.',
      keyPoints: [
        'Tayyib: wholesome, not merely technically halal.',
        'Sawm: restraint that trains the will.',
        'Sakina through dhikr: psychological settling as a maqasid fruit.',
      ],
      citations: ['Al-Shatibi maqasid', 'Qur’an 13:28'],
    },
    {
      agentNumber: 6,
      agentId: 'modern_science',
      ...AGENT_HEADERS.modern_science,
      verdictBadge: '🔬 1 STEP AHEAD · METABOLIC & MENTAL HEALTH',
      confidenceScore: '96.9%',
      isScienceSpotlight: true,
      summary:
        'Nutrition science on whole fruits (including dates), intermittent metabolic rest, sleep hygiene, and contemplative practice maps onto prophetic micro-habits—illustrating hikmah without claiming fabricated clinical trials in the Hadith corpus.',
      keyPoints: [
        'Dates provide rapid carbohydrates, fiber, and micronutrients useful around fasting windows.',
        'Time-restricted eating research parallels fasting’s metabolic pause—revelation prescribed worship first.',
        'Sleep regularity and contemplative dhikr align with stress-regulation findings.',
        'Never invent study DOIs; keep empirical notes general and humble.',
      ],
      citations: ['Nutrition of date fruit (general literature)', 'Intermittent fasting research overview', 'Contemplative practice & stress physiology'],
    },
    {
      agentNumber: 7,
      agentId: 'executive_synthesis',
      ...AGENT_HEADERS.executive_synthesis,
      verdictBadge: 'FINAL VERDICT · MICRO-SUNNAH HIKMAH',
      confidenceScore: '98.0%',
      summary:
        'Micro-Sunnah practices—wholesome food such as dates, fasting, sleep etiquette, and remembrance—embody hikmah that often anticipates modern wellness insights while remaining grounded in opened Qur’an and Hadith.',
      keyPoints: [
        'Follow opened Sahihayn dietary and fasting guidance.',
        'Treat science as illustration, not a second revelation.',
        'Topic lock: keep this dossier on micro-Sunnah wellness practices.',
      ],
      citations: ['Qur’an 2:183', 'Sahih al-Bukhari 5445', 'Sahih Muslim 2047'],
    },
  ];

  const scienceForesight: ModernScienceForesight = {
    headline: 'How Micro-Sunnah Habits Stand 1 Step Ahead of Modern Wellness Science',
    badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
    summary:
      'Metabolic, nutritional, and mental-health research continually rediscovers benefits in patterns long taught as prophetic adab and worship.',
    empiricalPillars: [
      {
        domain: 'Nutrient-Dense Prophetic Foods',
        finding: 'Dates supply quick energy and micronutrients around fasting.',
        oneStepAheadNote: 'Prophetic food culture emphasized tayyib staples before modern dietetics.',
      },
      {
        domain: 'Metabolic Rest via Fasting',
        finding: 'Time-restricted eating studies explore insulin sensitivity and repair pathways.',
        oneStepAheadNote: 'Sawm trained restraint as worship centuries earlier.',
      },
      {
        domain: 'Sleep & Contemplative Calm',
        finding: 'Sleep hygiene and meditation-like remembrance reduce stress load.',
        oneStepAheadNote: 'Night prayer and dhikr cultivated resilience as devotion.',
      },
    ],
    methodologicalNote:
      'Empirical notes are general; Dragon Dawwa never invents paper titles or grades.',
  };

  const roundtableTurns: RoundtableTurn[] = [
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: `Assalamu Alaikum. Question: “${question}” We focus on dates, fasting, sleep, and resilience—not unrelated jewelry law.`,
    },
    {
      speaker: 'Dr. Tariq al-Mansoor',
      role: 'Agent 02 · Hadith Specialist',
      voiceProfile: 'tariq',
      text: 'Sahihayn preserve prophetic food and fasting guidance. We cite opened collections only and refuse invented medical chains.',
    },
    {
      speaker: 'Shaykh Farhan al-Rashed',
      role: 'Agent 04 · Fiqh Lead',
      voiceProfile: 'yusuf',
      text: 'Ramadan is obligatory; micro-sunnahs are recommended within adab and moderation, with medical concessions when needed.',
    },
    {
      speaker: 'Dr. Zainab al-Mubarak',
      role: 'Agent 06 · Science Foresight',
      voiceProfile: 'noor',
      text: 'Nutrition and intermittent metabolic research illuminate hikmah in these habits, while revelation remains the reason we practice them.',
    },
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: 'Verdict: micro-Sunnah wellness is a full seven-agent topic dossier—never a single leftover paragraph from another query.',
    },
  ];

  return packDossier({
    id: modernWorldReportId('micro-sunnah-science'),
    question,
    verdictHeadline:
      'Micro-Sunnah Practices (Dates, Fasting, Sleep, Resilience) Embody Hikmah that Aligns with—and Often Anticipates—Modern Wellness Science',
    verdictClassification: 'SUNNAH ADAB · EMPIRICAL HIKMAH',
    confidenceScore: 97.9,
    executiveSummary:
      'Opened Qur’an and Sahihayn guidance on wholesome food, fasting, and calming remembrance form micro-habits whose hikmah resonates with modern nutrition and mental-health insights. This hub dossier stays on that topic and never reuses an unrelated prior research text.',
    agents,
    scienceForesight,
    roundtableTurns,
  });
}

function macroGovernanceDossier(question: string): SevenAgentResearchDossier {
  const agents: SpecialistAgentFinding[] = [
    {
      agentNumber: 1,
      agentId: 'quran_tafsir',
      ...AGENT_HEADERS.quran_tafsir,
      verdictBadge: 'JUSTICE · CONSULTATION · COVENANTS',
      confidenceScore: '98.7%',
      arabicQuote: 'إِنَّ ٱللَّهَ يَأْمُرُ بِٱلْعَدْلِ وَٱلْإِحْسَـٰنِ',
      arabicReference: 'Surah An-Nahl 16:90 · Surah Ash-Shura 42:38 · Surah Al-Ma’idah 5:1',
      summary:
        'The Qur’an commands justice and excellence, praises consultation (shura), and binds believers to fulfill contracts—forming a civilizational frame for governance and treaties.',
      keyPoints: [
        '16:90: Allah commands justice (‘adl) and excellence (ihsan).',
        '42:38: their affair is consultation among them.',
        '5:1: fulfill covenants (uqud).',
      ],
      citations: ['Qur’an 16:90', 'Qur’an 42:38', 'Qur’an 5:1'],
    },
    {
      agentNumber: 2,
      agentId: 'hadith_sunnah',
      ...AGENT_HEADERS.hadith_sunnah,
      verdictBadge: 'TREATIES · AMANAH · PUBLIC JUSTICE',
      confidenceScore: '98.2%',
      arabicQuote: 'أَلَا كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْئُولٌ عَنْ رَعِيَّتِهِ',
      arabicReference: 'Sahih al-Bukhari 893 · Sahih Muslim 1829 · Treaty practice in Seerah',
      summary:
        'Prophetic governance taught every person as a shepherd responsible for their trust, honored agreements (including with non-Muslims when opened Seerah records them), and centered public justice over tribal retaliation.',
      keyPoints: [
        'Bukhari 893 / Muslim 1829: each of you is a shepherd responsible for his flock.',
        'Seerah treaty practice (e.g., constitutional agreements at Madinah; Hudaybiyyah as a case of strategic covenant) shows diplomacy under revelation.',
        'Amanah and anti-corruption ethics restrain rulers and officials.',
      ],
      citations: ['Sahih al-Bukhari 893', 'Sahih Muslim 1829', 'Opened Seerah treaty narratives'],
    },
    {
      agentNumber: 3,
      agentId: 'isnad_rijal',
      ...AGENT_HEADERS.isnad_rijal,
      verdictBadge: 'SAHIH GOVERNANCE ETHICS · CAREFUL SEERAH',
      confidenceScore: '97.8%',
      summary:
        'Core governance ethics rest on Sahihayn; Seerah treaty details are taken from classical biography with caution against inventing clauses not in opened sources.',
      keyPoints: [
        'Shepherd hadith is Sahihayn-attested.',
        'Treaty narratives rely on early Seerah compilers; disputed embellishments are omitted.',
        'No invented “UN charter” parallels presented as Hadith.',
      ],
      citations: ['Sahih al-Bukhari 893 isnad', 'Ibn Hisham treaty sections'],
    },
    {
      agentNumber: 4,
      agentId: 'fiqh_consensus',
      ...AGENT_HEADERS.fiqh_consensus,
      verdictBadge: 'SIYASAH SHAR‘IYYAH · PUBLIC WELFARE',
      confidenceScore: '97.5%',
      summary:
        'Classical siyasah shar‘iyyah allows rulers to pursue public welfare within Shariah bounds: justice in courts, fulfillment of treaties, and protection of rights across communities under covenant.',
      keyPoints: [
        'Judges must not favor kin over truth (4:135).',
        'Treaties bind until breached under known fiqh rules.',
        'Maslahah cannot legalize clear prohibition; it structures governance tools.',
      ],
      citations: ['Qur’an 4:135', 'Classical siyasah works (e.g., Al-Mawardi themes)'],
    },
    {
      agentNumber: 5,
      agentId: 'linguistic_maqasid',
      ...AGENT_HEADERS.linguistic_maqasid,
      verdictBadge: '‘ADL · SHURA · ‘AHD',
      confidenceScore: '97.1%',
      summary:
        '‘Adl (justice), shura (consultation), and ‘ahd/mithaq (covenant) are linguistic pillars of Islamic macro-governance—aiming at order, dignity, and trustworthy international dealing.',
      keyPoints: [
        '‘Adl: placing things in their rightful measure.',
        'Shura: collective counsel resisting autocratic whim.',
        '‘Ahd: sacralized promise-keeping as civilizational capital.',
      ],
      citations: ['Lisan al-‘Arab (‘adl)', 'Qur’an 16:91'],
    },
    {
      agentNumber: 6,
      agentId: 'modern_science',
      ...AGENT_HEADERS.modern_science,
      verdictBadge: '🔬 1 STEP AHEAD · INSTITUTIONS & TRUST',
      confidenceScore: '96.4%',
      isScienceSpotlight: true,
      summary:
        'Political science and institutional economics stress credible commitments, inclusive consultation, and impartial justice as predictors of stable order—themes encoded in Qur’an and Sunnah governance ethics long prior.',
      keyPoints: [
        'Credible commitment theory mirrors covenant fulfillment (5:1; 16:91).',
        'Participatory counsel improves information aggregation—shura as design.',
        'Impartial third-party justice reduces feud cycles—Prophetic court ethics.',
      ],
      citations: ['Institutional trust research', 'Credible commitment / treaty compliance studies'],
    },
    {
      agentNumber: 7,
      agentId: 'executive_synthesis',
      ...AGENT_HEADERS.executive_synthesis,
      verdictBadge: 'FINAL VERDICT · COHERENT CIVILIZATIONAL GOVERNANCE',
      confidenceScore: '98.2%',
      summary:
        'Qur’an and Sunnah guide macro-justice, treaties, and governance as a coherent civilizational system: justice, consultation, covenant-keeping, and accountable stewardship.',
      keyPoints: [
        'Anchor in 16:90, 42:38, 5:1 and Bukhari 893.',
        'Treat Seerah treaties carefully without invention.',
        'Topic lock: keep this dossier on justice, treaties, and governance.',
      ],
      citations: ['Qur’an 16:90', 'Qur’an 42:38', 'Sahih al-Bukhari 893'],
    },
  ];

  const scienceForesight: ModernScienceForesight = {
    headline: 'How Prophetic Governance Ethics Stand 1 Step Ahead of Institutional Trust Science',
    badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
    summary:
      'Modern institutional research highlights credible commitments and impartial justice—core Qur’anic and Prophetic governance themes.',
    empiricalPillars: [
      {
        domain: 'Credible Commitments',
        finding: 'Stable polities keep treaties and contracts under cost.',
        oneStepAheadNote: 'Qur’an 5:1 and 16:91 sacralize covenant fidelity.',
      },
      {
        domain: 'Consultative Information',
        finding: 'Inclusive counsel improves decisions under uncertainty.',
        oneStepAheadNote: 'Shura (42:38) institutionalized counsel as worshipful ethics.',
      },
      {
        domain: 'Impartial Justice',
        finding: 'Bias toward kin predicts feud persistence.',
        oneStepAheadNote: '4:135 commands justice even against yourselves and kin.',
      },
    ],
    methodologicalNote:
      'Social-science parallels illustrate hikmah; law remains revelation-based.',
  };

  const roundtableTurns: RoundtableTurn[] = [
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: `Assalamu Alaikum. Today: “${question}” Macro-justice and treaties—not leftover micro-fiqh from another search.`,
    },
    {
      speaker: 'Dr. Tariq al-Mansoor',
      role: 'Agent 02 · Hadith Specialist',
      voiceProfile: 'tariq',
      text: 'Bukhari 893 teaches every steward is accountable. Seerah treaty practice shows diplomacy under revelation when carefully sourced.',
    },
    {
      speaker: 'Shaykh Farhan al-Rashed',
      role: 'Agent 04 · Fiqh Lead',
      voiceProfile: 'yusuf',
      text: 'Siyasah shar‘iyyah pursues public welfare within Shariah: courts of justice, binding covenants, and limits on tyranny.',
    },
    {
      speaker: 'Dr. Zainab al-Mubarak',
      role: 'Agent 06 · Science Foresight',
      voiceProfile: 'noor',
      text: 'Institutional trust research rediscovers credible commitments and impartial justice—ethics the Qur’an already commanded.',
    },
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: 'Verdict: a full seven-agent governance dossier—coherent civilizational frame, never a single wrong-topic paragraph.',
    },
  ];

  return packDossier({
    id: modernWorldReportId('macro-governance'),
    question,
    verdictHeadline:
      'Qur’an and Sunnah Guide Macro-Justice, Treaties, and Governance as a Coherent Civilizational System',
    verdictClassification: 'SIYASAH SHAR‘IYYAH · COVENANTAL JUSTICE',
    confidenceScore: 98.1,
    executiveSummary:
      'Justice (16:90), consultation (42:38), covenant-keeping (5:1), and accountable stewardship (Bukhari 893) form the macro-governance spine of Islam. This dedicated hub dossier must never display leftovers from an unrelated prior research run.',
    agents,
    scienceForesight,
    roundtableTurns,
  });
}

const BUILDERS: Record<string, (question: string) => SevenAgentResearchDossier> = {
  'twenty-three-year': twentyThreeYearDossier,
  'primordial-universality': primordialUniversalityDossier,
  'micro-sunnah-science': microSunnahScienceDossier,
  'macro-governance': macroGovernanceDossier,
};

export function buildModernWorldEnglishDossier(
  benchmark: ModernWorldBenchmark,
  question?: string,
): SevenAgentResearchDossier {
  const builder = BUILDERS[benchmark.id];
  if (!builder) {
    throw new Error(`No Modern World dossier builder for ${benchmark.id}`);
  }
  return builder(question?.trim() || benchmark.question);
}

export function resolveModernWorldDossierByQuestion(question: string): SevenAgentResearchDossier | null {
  const match = matchModernWorldBenchmark(question);
  if (!match) return null;
  return buildModernWorldEnglishDossier(match, question);
}

export function resolveModernWorldDossierById(id: string): SevenAgentResearchDossier | null {
  const match = modernWorldBenchmarkById(id);
  if (!match) return null;
  return buildModernWorldEnglishDossier(match);
}

/** Detect poisoned caches that pasted the gold-ring benchmark into another topic. */
export function looksLikeGoldRingDossierContent(dossier: Pick<SevenAgentResearchDossier, 'verdictHeadline' | 'executiveSummary'>): boolean {
  const blob = `${dossier.verdictHeadline}\n${dossier.executiveSummary}`;
  const citesGoldBenchmark =
    /Muslim\s*2089/i.test(blob) && /Nasa[’']?i\s*5148/i.test(blob) && /Bukhari\s*5863/i.test(blob);
  const assertsGoldProhibition =
    /gold rings? (?:&|and) gold jewelry are prohibited|men (?:are not permitted to wear|cannot wear) (?:a )?gold|prohibition of gold (?:rings? )?for men/i.test(
      blob,
    );
  return citesGoldBenchmark || assertsGoldProhibition;
}
