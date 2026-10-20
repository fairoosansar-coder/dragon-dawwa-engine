/**
 * Dragon Dawwa - Trilingual Localization System
 * Languages:
 *   - 'en': English (UI Controls & Headings in English)
 *   - 'ta': Tamil (தமிழ்) - Descriptions, explanatory tooltips & Hadith translations
 *   - 'si': Sinhala (සිංහල) - Descriptions, explanatory tooltips & Hadith translations
 * 
 * Mandate:
 * Arabic Hadith texts and Quranic recitations remain pristine in canonical Arabic (عربي)
 * with vocalization, while descriptions and commentary reflect the selected language.
 */

export type SupportedLanguage = 'en' | 'ta' | 'si';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇱🇰' },
  { code: 'si', label: 'Sinhala', nativeLabel: 'සිංහල', flag: '🇱🇰' }
];

export interface TranslationDictionary {
  // Navigation & Branding
  brandTagline: string;
  dualTabNotice: string;
  tab1Name: string;
  tab1Sub: string;
  tab2Name: string;
  tab2Sub: string;
  tabWallName: string;
  tabWallSub: string;

  // Search & Forms
  searchTitle: string;
  searchDesc: string;
  matnLabel: string;
  matnPlaceholder: string;
  isnadLabel: string;
  isnadPlaceholder: string;
  runDeepSearch: string;
  runningEngine: string;
  clearInputs: string;
  uploadMedia: string;
  takePhoto: string;
  dictateVoice: string;
  dictatingNow: string;
  recentBenchmarksTitle: string;
  benchmarkSubtitle: string;

  // Public Wall
  publicWallTitle: string;
  publicWallDesc: string;
  publishToWall: string;
  publishedToWall: string;
  searchVisibilityPrivate: string;
  searchVisibilityPublic: string;
  likeAction: string;
  commentAction: string;
  addCommentPlaceholder: string;
  submitComment: string;
  allCommunityPosts: string;
  filterByStatus: string;
  verifiedBadge: string;

  // Agent Breakdowns & Synthesis
  purityScore: string;
  finalVerdict: string;
  takhrijDesc: string;
  isnadDesc: string;
  rijalDesc: string;
  shawahidDesc: string;
  verdictsDesc: string;
  synthesisDesc: string;
  arabicScriptSacred: string;

  // Podcast Studio
  podcastTitle: string;
  podcastDesc: string;
  playBroadcast: string;
  pauseBroadcast: string;
  preloadingNotice: string;
  voicesNotice: string;
  arabicRecitationAudio: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    brandTagline: "Prime Dragon Technologies • Hadith Deep Search & Authentication",
    dualTabNotice: "Dual-Tab Architecture with Community Public Wall",
    tab1Name: "Academic Deep Research Dossier",
    tab1Sub: "Agents 1–6 technical breakdowns & narrator matrix",
    tab2Name: "\"Dragon Dawwa Live Studio\" Roundtable",
    tab2Sub: "Multi-person radio broadcast with eager voice pre-loading",
    tabWallName: "Public Community Wall",
    tabWallSub: "Curated Hadith dossiers, discussions & community peer reviews",

    searchTitle: "Deep Search & Authentication Query",
    searchDesc: "Submit Hadith narration text (Matn) and transmission chain (Isnad) for exhaustive multi-agent verification.",
    matnLabel: "HADITH MATN / NARRATION TEXT",
    matnPlaceholder: "Enter prophetic narration in English, Arabic, or transliteration...",
    isnadLabel: "TRANSMISSION CHAIN (ISNAD / SANAD)",
    isnadPlaceholder: "Narrator 1 -> Narrator 2 -> Companion -> Prophet (ﷺ)...",
    runDeepSearch: "RUN 6-AGENT DEEP RESEARCH ENGINE",
    runningEngine: "VERIFYING ACROSS KUTUB AL-SITTAH...",
    clearInputs: "Clear Inputs",
    uploadMedia: "Upload File / Photo",
    takePhoto: "Take Photo (Camera)",
    dictateVoice: "Voice Dictation",
    dictatingNow: "Listening... speak now",
    recentBenchmarksTitle: "⚡ BENCHMARK DOSSIERS & TEST CORPORA (CLICK TO LOAD):",
    benchmarkSubtitle: "Evaluated across Kutub al-Sittah & classical critic references",

    publicWallTitle: "Scholarly Hadith Public Wall",
    publicWallDesc: "Live feed of community-verified Hadith investigations, authentications, and peer-reviewed debates.",
    publishToWall: "Share to Public Wall",
    publishedToWall: "Shared on Wall",
    searchVisibilityPrivate: "Private Investigation (Personal)",
    searchVisibilityPublic: "Public Wall Publication",
    likeAction: "Affirm / Like",
    commentAction: "Scholarly Comments",
    addCommentPlaceholder: "Add scholarly note or verification insight...",
    submitComment: "Post Comment",
    allCommunityPosts: "All Community Inquiries",
    filterByStatus: "Filter by Authenticity",
    verifiedBadge: "6-Agent Verified",

    purityScore: "Purity Confidence Score",
    finalVerdict: "Canonical Verdict",
    takhrijDesc: "Cross-references Kutub al-Sittah and primary Musnads for exact wording variants.",
    isnadDesc: "Maps the transmission chain topology and verifies link continuity.",
    rijalDesc: "Biographical evaluation of transmitters across classical Jarh wa Ta'dil dictionaries.",
    shawahidDesc: "Screens for hidden defects ('Ilal), irregularities (Shudhudh), and parallel supporting chains.",
    verdictsDesc: "Compiles historic and contemporary scholar gradings into a unified matrix.",
    synthesisDesc: "Final reconciliation combining all scholarly streams under a strict verification gate.",
    arabicScriptSacred: "Original Arabic text and vocalization preserved faithfully.",

    podcastTitle: "Dragon Dawwa Live Radio Broadcast",
    podcastDesc: "6-host scholarly roundtable with instant host-to-host audio transition.",
    playBroadcast: "Play Broadcast",
    pauseBroadcast: "Pause",
    preloadingNotice: "Host 2 audio is eagerly pre-loaded while Host 1 speaks for zero latency.",
    voicesNotice: "6 Distinct Vocal Personas with classical Arabic recitations.",
    arabicRecitationAudio: "Recited in classical Arabic followed by vernacular translation."
  },

  ta: {
    brandTagline: "பிரைம் டிராகன் டெக்னாலஜிஸ் • ஹதீஸ் ஆழ்ந்த ஆய்வு மற்றும் நம்பகத்தன்மை உறுதிப்படுத்தல்",
    dualTabNotice: "இரட்டை-தாவல் கட்டமைப்பு மற்றும் பொதுச் சுவர் சமூகம்",
    tab1Name: "கல்விசார் ஆழ்ந்த ஆய்வு ஆவணம் (Dossier)",
    tab1Sub: "முகவர்கள் 1-6 இன் தொழில்நுட்ப பகுப்பாய்வு மற்றும் அறிவிப்பாளர் கட்டமைப்பு",
    tab2Name: "\"டிராகன் தஃவா லைவ் ஸ்டுடியோ\" வட்டமேசை",
    tab2Sub: "நிகழ்நேர பன்முகக் குரல் வானொலி ஒலிபரப்பு மற்றும் துரித ஆடியோ",
    tabWallName: "பொது சமூகச் சுவர் (Public Wall)",
    tabWallSub: "சரிபார்க்கப்பட்ட ஹதீஸ் ஆய்வுகள், விவாதங்கள் மற்றும் கருத்துப் பரிமாற்றங்கள்",

    searchTitle: "ஹதீஸ் ஆழ்ந்த ஆய்வு தேடல்",
    searchDesc: "ஹதீஸின் உரை (மத்ன்) மற்றும் அறிவிப்பாளர் தொடர் (இஸ்னாத்) ஆகியவற்றை உள்ளிட்டு 6-முகவர் ஆய்வை துவங்குங்கள்.",
    matnLabel: "ஹதீஸ் உரை (மத்ன் / MATN)",
    matnPlaceholder: "நபிமொழியை தமிழ், ஆங்கிலம் அல்லது அசல் அரபியில் உள்ளிடவும்...",
    isnadLabel: "அறிவிப்பாளர் தொடர் (இஸ்னாத் / SANAD)",
    isnadPlaceholder: "அறிவிப்பாளர் 1 -> அறிவிப்பாளர் 2 -> நபித்தோழர் -> நபிகள் நாயகம் (ﷺ)...",
    runDeepSearch: "6-முகவர் ஆழ்ந்த ஆய்வு எஞ்சினை இயக்குக",
    runningEngine: "குதுபுஸ் ஸித்தாஹ் நூல்களில் சரிபார்க்கப்படுகிறது...",
    clearInputs: "உள்ளீடுகளை அழிக்கவும்",
    uploadMedia: "ஆவணம் / படம் பதிவேற்றவும்",
    takePhoto: "கேமரா மூலம் புகைப்படம் எடுக்கவும்",
    dictateVoice: "குரல் வழி பதிவு (Mic)",
    dictatingNow: "கேட்கிறது... இப்போது பேசவும்",
    recentBenchmarksTitle: "⚡ மாதிரி ஆய்வு ஆவணங்கள் (கிளிக் செய்து ஏற்றவும்):",
    benchmarkSubtitle: "முக்கிய ஹதீஸ் நூல்கள் மற்றும் உலாமாக்களின் தீர்ப்புகளின் அடிப்படையில்",

    publicWallTitle: "ஹதீஸ் ஆய்வு பொதுச் சுவர்",
    publicWallDesc: "சமூகத்தில் சரிபார்க்கப்பட்ட ஹதீஸ் முடிவுகள், அறிஞர்களின் கருத்துக்கள் மற்றும் கல்வி விவாதங்கள்.",
    publishToWall: "பொதுச் சுவரில் பகிரவும்",
    publishedToWall: "சுவரில் பகிரப்பட்டது",
    searchVisibilityPrivate: "தனிப்பட்ட தேடல் (ரகசியம்)",
    searchVisibilityPublic: "பொதுச் சுவரில் வெளியிடப்பட்டது",
    likeAction: "உறுதிப்படுத்து / விருப்பம்",
    commentAction: "கல்விசார் கருத்துக்கள்",
    addCommentPlaceholder: "உங்கள் ஆய்வு அல்லது ஆதாரக் கருத்தை எழுதவும்...",
    submitComment: "கருத்தை இடுக",
    allCommunityPosts: "அனைத்து சமூக ஆய்வுகள்",
    filterByStatus: "நம்பகத்தன்மை வாரியாக வடிகட்டவும்",
    verifiedBadge: "6-முகவர்களால் சரிபார்க்கப்பட்டது",

    purityScore: "தூய்மை மற்றும் நம்பகத்தன்மை மதிப்பீடு (Purity Score)",
    finalVerdict: "இறுதி சட்டத்தீர்ப்பு (Verdict)",
    takhrijDesc: "புகாரி, முஸ்லிம் மற்றும் முதன்மை நூல்களில் மூல உரைகளையும் சொல் வேறுபாடுகளையும் பிரித்தெடுத்தல்.",
    isnadDesc: "அறிவிப்பாளர் தொடரின் தொடர்ச்சி (முத்தஸில்) மற்றும் இடைவெளி (முன்கதிஉ) ஆகியவற்றை ஆராய்தல்.",
    rijalDesc: "அறிவிப்பாளர்களின் நினைவாற்றல் மற்றும் நாணயம் (ஜர்ஹ் வ தஃதீல்) பற்றிய வரலாற்றுத் தீர்ப்புகள்.",
    shawahidDesc: "மறைமுகக் குறைகள் ('இலல்), தனித்த விசித்திரங்கள் (ஷாத்) மற்றும் குர்ஆன் உடன்பாட்டைச் சோதித்தல்.",
    verdictsDesc: "இமாம் புகாரி, அல்பானி, இப்னு ஹஜர் போன்ற உலாமாக்களின் ஒப்பீட்டுத் தீர்ப்புகள்.",
    synthesisDesc: "அனைத்து 5 முகவர்களின் முடிவுகளையும் ஒருங்கிணைத்து இறுதிப் புள்ளிவிவரத் தீர்ப்பு வழங்குதல்.",
    arabicScriptSacred: "அரபு ஹதீஸ் மற்றும் குர்ஆன் வசனங்கள் அவற்றின் மூல அரபு வடிவிலும் சரியான உச்சரிப்பிலும் பாதுகாக்கப்படுகின்றன.",

    podcastTitle: "டிராகன் தஃவா லைவ் வானொலி ஒலிபரப்பு",
    podcastDesc: "6 அறிவிப்பாளர்களின் ஆய்வரங்கம் - தொடர்ச்சியான தாமதமற்ற ஒலிப் பரிமாற்றம்.",
    playBroadcast: "ஒலிபரப்பை இயக்கு",
    pauseBroadcast: "இடைநிறுத்து",
    preloadingNotice: "தொகுப்பாளர் 1 பேசும்போதே தொகுப்பாளர் 2 இன் குரல் தயார் செய்யப்படுகிறது.",
    voicesNotice: "6 தனித்துவமான குரல்கள் மற்றும் அசல் அரபு கிராஅத் ஓதுதல்.",
    arabicRecitationAudio: "மூல அரபியில் ஓதப்பட்டு பின்னர் விளக்கம் அளிக்கப்படுகிறது."
  },

  si: {
    brandTagline: "ප්‍රයිම් ඩ්‍රැගන් ටෙක්නොලොජීස් • හදීස් ගැඹුරු පර්යේෂණ සහ සත්‍යාපන එන්ජිම",
    dualTabNotice: "ද්විත්ව-ටැබ් ගෘහ නිර්මාණ ශිල්පය සහ පොදු ප්‍රජා පවුර",
    tab1Name: "ශාස්ත්‍රීය ගැඹුරු පර්යේෂණ ලේඛනය (Dossier)",
    tab1Sub: "නියෝජිතයන් 1-6 තාක්ෂණික විශ්ලේෂණය සහ නිවේදක න්‍යාසය",
    tab2Name: "\"ඩ්‍රැගන් දඃවා ලයිව් ස්ටුඩියෝ\" වටමේස සාකච්ඡාව",
    tab2Sub: "ක්ෂණික හඬ පෙර-පැටවීම සහිත බහු-පුද්ගල ගුවන්විදුලි විකාශනය",
    tabWallName: "පොදු ප්‍රජා පවුර (Public Wall)",
    tabWallSub: "සත්‍යාපනය කළ හදීස් වාර්තා, විමර්ශන සහ සාකච්ඡා සංග්‍රහය",

    searchTitle: "හදීස් ගැඹුරු පර්යේෂණ විමසුම",
    searchDesc: "සම්පූර්ණ බහු-නියෝජිත සත්‍යාපනය සඳහා හදීස් පාඨය (මත්න්) සහ සම්ප්‍රේෂණ දාමය (ඉස්නාද්) ඇතුළත් කරන්න.",
    matnLabel: "හදීස් පාඨය (මත්න් / MATN)",
    matnPlaceholder: "නබි වදන සිංහල, ඉංග්‍රීසි හෝ අරාබි අකුරින් ඇතුළත් කරන්න...",
    isnadLabel: "සම්ප්‍රේෂණ දාමය (ඉස්නාද් / SANAD)",
    isnadPlaceholder: "නිවේදක 1 -> නිවේදක 2 -> සහාබිවරයා -> නබි නායක (ﷺ)...",
    runDeepSearch: "6-නියෝජිත ගැඹුරු පර්යේෂණ එන්ජිම ක්‍රියාත්මක කරන්න",
    runningEngine: "කුතුබ් අල්-සිත්තාහ් ග්‍රන්ථ ඔස්සේ සත්‍යාපනය කරමින් පවතී...",
    clearInputs: "ආදාන මකන්න (Clear)",
    uploadMedia: "ගොනුව / ඡායාරූපය උඩුගත කරන්න",
    takePhoto: "කැමරාවෙන් ඡායාරූපයක් ගන්න",
    dictateVoice: "කටහඬින් ඇතුළත් කරන්න (Mic)",
    dictatingNow: "සවන් දෙමින් පවතී... දැන් කතා කරන්න",
    recentBenchmarksTitle: "⚡ පර්යේෂණ මිණුම් සලකුණු (පූරණය කිරීමට ක්ලික් කරන්න):",
    benchmarkSubtitle: "ප්‍රධාන හදීස් ග්‍රන්ථ සහ සම්භාව්‍ය විද්වත් තීන්දු මත පදනම්ව",

    publicWallTitle: "හදීස් පර්යේෂණ පොදු පවුර",
    publicWallDesc: "ප්‍රජාව විසින් සත්‍යාපනය කළ හදීස් විමර්ශන සහ විද්වත් සාකච්ඡා සජීවී ප්‍රවාහය.",
    publishToWall: "පොදු පවුරට එක් කරන්න",
    publishedToWall: "පොදු පවුරේ පළ කරන ලදී",
    searchVisibilityPrivate: "පෞද්ගලික පර්යේෂණය (Personal)",
    searchVisibilityPublic: "පොදු පවුරේ ප්‍රකාශනය (Public)",
    likeAction: "තහවුරු කිරීම / කැමැත්ත (Like)",
    commentAction: "විද්වත් අදහස් (Comments)",
    addCommentPlaceholder: "ඔබේ ශාස්ත්‍රීය හෝ සත්‍යාපන අදහස එක් කරන්න...",
    submitComment: "අදහස පළ කරන්න",
    allCommunityPosts: "සියලුම ප්‍රජා විමසුම්",
    filterByStatus: "සත්‍යතාව අනුව පෙරන්න",
    verifiedBadge: "6-නියෝජිත සත්‍යාපිත",

    purityScore: "පාරිශුද්ධතා සහ විශ්වසනීයතා ලකුණු (Purity Score)",
    finalVerdict: "අවසන් ශාස්ත්‍රීය තීන්දුව (Verdict)",
    takhrijDesc: "මූලික ග්‍රන්ථ හරහා නිවැරදි වචන වෙනස්කම් සහ මූලාශ්‍ර හඳුනාගැනීම.",
    isnadDesc: "සම්ප්‍රේෂණ දාමයේ අඛණ්ඩතාව සහ ගුරු-ගෝල සම්බන්ධතා සත්‍යාපනය.",
    rijalDesc: "ජර්හ් ව තඃදීල් ශබ්දකෝෂ හරහා නිවේදකයන්ගේ චරිතය සහ මතක ශක්තිය ඇගයීම.",
    shawahidDesc: "සැඟවුණු දෝෂ ('ඉලල්), අසාමාන්‍යතා (ෂාද්) සහ කුර්ආන් අනුකූලතාව පරීක්ෂා කිරීම.",
    verdictsDesc: "ඉතිහාසගත සහ සමකාලීන ඉස්ලාමීය විද්වතුන්ගේ තීන්දු සංසන්දනය කිරීම.",
    synthesisDesc: "සියලුම අංශ ඒකාබද්ධ කර අවසන් සංඛ්‍යානමය සහ ශාස්ත්‍රීය නිගමනය ලබා දීම.",
    arabicScriptSacred: "අරාබි හදීස් සහ කුර්ආන් වැකි ඒවායේ මූලික අරාබි අක්ෂර සහ නිවැරදි උච්චාරණයෙන් සුරක්ෂිතව පවතී.",

    podcastTitle: "ඩ්‍රැගන් දඃවා සජීවී ගුවන්විදුලි විකාශනය",
    podcastDesc: "ප්‍රමාදයකින් තොරව හඬ මාරුවන 6-දෙනෙකුගේ විද්වත් වටමේස සාකච්ඡාව.",
    playBroadcast: "විකාශනය අරඹන්න",
    pauseBroadcast: "විකාශනය නවත්වන්න",
    preloadingNotice: "පළමු නිවේදකයා කතා කරන අතරතුර දෙවන නිවේදකයාගේ හඬ ක්ෂණිකව සූදානම් වේ.",
    voicesNotice: "විශේෂිත හඬවල් 6ක් සහ සම්භාව්‍ය අරාබි පාරායනය.",
    arabicRecitationAudio: "මූලික අරාබි භාෂාවෙන් පාරායනය කර පසුව විස්තර කෙරේ."
  }
};
