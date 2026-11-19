/**
 * Deterministic scholarly roundtables for Qur'an & The Modern World hub cards.
 * EN / TA / SI are authored natively — never LLM "cache isolation" meta-dialogue.
 */

import type { RoundtableTurn } from '../shared/sevenAgentTypes.ts';
import type { Lang } from '../shared/sources.ts';
import { userFacingResearchQuestion } from '../shared/modernWorldBenchmarks.ts';

type HubCardId =
  | 'twenty-three-year'
  | 'primordial-universality'
  | 'micro-sunnah-science'
  | 'macro-governance';

function host(role: string, text: string): RoundtableTurn {
  return {
    speaker: 'Brother Feroz (Host)',
    role,
    voiceProfile: 'tariq',
    text,
  };
}

function tariq(role: string, text: string): RoundtableTurn {
  return {
    speaker: 'Dr. Tariq al-Mansoor',
    role,
    voiceProfile: 'tariq',
    text,
  };
}

function farhan(role: string, text: string): RoundtableTurn {
  return {
    speaker: 'Shaykh Farhan al-Rashed',
    role,
    voiceProfile: 'yusuf',
    text,
  };
}

function zainab(role: string, text: string): RoundtableTurn {
  return {
    speaker: 'Dr. Zainab al-Mubarak',
    role,
    voiceProfile: 'noor',
    text,
  };
}

function twentyThreeYear(lang: Lang, question: string): RoundtableTurn[] {
  const q = userFacingResearchQuestion(question);
  if (lang === 'ta') {
    return [
      host(
        'Executive Roundtable Moderator',
        `அஸ்ஸலாமு அலைக்கும். இன்றைய ஏழு நிபுணர் வட்டமேசை ஆய்வு இந்தக் கேள்வியை மட்டும் ஆராய்கிறது: "${q}"`,
      ),
      tariq(
        'Agent 02 · Hadith & Seerah Specialist',
        'நம்பகமான சீரா வரலாறு நபி (ஸல்) அவர்களின் தூதை நாற்பது வயதிற்குப் பின் சுமார் பதின்மூன்று மக்கா ஆண்டுகளும் பத்து மதீனா ஆண்டுகளுமாக அமைக்கிறது. புகாரி 2977 “ஜவாமிஉல் கலிம்” — சுருக்கமான சொல்லில் பெரும் சீர்திருத்தம் — என்று உம்மி தூதருக்கு வஹீ மூலம் கற்பிக்கப்பட்ட ஆற்றலை விளக்குகிறது.',
      ),
      farhan(
        'Agent 04 · Classical Fiqh & Consensus Lead',
        'உசூல் அறிஞர்கள் தத்ரீஜ் எனும் படிப்படியான வெளிப்பாட்டை வலியுறுத்துவர்: முதலில் நம்பிக்கையும் ஒழுக்கமும், பின்னர் விரிவான சட்டம். அவ்வரிசைதான் சிதறிய அரபுச் சமூகம் ஒருங்கிணைந்த ஷரீஅத்தை உள்வாங்க உதவியது.',
      ),
      zainab(
        'Agent 06 · Modern Science & 1-Step-Ahead Foresight',
        'நவீன நடத்தை மாற்ற ஆய்வும் சமூக மூலதன ஆய்வும் முதலில் அடையாளத்தையும் புனித விழுமியங்களையும் உறுதிப்படுத்தி பின்னர் நிறுவனங்களை அமைக்கச் சொல்கின்றன. சீரா இதை வஹீ வழி நடைமுறைப்படுத்தியது; அறிவியல் மாதிரிகள் பின்னால் வந்தன.',
      ),
      host(
        'Executive Roundtable Moderator',
        'சுருக்கம்: இருபத்து மூன்று ஆண்டு நாகரிக எழுச்சி என்பது குர்ஆன் 62:2 போல் வேதத்தையும் ஞானத்தையும் கற்பிக்கும் வஹீ — மக்காவிலிருந்து மதீனா வரை நபிவழி நாகரிகம்.',
      ),
    ];
  }
  if (lang === 'si') {
    return [
      host(
        'Executive Roundtable Moderator',
        `අස්සලාමු අලයිකුම්. අද අපේ නිපුණයන් හත්දෙනාගේ වටමේසය මෙම ප්‍රශ්නය පමණක් සාකච්ඡා කරයි: "${q}"`,
      ),
      tariq(
        'Agent 02 · Hadith & Seerah Specialist',
        'සහීහ් සීරා කාලානුකූලය අනුව නබි (ﷺ) තුමාගේ දූතකාලය වයස අවුරුදු හතළිහට පසුව මක්කාහ් වසර දහතුනක් පමණ සහ මදීනා වසර දහයක් පමණ වේ. බුහාරි 2977 “ජවාමිඋල් කලිම්” — කෙටි වචනයෙන් විශාල ප්‍රතිසංස්කරණය — යනු වහ්යයෙන් ඉගැන්වූ උම්මි දූතයාගේ ශක්තියයි.',
      ),
      farhan(
        'Agent 04 · Classical Fiqh & Consensus Lead',
        'උසූල් විද්වතුන් තද්රීජ් එනම් ක්‍රමානුකූල හෙළිදරව්ව අවධාරණය කරති: පළමුව ඇදහිල්ල සහ චරිතය, පසුව විස්තරාත්මක නීතිය. එම අනුපිළිවෙල නිසා විසිරුණු අරාබි සමාජය එකතු ෂරීඅාව භාර ගත්තේය.',
      ),
      zainab(
        'Agent 06 · Modern Science & 1-Step-Ahead Foresight',
        'නවීන හැසිරීම් වෙනස්වීමේ විද්‍යාව සහ සමාජ ප්‍රාග්ධන පර්යේෂණ පළමුව අනන්‍යතාව ස්ථාවර කර පසුව ආයතන ගොඩනැගීම ගැන කියයි. සීරා මෙය වහ්යයෙන් ක්‍රියාත්මක කළේය; විද්‍යාත්මක ආකෘති පසුව ආවේය.',
      ),
      host(
        'Executive Roundtable Moderator',
        'සාරාංශය: වසර විසිතුනක ශිෂ්ටාචාර පෙරළිය යනු කුර්ආන් 62:2 මෙන් කිතාබ් සහ හික්මා ඉගැන්වූ වහ්යයයි — මක්කාවේ සිට මදීනාව දක්වා නබිමය ශිෂ්ටාචාරය.',
      ),
    ];
  }
  return [
    host(
      'Executive Roundtable Moderator',
      `Assalamu Alaikum. Today's 7-Agent Roundtable examines: "${q}"`,
    ),
    tariq(
      'Agent 02 · Hadith & Seerah Specialist',
      'The authentic Seerah places the mission after age forty across roughly thirteen Makkan and ten Madinan years. Bukhari 2977 notes jawami‘ al-kalim—concise speech with vast reforming power—fitting an ummi messenger taught by Wahy.',
    ),
    farhan(
      'Agent 04 · Classical Fiqh & Consensus Lead',
      'Usul scholars highlight tadrij: creed and character first, then detailed law. That sequence is how a fractured Arabian society could absorb a coherent Shariah without social collapse.',
    ),
    zainab(
      'Agent 06 · Modern Science & 1-Step-Ahead Foresight',
      'Contemporary staged-change and social-capital research rediscovers what the Seerah already practiced: stabilize identity and sacred norms, then institutionalize justice. Revelation led; empirical models followed.',
    ),
    host(
      'Executive Roundtable Moderator',
      'Synthesis: the 23-year transformation is Wahy teaching Book and Wisdom (62:2)—Prophetic civilization shaped by revelation across Makkah and Madinah.',
    ),
  ];
}

function primordialUniversality(lang: Lang, question: string): RoundtableTurn[] {
  const q = userFacingResearchQuestion(question);
  if (lang === 'ta') {
    return [
      host(
        'Executive Roundtable Moderator',
        `அஸ்ஸலாமு அலைக்கும். நமது கேள்வி: "${q}" ஆதம், பித்ரா, உலகளாவிய மனிதகுலம் ஆகியவற்றை ஆய்வோம்.`,
      ),
      tariq(
        'Agent 02 · Hadith Specialist',
        'புகாரி 1358 மற்றும் முஸ்லிம் 2658 ஒவ்வொரு குழந்தையும் பித்ராவின் மீது பிறக்கிறது என்கின்றன. அந்நபிமொழி குர்ஆன் 4:1 ஒரே ஆன்மாவிலிருந்து படைப்புடன் இணைகிறது.',
      ),
      farhan(
        'Agent 04 · Fiqh Lead',
        'ஆதமைப் பகிரும் மனிதகுலம் என்பதால், ஃபிக்ஹ் இன மேலாண்மையை நிராகரித்து கண்ணியத்தை தக்வாவால் அளக்கிறது (49:13).',
      ),
      zainab(
        'Agent 06 · Science Foresight',
        'மரபியலும் ஒழுக்க உளவியலும் ஒரே மனிதக் குடும்பத்தையும் ஆரம்ப ஒழுக்க உணர்வையும் மீண்டும் கண்டறிகின்றன — பித்ராவை எதிரொலிக்கும்; வெளிப்பாடு முதன்மை.',
      ),
      host(
        'Executive Roundtable Moderator',
        'தீர்ப்பு: இஸ்லாம் ஆதமின் பிள்ளைகளுக்கான தொன்மையான பித்ரா — பிந்தைய பழங்குடிக் கண்டுபிடிப்பு அல்ல.',
      ),
    ];
  }
  if (lang === 'si') {
    return [
      host(
        'Executive Roundtable Moderator',
        `අස්සලාමු අලයිකුම්. අපේ ප්‍රශ්නය: "${q}" අපි ආදම්, ෆිත්‍රා සහ සර්වජනීන මනුෂ්‍යත්වය පිළිබඳ සාකච්ඡා කරමු.`,
      ),
      tariq(
        'Agent 02 · Hadith Specialist',
        'බුහාරි 1358 සහ මුස්ලිම් 2658 කියයි සෑම දරුවෙක්ම ෆිත්‍රාව මත උපත ලබන බව. එම නබිවදනය කුර්ආන් 4:1 එක ආත්මයකින් මිනිස් වර්ගය නිර්මාණය කිරීම සමඟ ගැලපේ.',
      ),
      farhan(
        'Agent 04 · Fiqh Lead',
        'මනුෂ්‍යත්වය ආදම් සමඟ බෙදා ගන්නා නිසා, ෆික්හ් ජාතිවාදී උත්කර්ෂය ප්‍රතික්ෂේප කර ගෞරවය තක්වාවෙන් මනිනු ලබයි (49:13).',
      ),
      zainab(
        'Agent 06 · Science Foresight',
        'ජාන විද්‍යාව සහ සදාචාර මනෝවිද්‍යාව එකම මිනිස් පවුලක් සහ මුල් සදාචාර අනුභූතිය නැවත සොයා ගනී — ෆිත්‍රාවට අනුරූප වන අතර හෙළිදරව්ව ප්‍රධාන වේ.',
      ),
      host(
        'Executive Roundtable Moderator',
        'තීන්දුව: ඉස්ලාමය ආදම්ගේ දරුවන්ට අයත් ප්‍රාග් ඓතිහාසික ෆිත්‍රාවයි — ප්‍රමාද ගෝත්‍රික සොයාගැනීමක් නොවේ.',
      ),
    ];
  }
  return [
    host(
      'Executive Roundtable Moderator',
      `Assalamu Alaikum. Our question: "${q}" We examine Adam, Fitrah, and universal humanity.`,
    ),
    tariq(
      'Agent 02 · Hadith Specialist',
      'Bukhari 1358 and Muslim 2658 state every child is born upon the Fitrah. That Prophetic teaching pairs with Qur’an 4:1 on creation from one soul.',
    ),
    farhan(
      'Agent 04 · Fiqh Lead',
      'Because humanity shares Adam’s origin, fiqh rejects racial supremacy and measures nobility by taqwa (49:13).',
    ),
    zainab(
      'Agent 06 · Science Foresight',
      'Genetics and moral psychology rediscover shared origins and early predispositions—echoing Fitrah while revelation remains first.',
    ),
    host(
      'Executive Roundtable Moderator',
      'Verdict: Islam is primordial Fitrah for the children of Adam—not a late tribal invention.',
    ),
  ];
}

function microSunnahScience(lang: Lang, question: string): RoundtableTurn[] {
  const q = userFacingResearchQuestion(question);
  if (lang === 'ta') {
    return [
      host(
        'Executive Roundtable Moderator',
        `அஸ்ஸலாமு அலைக்கும். கேள்வி: "${q}" பேரீச்சம்பழம், நோன்பு, உறக்கம், மனஉறுதி ஆகியவற்றில் கவனம் செலுத்துவோம்.`,
      ),
      tariq(
        'Agent 02 · Hadith Specialist',
        'ஸஹீஹைன் நபிவழி உணவு மற்றும் நோன்பு வழிகாட்டலைப் பாதுகாக்கின்றன. திறந்த தொகுப்புகளை மட்டும் மேற்கோள் காட்டுகிறோம்; கற்பனை மருத்துவச் சங்கிலிகளைச் சேர்ப்பதில்லை.',
      ),
      farhan(
        'Agent 04 · Fiqh Lead',
        'ரமளான் கடமை; நுண்ணிய சுன்னாக்கள் அதப் மற்றும் மிதமான வரம்பில் பரிந்துரை; மருத்துவத் தேவையில் சலுகை உண்டு.',
      ),
      zainab(
        'Agent 06 · Science Foresight',
        'ஊட்டச்சத்து மற்றும் இடைவெளி வளர்சிதை மாற்ற ஆய்வுகள் இப்பழக்கங்களின் ஹிக்மத்தை வெளிப்படுத்துகின்றன; நாம் அவற்றைக் கடைப்பிடிப்பதற்கான காரணம் வெளிப்பாடே.',
      ),
      host(
        'Executive Roundtable Moderator',
        'தீர்ப்பு: நுண்ணிய சுன்னா — பேரீச்சம், நோன்பு, உறக்கம், மனஉறுதி — வெளிப்பாடு கற்பித்த ஹிக்மம்; அறிவியல் தொடர்ந்து மீண்டும் கண்டறிகிறது.',
      ),
    ];
  }
  if (lang === 'si') {
    return [
      host(
        'Executive Roundtable Moderator',
        `අස්සලාමු අලයිකුම්. ප්‍රශ්නය: "${q}" දින පලතුරු, උපවාසය, නින්ද සහ මානසික ඔරොත්තු දීම කෙරෙහි අවධානය යොමු කරමු.`,
      ),
      tariq(
        'Agent 02 · Hadith Specialist',
        'සහීහයන් නබිමය ආහාර සහ උපවාස මඟපෙන්වීම ආරක්ෂා කරයි. අපි විවෘත එකතු පමණක් උපුටා දක්වමු; නිර්මාණය කළ වෛද්‍ය දාම එකතු නොකරමු.',
      ),
      farhan(
        'Agent 04 · Fiqh Lead',
        'රමසාන් අනිවාර්යයි; ක්ෂුද්‍ර සුන්නා අදබ් සහ මධ්‍යස්ථතාව තුළ නිර්දේශිතය; වෛද්‍ය අවශ්‍යතාවේදී සහන ඇත.',
      ),
      zainab(
        'Agent 06 · Science Foresight',
        'පෝෂණ සහ අන්තරාල පරිවෘත්ති පර්යේෂණ මෙම පුරුදුවල හික්මාව ආලෝකවත් කරයි; අප ඒවා පිළිපදින්නේ හෙළිදරව්ව නිසාය.',
      ),
      host(
        'Executive Roundtable Moderator',
        'තීන්දුව: ක්ෂුද්‍ර සුන්නා — දින, උපවාසය, නින්ද, ඔරොත්තු දීම — හෙළිදරව්ව ඉගැන්වූ හික්මාවයි; විද්‍යාව නැවත නැවත සොයා ගනී.',
      ),
    ];
  }
  return [
    host(
      'Executive Roundtable Moderator',
      `Assalamu Alaikum. Question: "${q}" We focus on dates, fasting, sleep, and resilience.`,
    ),
    tariq(
      'Agent 02 · Hadith Specialist',
      'Sahihayn preserve prophetic food and fasting guidance. We cite opened collections only and do not invent medical chains.',
    ),
    farhan(
      'Agent 04 · Fiqh Lead',
      'Ramadan is obligatory; micro-sunnahs are recommended within adab and moderation, with medical concessions when needed.',
    ),
    zainab(
      'Agent 06 · Science Foresight',
      'Nutrition and intermittent metabolic research illuminate hikmah in these habits, while revelation remains the reason we practice them.',
    ),
    host(
      'Executive Roundtable Moderator',
      'Verdict: micro-Sunnah wellness—dates, fasting, sleep, and resilience—embodies hikmah that revelation taught and science continues to rediscover.',
    ),
  ];
}

function macroGovernance(lang: Lang, question: string): RoundtableTurn[] {
  const q = userFacingResearchQuestion(question);
  if (lang === 'ta') {
    return [
      host(
        'Executive Roundtable Moderator',
        `அஸ்ஸலாமு அலைக்கும். இன்று: "${q}" பேரின நீதி, உடன்படிக்கைகள், நாகரிக ஆட்சி.`,
      ),
      tariq(
        'Agent 02 · Hadith Specialist',
        'புகாரி 893 ஒவ்வொரு பொறுப்பாளரும் கணக்குக் கூறக் கடமைப்பட்டவர் என்கிறது. சீரா உடன்படிக்கை நடைமுறை வெளிப்பாட்டின் கீழ் இராஜதந்திரத்தைக் காட்டுகிறது.',
      ),
      farhan(
        'Agent 04 · Fiqh Lead',
        'சியாஸா ஷர்‘ிய்யா பொது நலனை ஷரீஅத் வரம்பில் நாடுகிறது: நீதிமன்றங்கள், கட்டுப்பாடான உடன்படிக்கைகள், கொடுங்கோன்மைக்கு வரம்பு.',
      ),
      zainab(
        'Agent 06 · Science Foresight',
        'நிறுவன நம்பிக்கை ஆய்வு நம்பகமான உறுதிமொழிகளையும் நடுநிலை நீதியையும் மீண்டும் கண்டறிகிறது — குர்ஆன் ஏற்கனவே கட்டளையிட்ட ஒழுக்கம்.',
      ),
      host(
        'Executive Roundtable Moderator',
        'தீர்ப்பு: குர்ஆனும் சுன்னாவும் நீதி, ஆலோசனை, உடன்படிக்கைப் பாதுகாப்பு எனும் ஒருங்கிணைந்த நாகரிகச் சட்டகத்தை அமைக்கின்றன.',
      ),
    ];
  }
  if (lang === 'si') {
    return [
      host(
        'Executive Roundtable Moderator',
        `අස්සලාමු අලයිකුම්. අද: "${q}" මහා පරිමාණ යුක්තිය, ගිවිසුම් සහ ශිෂ්ටාචාර පාලනය.`,
      ),
      tariq(
        'Agent 02 · Hadith Specialist',
        'බුහාරි 893 කියයි සෑම භාරකරුවෙක්ම වගකීම් සහිත බව. සීරා ගිවිසුම් භාවිතය හෙළිදරව්ව යටතේ රාජ්‍යතාන්ත්‍රිකත්වය පෙන්වයි.',
      ),
      farhan(
        'Agent 04 · Fiqh Lead',
        'සියාසා ෂර්ඉය්යා මහජන යහපත ෂරීඅා සීමා තුළ අනුගමනය කරයි: යුක්තිසහගත අධිකරණ, බැඳී ගිවිසුම්, ආඥාදායකත්වයට සීමා.',
      ),
      zainab(
        'Agent 06 · Science Foresight',
        'ආයතනික විශ්වාස පර්යේෂණ විශ්වාසනීය කැපවීම් සහ නිෂ්පක්ෂ යුක්තිය නැවත සොයා ගනී — කුර්ආනය දැනටමත් අණ කළ ආචාරධර්ම.',
      ),
      host(
        'Executive Roundtable Moderator',
        'තීන්දුව: කුර්ආනය සහ සුන්නාව යුක්තිය, උපදේශනය සහ ගිවිසුම් රැකීම යන එකතු ශිෂ්ටාචාර රාමුවක් සාදයි.',
      ),
    ];
  }
  return [
    host(
      'Executive Roundtable Moderator',
      `Assalamu Alaikum. Today: "${q}" Macro-justice, treaties, and civilizational governance.`,
    ),
    tariq(
      'Agent 02 · Hadith Specialist',
      'Bukhari 893 teaches every steward is accountable. Seerah treaty practice shows diplomacy under revelation when carefully sourced.',
    ),
    farhan(
      'Agent 04 · Fiqh Lead',
      'Siyasah shar‘iyyah pursues public welfare within Shariah: courts of justice, binding covenants, and limits on tyranny.',
    ),
    zainab(
      'Agent 06 · Science Foresight',
      'Institutional trust research rediscovers credible commitments and impartial justice—ethics the Qur’an already commanded.',
    ),
    host(
      'Executive Roundtable Moderator',
      'Verdict: Qur’an and Sunnah form a coherent civilizational frame of justice, consultation, and covenant-keeping.',
    ),
  ];
}

const BUILDERS: Record<HubCardId, (lang: Lang, question: string) => RoundtableTurn[]> = {
  'twenty-three-year': twentyThreeYear,
  'primordial-universality': primordialUniversality,
  'micro-sunnah-science': microSunnahScience,
  'macro-governance': macroGovernance,
};

/** Preloaded native roundtable for a Modern World hub card — never LLM meta-dialogue. */
export function modernWorldNativeRoundtable(
  benchmarkId: string,
  lang: Lang,
  question: string,
): RoundtableTurn[] | null {
  const builder = BUILDERS[benchmarkId as HubCardId];
  if (!builder) return null;
  return builder(lang, question);
}

/**
 * True when spoken turns narrate QA / cache-isolation meta instead of answering
 * the seeker's question. Bare gold-ring evidence (Muslim 2089, தங்க மோதிரம்,
 * රන් මුදු) on a gold topic is legitimate scholarly dialogue — not meta.
 */
export function looksLikeMetaCacheIsolationDialogue(
  turns: readonly Pick<RoundtableTurn, 'text'>[] | undefined,
): boolean {
  if (!turns?.length) return false;
  const blob = turns.map(t => t.text).join('\n');
  // English: require refusal / prior-job / placeholder framing — not citations alone.
  if (
    /refuse to paste|Sahih Muslim 2089 gold-ring material|gold-jewelry analysis|unrelated prior dossier|previous gold(?:-jewelry|-ring)?|cache(?:d)? gold|question-keyed placeholder|never recycle an unrelated|leftover answer from a prior gold|gold-ring (?:material|citations|toxicology)|QUESTION-BOUND FALLBACK|Retry synthesis when ready\. Until then/i.test(
      blob,
    )
  ) {
    return true;
  }
  // Tamil: prior-job / refuse-to-inject framing only (not ordinary தங்க மோதிரம் rulings).
  if (
    /முந்தைய\s*(?:தங்க|ஆவண|ஆய்வு|டாஸியர்)|(?:ஒட்டா|ஒட்டி|போட|செருக).{0,40}தங்க|தங்க.{0,40}(?:மறுக்க|புறக்கணி)|கேச்|cache\s*isolation|முந்தைய\s*தங்க\s*மோதிர/i.test(
      blob,
    )
  ) {
    return true;
  }
  // Sinhala: prior-job / refuse-to-inject framing only (not ordinary රන් මුදු rulings).
  if (
    /පෙර\s*(?:රන්|ලේඛන|පර්යේෂණ|ඩොසියේ)|(?:එකතු|ඇලවු|අලව).{0,40}රන්|රන්.{0,40}ප්‍රතික්ෂේප|cache\s*isolation/i.test(
      blob,
    )
  ) {
    return true;
  }
  return false;
}
