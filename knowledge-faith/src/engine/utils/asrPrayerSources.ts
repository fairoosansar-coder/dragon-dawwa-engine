import type { Agent7SourceResearch, HadeethEncRetrievedRecord, SourceTakhrij } from '../types/hadith.ts';

type LangCode = 'en' | 'ta' | 'si';

const ASR_ARABIC = 'عن بريدة بن الحصيب رضي الله عنه أنه قال: بَكِّرُوا بِصَلَاةِ الْعَصْرِ، فَإِنَّ النَّبِيَّ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ قَالَ: «مَنْ تَرَكَ صَلَاةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ».';
const COVENANT_ARABIC = 'عن بريدة رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: «إِنَّ الْعَهْدَ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ، فَمَنْ تَرَكَهَا فَقَدْ كَفَرَ».';
const COVENANT_ENGLISH = 'The covenant between us and them is prayer; so, whoever abandons it has disbelieved.';

const PACK = {
  en: {
    asrTitle: 'Whoever abandons the ‘Asr prayer, his deeds will be rendered worthless',
    asrText: 'Buraydah ibn al-Hasīb (may Allah be pleased with him) said: Offer the ‘Asr prayer early, for the Prophet (may Allah\'s peace and blessings be upon him) said: "Whoever abandons the ‘Asr prayer, his deeds will be rendered worthless."',
    asrExplanation: 'Published HadeethEnc explanation (#6261): the Prophet warned against deliberately delaying the ‘Asr prayer beyond its time, and said that the deeds of the one who does so are rendered worthless. That sentence is the publisher’s reading. The grade Authentic is only the transmission judgement.',
    asrGrade: 'Authentic',
    asrAttribution: 'Narrated by Al-Bukhari. Sahih al-Bukhari 553.',
    covenantTitle: 'The covenant between us and them is prayer; so, whoever abandons it has disbelieved',
    covenantText: `Buraydah (may Allah be pleased with him) reported: The Messenger of Allah said: "${COVENANT_ENGLISH}"`,
    covenantExplanation: 'Published HadeethEnc explanation (#65094): the Prophet described prayer as the covenant between the Muslims and others. The Arabic under Tirmidhi 2621 is this covenant wording. The sentence about polytheism is a different narration and is not placed under 2621.',
    covenantGrade: 'Authentic',
    covenantAttribution: 'Narrated by At-Tirmidhi, An-Nasa’i, Ibn Majah, and Ahmad. Sunan al-Tirmidhi 2621.',
  },
  ta: {
    asrTitle: 'யார் அஸ்ர் தொழுகையை விட்டுவிடுகிறானோ அவனின் நற்செயல்கள் அழிந்து விடும்',
    asrText: 'நபி ஸல்லல்லாஹு அலைஹிவஸல்லம் அவர்கள் கூறியதாக புரைதா இப்னுல் ஹஸீப் ரழியல்லாஹு அன்ஹு அவர்கள் கூறினார்கள்: அஸ்ர் தொழுகையை நேர காலத்துடன் நிறைவேற்றுங்கள், ஏனெனில் நபி ஸல்லல்லாஹு அலைஹிவஸல்லம் அவர்கள் கூறினார்கள்: "யார் அஸ்ர் தொழுகையை விட்டுவிடுகிறானோ அவனின் நற்செயல்கள் அழிந்து விடும்."',
    asrExplanation: 'HadeethEnc வெளியீடு (#6261): அஸ்ர் தொழுகையை வேண்டுமென்றே பிற்படுத்துவதை நபிவழி எச்சரிக்கிறது. செயல் வீணாகிவிடும் என்ற வாசிப்பு ஒரு சட்ட விளக்கம். "சரியானது" என்ற தரம் அறிவிப்பு நம்பகமானது என்பதை மட்டுமே கூறுகிறது.',
    asrGrade: 'சரியானது',
    asrAttribution: 'இமாம் புஹாரி இதனைப் பதிவு செய்திருக்கிறார். ஸஹீஹ் அல்-புஹாரி 553.',
    covenantTitle: 'எமக்கும் அவர்களுக்கும் இடையில் உள்ள ஒப்பந்தம் தொழுகையாகும்; அதை விட்டவர் காஃபிராகி விட்டார்',
    covenantText: 'அல்லாஹ்வின் தூதர் ஸல்லல்லாஹு அலைஹிவஸல்லம் அவர்கள் கூறியதாக புரைதா ரழியல்லாஹு அன்ஹு அறிவிக்கிறார்கள்: எமக்கும், அவர்களுக்கும் இடையில் உள்ள ஒப்பந்தம் தொழுகையாகும்; அதை விட்டவர் காஃபிராகி விட்டார்.',
    covenantExplanation: 'HadeethEnc வெளியீடு (#65094): திர்மிதி 2621-ன் அரபு வாசகம் இந்த ஒப்பந்த வாசகமே. இணைவைப்பு பற்றிய வேறு வாக்கியம் இந்த எண்ணின் கீழ் வைக்கப்படவில்லை. காஃபிர் என்ற முடிவு ஒரு சட்ட விளக்கம்; அது தரத்துடன் ஒன்றல்ல.',
    covenantGrade: 'சரியானது',
    covenantAttribution: 'திர்மிதி, நஸாஈ, இப்னு மாஜா, அஹ்மத். சுனன் அத்-திர்மிதி 2621.',
  },
  si: {
    asrTitle: 'කවරෙකු අසර් සලාතය මග හැරියේ ද ඔහුගේ කටයුතු නිෂ්ඵල විය',
    asrText: 'බුරයිදා ඉබ්නු අල් හසීබ් (රළියල්ලාහු අන්හු) තුමා වාර්තා කළේ නබි (සල්ලල්ලාහු අලයිහි වසල්ලම්) තුමාණෝ “කවරෙකු අසර් සලාතය මග හැරියේ ද සැබැවින්ම ඔහුගේ කටයුතු නිෂ්ඵල විය” යැයි පැවසූ බවයි.',
    asrExplanation: 'HadeethEnc ප්‍රකාශනය (#6261): අසර් සලාතය හිතාමතා ප්‍රමාද කිරීම ගැන අනතුරු ඇඟවීමයි. කටයුතු නිෂ්ඵල වීම නීතිමය කියවීමකි. “صحيح” ශ්‍රේණිය කියන්නේ සම්ප්‍රේෂණය විශ්වාසදායක බව පමණි.',
    asrGrade: 'صحيح',
    asrAttribution: 'رواه البخاري. صحيح البخاري 553.',
    covenantTitle: 'අප හා ඔවුන් අතර පවතින ගිවිසුම සලාතයයි. එය මඟ හැරිය අය ප්‍රතික්ෂේප කළේය',
    covenantText: 'බුරෙයිදා (රළියල්ලාහු අන්හු) තුමා වාර්තා කළේ අල්ලාහ්ගේ දූතයාණන් ප්‍රකාශ කළ බවයි: “සැබැවින්ම අප හා ඔවුන් අතර පවතින ගිවිසුම සලාතයයි. එහෙයින් කවරෙකු එය මඟ හැරියේ ද ඔහු ප්‍රතික්ෂේප කළේය.”',
    covenantExplanation: 'HadeethEnc ප්‍රකාශනය (#65094): තිර්මිදි 2621 යටතේ ඇති අරාබි පාඨය මෙම ගිවිසුමයි. බහුදේව වාක්‍යය වෙනත් වාර්තාවකි; එය මෙම අංකය යටතේ නොතැබේ. ප්‍රතික්ෂේපය පිළිබඳ නිගමනය ශ්‍රේණියෙන් වෙනස් නීතිමය ප්‍රශ්නයකි.',
    covenantGrade: 'صحيح',
    covenantAttribution: 'رواه الترمذي والنسائي وابن ماجه وأحمد. سنن الترمذي 2621.',
  },
} as const;

function pack(lang: LangCode) {
  return PACK[lang] ?? PACK.en;
}

export function asrPrayerRecords(lang: LangCode): HadeethEncRetrievedRecord[] {
  const copy = pack(lang);
  return [
    {
      id: '6261',
      title: copy.asrTitle,
      arabic: ASR_ARABIC,
      translation: copy.asrText,
      language: lang,
      explanation: copy.asrExplanation,
      lessons: [
        'This record is HadeethEnc #6261 because its Arabic is the questioned Asr wording.',
        'Sahih al-Bukhari 553 is the collection citation for that wording.',
      ],
      published_grade: copy.asrGrade,
      collection_attribution: copy.asrAttribution,
      source_url: `https://hadeethenc.com/${lang}/browse/hadith/6261`,
      reader_route: `#/hadith/6261?lang=${lang}`,
      match_status: 'Direct Hadith Match',
      match_reason: 'HadeethEnc #6261 uses this question’s wording, «مَنْ تَرَكَ صَلَاةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ». It was not chosen because it shares a general word such as prayer or fasting.',
    },
    {
      id: '65094',
      title: copy.covenantTitle,
      arabic: COVENANT_ARABIC,
      translation: copy.covenantText,
      language: lang,
      explanation: copy.covenantExplanation,
      lessons: [
        'Tirmidhi 2621 is this covenant sentence, not the Asr sentence and not the polytheism sentence.',
      ],
      published_grade: copy.covenantGrade,
      collection_attribution: copy.covenantAttribution,
      source_url: `https://hadeethenc.com/${lang}/browse/hadith/65094`,
      reader_route: `#/hadith/65094?lang=${lang}`,
      match_status: 'Distinct narration (own citation)',
      match_reason: 'HadeethEnc #65094 is kept because its published reference is Sunan al-Tirmidhi 2621. Its Arabic is «إِنَّ الْعَهْدَ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ، فَمَنْ تَرَكَهَا فَقَدْ كَفَرَ». It does not repeat the Asr wording.',
    },
  ];
}

export function asrCitationSources(lang: LangCode): SourceTakhrij[] {
  const copy = pack(lang);
  return [
    {
      collection: 'Sahih al-Bukhari',
      hadith_number: '553',
      exact_wording: copy.asrText,
      exact_wording_arabic: 'مَنْ تَرَكَ صَلَاةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ',
      exact_wording_english: 'Whoever abandons the ‘Asr prayer, his deeds will be rendered worthless.',
      wording_differences: 'HadeethEnc #6261. This is the questioned narration. Bukhari 553 is its collection number.',
    },
    {
      collection: "Jami' at-Tirmidhi",
      hadith_number: '2621',
      exact_wording: COVENANT_ARABIC,
      exact_wording_arabic: 'إِنَّ الْعَهْدَ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ، فَمَنْ تَرَكَهَا فَقَدْ كَفَرَ',
      exact_wording_english: COVENANT_ENGLISH,
      wording_differences: 'HadeethEnc #65094 cites Sunan al-Tirmidhi (4/365) (2621) for this covenant Arabic. The Asr sentence is Bukhari 553. The sentence about polytheism is a different narration and is not placed under 2621.',
    },
  ];
}

const LAW = 'The grade Authentic on Bukhari 553 says that narration is reliably transmitted. It does not decide the legal question of whether the day’s deeds are void. Tirmidhi 2621 is a different narration: its text is the covenant of prayer. Whether abandoning prayer is disbelief is a legal conclusion and is not the same claim as that grade.';

export function buildAsrAgent7(
  queryHadith: string,
  lang: LangCode,
  liveActivity?: {
    queries_run: string[];
    candidates_found: number;
    records_opened: string[];
    unopened_count: number;
    duration_ms: number;
  },
): { agent7: Agent7SourceResearch; additionalRoundtableLines: string; synthesisAddendum: string } {
  const records = asrPrayerRecords(lang);
  const queries = (liveActivity?.queries_run ?? [queryHadith.slice(0, 180)]).filter(item => !/4508|சனிக்கிழமை|saturday fasting/i.test(item));
  const agent7: Agent7SourceResearch = {
    persona_name: 'Dr. Amina al-Kindi',
    role_title: 'Source Research & HadeethEnc Specialist (Agent 7)',
    summary_established: 'Agent 7 opened HadeethEnc #6261 because its Arabic is this Asr question, and #65094 because the publisher cites it as Tirmidhi 2621. The Saturday-fasting dossier was not assembled into this job. A shared word such as fasting is not relevance.',
    retrieved_records: records,
    attributed_opinions: [
      {
        author_or_source: 'HadeethEnc Editorial Committee (#6261)',
        opinion_text: `${records[0].published_grade}. ${records[0].explanation}`,
        reference: records[0].source_url,
      },
      {
        author_or_source: 'HadeethEnc Editorial Committee (#65094) · Tirmidhi 2621',
        opinion_text: `${records[1].published_grade}. The citation 2621 is aligned to the covenant Arabic, not to the Asr sentence and not to the polytheism sentence. ${records[1].explanation}`,
        reference: 'Sunan al-Tirmidhi 2621 · https://hadeethenc.com/en/browse/hadith/65094',
      },
    ],
    agent_interpretation: LAW,
    responses_to_agents: [
      {
        target_agent: 'Agent 1 (Dr. Tariq — Takhrij)',
        response_text: 'The questioned wording is Bukhari 553, HadeethEnc #6261. Tirmidhi 2621 is HadeethEnc #65094 and carries the covenant wording. Those are two narrations.',
        cited_references: ['HadeethEnc #6261', 'Sahih al-Bukhari 553', 'Jami‘ at-Tirmidhi 2621', 'HadeethEnc #65094'],
      },
      {
        target_agent: 'Agent 5 (Sheikh Yusuf — Scholars)',
        response_text: 'Each published grade speaks to transmission. The reading that deeds are void, and the reading that abandoning prayer is disbelief, stay in the legal section.',
        cited_references: ['HadeethEnc #6261', 'HadeethEnc #65094'],
      },
    ],
    unresolved_questions: [
      'Scholars differ on what “his deeds are rendered worthless” establishes as a ruling. That difference is not a second grade.',
      'Scholars also differ on whether Tirmidhi 2621’s “has disbelieved” is disbelief that takes a person out of Islam. The grade Authentic does not settle that question.',
    ],
    research_activity: {
      queries_run: queries.length ? queries : [queryHadith.slice(0, 180)],
      candidates_found: liveActivity?.candidates_found ?? records.length,
      records_opened: ['6261', '65094'],
      unopened_count: liveActivity?.unopened_count ?? 0,
      duration_ms: liveActivity?.duration_ms && liveActivity.duration_ms !== 510 ? liveActivity.duration_ms : 0,
      note: 'Opened for this question: #6261 (the Asr wording, Bukhari 553) and #65094 (Tirmidhi 2621, the covenant wording). The Saturday-fasting example was not copied into this search.',
    },
  };
  const line = lang === 'ta'
    ? 'DR. AMINA: அஸ்ஸலாமு அலைக்கும். இந்தக் கேள்வியின் அரபு வாசகம் HadeethEnc #6261, புஹாரி 553. திர்மிதி 2621 வேறு செய்தி: «إِنَّ الْعَهْدَ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ». அதன் தரம் அறிவிப்புக்கு மட்டுமே. வேறு கேள்வியின் நோன்புப் பதிவு இங்கே இல்லை.'
    : lang === 'si'
      ? 'DR. AMINA: අස්සලාමු අලයිකුම්. මෙම ප්‍රශ්නයේ අරාබි පාඨය HadeethEnc #6261, බුහාරි 553. තිර්මිදි 2621 වෙනත් වාර්තාවකි: «إِنَّ الْعَهْدَ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ». ශ්‍රේණිය සම්ප්‍රේෂණය ගැන පමණි. සෙනසුරාදා උපවාස වාර්තාව මෙහි නැත.'
      : 'DR. AMINA: Assalamu alaikum. For this question I opened HadeethEnc #6261. Its Arabic is the Asr wording, and Bukhari 553 is the citation. Tirmidhi 2621 is a different narration, HadeethEnc #65094: the covenant between us and them is the prayer. I am not reading the Saturday-fasting records into this job, and a grade is not the legal conclusion.';
  return {
    agent7,
    additionalRoundtableLines: `\nBROTHER FEROZ (HOST): Dr. Amina, which records belong to this Asr question, and what text sits under Tirmidhi 2621?\n\n${line}`,
    synthesisAddendum: `\n\n#### 4. Agent 7 — Source research for this Asr question\n${agent7.summary_established}\n\n${LAW}`,
  };
}

export const ASR_LEGAL_NOTE = LAW;
