import type { Agent7SourceResearch, HadeethEncRetrievedRecord } from '../types/hadith.ts';
import { PRAYER_DEEDS_PACK } from '../data/prayerDeedsPack.ts';
import { PRAYER_DEEDS_EMPTY_NOTE, PRAYER_DEEDS_PROVIDER_NOTE } from '../../shared/research/prayerDeeds.ts';

type LangCode = 'en' | 'ta' | 'si';

const LAW =
  'Authentic is the transmission grade printed on these records. It does not decide whether the fasting, charity, or other deeds of a person who does not pray are accepted. HadeethEnc #6261 connects leaving the Asr prayer with deeds being rendered worthless. It names the Asr prayer, not fasting or charity. HadeethEnc #65093 says that abandoning the prayers is what stands between a man and disbelief. It does not mention fasting or charity. HadeethEnc #65094 is a different narration: its Arabic is the covenant of prayer, and the publisher cites it as Tirmidhi 2621. The sentence about polytheism is #65093, not 2621. A publisher’s explanation that draws a legal conclusion is not the grade.';

function copy(lang: LangCode, id: '6261' | '65093' | '65094') {
  return PRAYER_DEEDS_PACK[lang][id];
}

export function prayerDeedsRecords(
  lang: LangCode,
  live?: readonly HadeethEncRetrievedRecord[],
  usePack = true,
): HadeethEncRetrievedRecord[] {
  const byId = new Map((live ?? []).map(record => [record.id, record]));
  const specs = [
    {
      id: '6261' as const,
      status: 'Direct Hadith Match' as const,
      reason:
        'HadeethEnc #6261 is included because its wording connects leaving the Asr prayer with deeds being rendered worthless. A shared word such as fasting is not why it is here. It does not name fasting or charity.',
    },
    {
      id: '65093' as const,
      status: 'Direct Hadith Match' as const,
      reason:
        'HadeethEnc #65093 is included because its wording is about abandoning the prayers. It does not mention fasting or charity, so it does not by itself settle those deeds.',
    },
    {
      id: '65094' as const,
      status: 'Distinct narration (own citation)' as const,
      reason:
        'HadeethEnc #65094 is kept because its published attribution is Tirmidhi, Nasa’i, Ibn Majah, and Ahmad, and its Arabic is the covenant wording. It is not the polytheism sentence and it is not evidence that fasting is void.',
    },
  ];
  return specs.flatMap(spec => {
    const found = byId.get(spec.id);
    if (found) return [{ ...found, match_status: spec.status, match_reason: spec.reason }];
    if (!usePack) return [];
    const row = copy(lang, spec.id);
    return [{
      id: spec.id,
      title: row.title,
      arabic: row.arabic,
      translation: row.text,
      language: lang,
      explanation: row.explanation,
      lessons: [...row.lessons],
      published_grade: row.grade,
      collection_attribution: row.attribution,
      source_url: `https://hadeethenc.com/${lang}/browse/hadith/${spec.id}`,
      reader_route: `#/hadith/${spec.id}?lang=${lang}`,
      match_status: spec.status,
      match_reason: spec.reason,
    }];
  });
}

export function buildPrayerDeedsAgent7(
  queryHadith: string,
  lang: LangCode,
  liveRecords?: readonly HadeethEncRetrievedRecord[],
  liveActivity?: { queries_run: string[]; duration_ms?: number; note?: string },
  options?: { providerFailed?: boolean; usePack?: boolean },
): { agent7: Agent7SourceResearch; additionalRoundtableLines: string } {
  const providerFailed = options?.providerFailed === true || /provider failure/i.test(liveActivity?.note ?? '');
  const searchedEmpty = /no decisive record/i.test(liveActivity?.note ?? '');
  const usePack = options?.usePack ?? (!providerFailed && !searchedEmpty && !liveActivity);
  const records = providerFailed ? [] : prayerDeedsRecords(lang, liveRecords, usePack);
  const queries = (liveActivity?.queries_run ?? [queryHadith.slice(0, 180)]).filter(item => !/4508|saturday fasting|சனிக்கிழமை/i.test(item));
  const openedIds = records.map(record => record.id);
  const has = (id: string) => openedIds.includes(id);
  const line = providerFailed
    ? ''
    : lang === 'ta'
      ? `DR. AMINA: அஸ்ஸலாமு அலைக்கும். தொழாதவனின் நோன்பு, தர்மம், மற்ற நல்லறங்கள் என்ற கேள்விக்கு${has('6261') ? ' #6261' : ''}${has('65093') ? ' #65093' : ''} வைக்கப்பட்டன. ${has('6261') ? '#6261 அஸ்ர் தொழுகையை விடுவதையும் நற்செயல்கள் வீணாவதையும் இணைக்கிறது. அது நோன்பையோ தர்மத்தையோ பெயரிடவில்லை.' : ''} ${has('65093') ? '#65093 தொழுகையை விடுவது பற்றியது.' : ''} ${has('65094') ? 'திர்மிதி 2621 என்பது #65094, வேறு வாசகம்.' : ''} தரம் அறிவிப்புக்கு மட்டுமே. நோன்பு ஏற்கப்படுமா என்பது சட்ட விளக்கம்.`
      : lang === 'si'
        ? `DR. AMINA: අස්සලාමු අලයිකුම්. සලාතය නොකරන අයගේ උපවාසය සහ දානය ගැන${has('6261') ? ' #6261' : ''}${has('65093') ? ' #65093' : ''} තබා ඇත. ${has('6261') ? '#6261 අසර් සලාතය හා කටයුතු නිෂ්ඵල වීම සම්බන්ධ කරයි. එය උපවාසය හෝ දානය නම් නොකරයි.' : ''} ${has('65093') ? '#65093 සලාතය අත්හැරීම ගැනයි.' : ''} ${has('65094') ? 'තිර්මිදි 2621 යනු #65094, වෙනත් වාක්‍යයකි.' : ''} ශ්‍රේණිය සම්ප්‍රේෂණය ගැන පමණි. උපවාසය පිළිගැනේද යන්න නීතිමය ප්‍රශ්නයකි.`
        : `DR. AMINA: Assalamu alaikum. For the person who does not pray, the kept records are ${openedIds.map(id => `#${id}`).join(', ') || 'none'}. ${has('6261') ? '#6261 connects leaving the Asr prayer with deeds being rendered worthless. It does not name fasting or charity.' : ''} ${has('65093') ? '#65093 is about abandoning the prayers.' : ''} ${has('65094') ? 'Tirmidhi 2621 is #65094, a different sentence.' : ''} The grade is the transmission. Whether fasting and charity are accepted is a legal question.`;
  const cited = openedIds.map(id => `HadeethEnc #${id}`);
  const agent7: Agent7SourceResearch = {
    persona_name: 'Dr. Amina al-Kindi',
    role_title: 'Source Research & HadeethEnc Specialist (Agent 7)',
    summary_established: providerFailed
      ? PRAYER_DEEDS_PROVIDER_NOTE
      : records.length
        ? `This question asks what becomes of the fasting, charity, and other deeds of a person who does not pray. The records kept are ${openedIds.map(id => `#${id}`).join(', ')}. #6261 and #65093 speak about leaving prayer. They do not name fasting or charity. #65094, when kept, is a different narration under its own citation. General fasting records were not used.`
        : PRAYER_DEEDS_EMPTY_NOTE,
    retrieved_records: records,
    attributed_opinions: records.map(record => ({
      author_or_source: `HadeethEnc Editorial Committee (#${record.id})`,
      opinion_text: `${record.published_grade ?? 'No grade printed'}. ${record.explanation ?? ''} This explanation is the publisher’s reading. It is not the transmission grade.`,
      reference: record.source_url,
    })),
    agent_interpretation: LAW,
    responses_to_agents: records.length
      ? [
          {
            target_agent: 'Agent 1 (Dr. Tariq — Takhrij)',
            response_text: [
              has('6261') ? '#6261 is the Asr wording and its collection attribution is Bukhari.' : '',
              has('65093') ? '#65093 is the abandonment-of-prayer wording and its attribution is Muslim. The polytheism sentence is this record.' : '',
              has('65094') ? '#65094 is the covenant wording. The publisher cites it as Tirmidhi 2621. It is not the polytheism sentence.' : '',
            ].filter(Boolean).join(' '),
            cited_references: cited,
          },
          {
            target_agent: 'Agent 5 (Sheikh Yusuf — Scholars)',
            response_text: 'Each published grade speaks to transmission. The reading that fasting and charity are rejected is a legal conclusion and stays separate from those grades.',
            cited_references: cited,
          },
        ]
      : [],
    unresolved_questions: [
      'No opened passage states that the fasting or charity of a person who does not pray is rejected. Scholars differ on that legal question.',
      'Scholars also differ on whether “has disbelieved” in #65094, and the polytheism sentence in #65093, means disbelief that takes a person out of Islam. The grade does not settle that.',
    ],
    research_activity: {
      queries_run: queries.length ? queries : [queryHadith.slice(0, 180)],
      candidates_found: records.length,
      records_opened: records.map(record => record.id),
      unopened_count: 0,
      duration_ms: liveActivity?.duration_ms && liveActivity.duration_ms !== 510 ? liveActivity.duration_ms : 0,
      note: providerFailed
        ? PRAYER_DEEDS_PROVIDER_NOTE
        : records.length
          ? `Opened for this question: ${openedIds.map(id => `#${id}`).join(', ')}. General fasting records were not copied in. The grade is not a legal ruling.`
          : PRAYER_DEEDS_EMPTY_NOTE,
    },
  };
  const yusuf = lang === 'ta'
    ? 'SHEIKH YUSUF: அச்சிடப்பட்ட தரம் அறிவிப்புக்கு மட்டுமே. நோன்பும் தர்மமும் ஏற்கப்படுமா என்பது சட்ட விளக்கம். இந்தப் பதிவுகள் அதைத் தீர்க்கவில்லை.'
    : lang === 'si'
      ? 'SHEIKH YUSUF: මුද්‍රිත ශ්‍රේණිය සම්ප්‍රේෂණය ගැන පමණි. උපවාසය සහ දානය පිළිගැනේද යන්න නීතිමය ප්‍රශ්නයකි. මෙම වාර්තා එය විසඳන්නේ නැත.'
      : 'SHEIKH YUSUF: The printed grade is the transmission. Whether fasting and charity are accepted is a legal question, and these records do not settle it.';
  const tariq = lang === 'ta'
    ? `DR. TARIQ: ${has('65094') ? '#65094 உடன்படிக்கை வாசகம். வெளியீட்டாளர் அதை திர்மிதி 2621 என்று குறிப்பிடுகிறார். இணைவைப்பு வாசகம் அது அல்ல.' : 'வைக்கப்பட்ட பதிவின் தரம் சட்டத் தீர்ப்பு அல்ல.'}`
    : lang === 'si'
      ? `DR. TARIQ: ${has('65094') ? '#65094 ගිවිසුම් වාක්‍යයයි. ප්‍රකාශකයා එය තිර්මිදි 2621 ලෙස දක්වයි. ආදේශක වාක්‍යය එය නොවේ.' : 'තබා ඇති වාර්තාවක ශ්‍රේණිය නීතිමය තීන්දුවක් නොවේ.'}`
      : `DR. TARIQ: ${has('65094') ? '#65094 is the covenant sentence. The publisher cites it as Tirmidhi 2621. It is not the polytheism sentence.' : 'A grade on a kept record is not itself the legal ruling.'}`;
  const host = lang === 'ta'
    ? 'BROTHER FEROZ (HOST): டாக்டர் அமீனா, தொழாதவனின் நோன்பு, தர்மம் பற்றி எந்தப் பதிவுகள் சொல்கின்றன?'
    : lang === 'si'
      ? 'BROTHER FEROZ (HOST): ආචාර්ය අමීනා, සලාතය නොකරන අයගේ උපවාසය සහ දානය ගැන කුමන වාර්තා කියයිද?'
      : 'BROTHER FEROZ (HOST): Dr. Amina, which records belong to the person who does not pray, and what do they actually say about fasting and charity?';
  const table = providerFailed || !records.length || !line ? '' : `\n${host}\n\n${line}\n\n${yusuf}\n\n${tariq}`;
  return {
    agent7,
    additionalRoundtableLines: table,
  };
}

export const PRAYER_DEEDS_LEGAL_NOTE = LAW;
