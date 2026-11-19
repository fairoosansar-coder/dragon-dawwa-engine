import type { Lang } from '../sources.ts';

/** The Tamil question printed on the owner’s report. */
export const TAMIL_PRAYER_DEEDS =
  'தொழாதவனின் நோன்பு, தர்மம் போன்ற நல்லறங்களின் நிலை என்ன?';

/** The same relationship in Sinhala, for the paired run. */
export const SINHALA_PRAYER_DEEDS =
  'සලාතය නොකරන අයගේ උපවාසය, දානය සහ අනෙකුත් යහපත් ක්‍රියාවල තත්ත්වය කුමක්ද?';

export type PrayerDeedsRole = 'support' | 'distinct' | 'background' | 'unrelated';

const NOT_PRAYING =
  /தொழாத|தொழுகையை விட்ட|does not pray|do not pray|not praying|whoever (?:does not|doesn't) pray|abandon(?:s|ing|ed)? (?:the )?(?:prayer|prayers|ṣalāh|salah)|සලාතය නො|නොසලා/i;

const DEEDS = /நோன்பு|தர்மம்|நல்லற|சதகா|\bfasts?\b|\bfasting\b|\bcharit|\bdeeds?\b|\bzak[aā]h\b|උපවාස|දාන|සදකා|යහපත්/i;

/** The relationship “not praying → fasting, charity, and other deeds.” A fasting word alone is not this question. */
export function isPrayerDeedsQuestion(question: string): boolean {
  return NOT_PRAYING.test(question) && DEEDS.test(question);
}

export interface RecoveryQuery {
  language: Lang;
  phrase: string;
}

/**
 * At most two catalogue phrases. They run only after the question’s own words return nothing.
 * The reader’s language is used when the record is opened.
 */
export function prayerDeedsRecovery(language: Lang): RecoveryQuery[] {
  if (language === 'ta') {
    return [
      { language: 'ta', phrase: 'தொழுகையை விட்ட' },
      { language: 'en', phrase: 'abandons the prayer' },
    ];
  }
  if (language === 'si') {
    return [
      { language: 'si', phrase: 'සලාතය අත්හැර' },
      { language: 'en', phrase: 'abandons the prayer' },
    ];
  }
  return [
    { language: 'en', phrase: 'abandons the prayer' },
    { language: 'en', phrase: 'covenant between us and them' },
  ];
}

const SUPPORT_IDS = new Set(['6261', '65093']);
const DISTINCT_IDS = new Set(['65094']);
const FASTING_BACKGROUND = new Set(['4508', '3546', '65003', '4542', '4549']);

export function prayerDeedsRole(record: { id: string; title?: string; text?: string; arabic?: string | null }): PrayerDeedsRole {
  if (SUPPORT_IDS.has(record.id)) return 'support';
  if (DISTINCT_IDS.has(record.id)) return 'distinct';
  if (FASTING_BACKGROUND.has(record.id)) return 'background';
  const blob = `${record.title ?? ''} ${record.text ?? ''} ${record.arabic ?? ''}`;
  const leavesPrayer = /ترك الصلاة|تَرْكَ الصَّلَاةِ|تَرَكَ صَلَاةَ|abandon(?:s|ing)? the (?:‘|')?asr prayer|abandonment of the prayers|தொழுகையை விடு|අත්හැර/i.test(blob);
  const aboutDeeds = /حبط عمله|حَبِطَ عَمَلُهُ|deeds will be rendered worthless|நற்செயல்கள் அழிந்து|කටයුතු නිෂ්ඵල/i.test(blob);
  if (leavesPrayer && aboutDeeds) return 'support';
  if (leavesPrayer) return 'distinct';
  if (/صوم|நோன்பு|උපවාස|\bfast/i.test(blob)) return 'background';
  return 'unrelated';
}

export type InvestigationState = 'complete' | 'partial' | 'blocked';

export function prayerDeedsInvestigation(input: {
  supportCount: number;
  providerFailed: boolean;
}): InvestigationState {
  if (input.providerFailed && input.supportCount === 0) return 'blocked';
  if (input.supportCount === 0) return 'partial';
  // The opened narrations name prayer and deeds, or prayer and disbelief. They do not state a ruling on fasting and charity.
  return 'partial';
}

export const PRAYER_DEEDS_PROVIDER_NOTE =
  'HadeethEnc did not respond. This is a provider failure, not an empty subject.';

export const PRAYER_DEEDS_EMPTY_NOTE =
  'The catalogue returned no decisive record after the question’s own words and two recovery phrases. This is not a completed investigation.';

export interface PrayerDeedsAnswer {
  paragraphs: { text: string; citations: string[] }[];
  insufficientEvidence: boolean;
  writer: 'retrieved';
}

/** The same limits the report and the spoken episode use. Citations are the passage ids actually kept. */
export function prayerDeedsAnswer(
  language: Lang,
  passages: readonly { id: string }[],
): PrayerDeedsAnswer {
  const ids = passages.map(passage => passage.id);
  const has = (id: string) => ids.some(item => item.endsWith(id));
  const kept = ['6261', '65093', '65094'].filter(has);
  const text = language === 'ta'
    ? [
        has('6261')
          ? 'HadeethEnc #6261 அஸ்ர் தொழுகையை விடுவதையும் நற்செயல்கள் வீணாவதையும் இணைக்கிறது. அது நோன்பையோ தர்மத்தையோ பெயரிடவில்லை.'
          : '',
        has('65093')
          ? 'HadeethEnc #65093 தொழுகையை விடுவது பற்றியது. அது நோன்பையோ தர்மத்தையோ குறிப்பிடவில்லை. இணைவைப்பு வாசகம் இதில்தான் உள்ளது.'
          : '',
        has('65094')
          ? 'HadeethEnc #65094 வேறு வாசகம். அதன் அரபி உடன்படிக்கை வாசகம். வெளியீட்டாளர் அதை திர்மிதி 2621 என்று குறிப்பிடுகிறார். அது #65093 அல்ல.'
          : '',
        kept.length
          ? 'அச்சிடப்பட்ட தரம் அறிவிப்பின் தரம் மட்டுமே. நோன்பும் தர்மமும் ஏற்கப்படுமா என்பது சட்ட விளக்கம். திறந்த பதிவுகள் அந்தச் சட்டக் கேள்வியைத் தீர்க்கவில்லை.'
          : 'இந்த ஓட்டத்தில் தீர்க்கமான பதிவு எதுவும் வைக்கப்படவில்லை. இது முழு ஆய்வு முடிந்தது என்று கூறப்படவில்லை.',
      ].filter(Boolean).join(' ')
    : language === 'si'
      ? [
          has('6261')
            ? 'HadeethEnc #6261 අසර් සලාතය හා කටයුතු නිෂ්ඵල වීම සම්බන්ධ කරයි. එය උපවාසය හෝ දානය නම් නොකරයි.'
            : '',
          has('65093')
            ? 'HadeethEnc #65093 සලාතය අත්හැරීම ගැනයි. එය උපවාසය හෝ දානය සඳහන් නොකරයි. ආදේශක වාක්‍යය මෙහි ඇත.'
            : '',
          has('65094')
            ? 'HadeethEnc #65094 වෙනත් වාක්‍යයකි. එහි අරාබි ගිවිසුම් වාක්‍යයයි. ප්‍රකාශකයා එය තිර්මිදි 2621 ලෙස දක්වයි. එය #65093 නොවේ.'
            : '',
          kept.length
            ? 'මුද්‍රිත ශ්‍රේණිය සම්ප්‍රේෂණය ගැන පමණි. උපවාසය සහ දානය පිළිගැනේද යන්න නීතිමය ප්‍රශ්නයකි. විවෘත වාර්තා එය විසඳන්නේ නැත.'
            : 'මෙම ධාවනය තීරණාත්මක වාර්තාවක් තබා නැත. මෙය සම්පූර්ණ විමර්ශනයක් ලෙස නොගණන් ගනී.',
        ].filter(Boolean).join(' ')
      : [
          has('6261')
            ? 'HadeethEnc #6261 connects leaving the Asr prayer with deeds being rendered worthless. It does not name fasting or charity.'
            : '',
          has('65093')
            ? 'HadeethEnc #65093 is about abandoning the prayers. It does not mention fasting or charity. The polytheism sentence is this record.'
            : '',
          has('65094')
            ? 'HadeethEnc #65094 is a different sentence. Its Arabic is the covenant wording, and the publisher cites it as Tirmidhi 2621. It is not #65093.'
            : '',
          kept.length
            ? 'The printed grade is a transmission grade. Whether fasting and charity are accepted is a legal question. The opened records do not settle it.'
            : 'This run kept no decisive record. It is not a completed investigation.',
        ].filter(Boolean).join(' ');
  return {
    paragraphs: [{ text, citations: passages.map(passage => passage.id) }],
    insufficientEvidence: true,
    writer: 'retrieved',
  };
}
