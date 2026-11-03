// Canonical Quran data fetched through the Quran.ai connector (mcp.quran.ai, sourced from quran.com) on 2026-10-10.
// Nothing in this file is written from memory: every string below is copied from a Quran.ai tool result.
//   fetch_quran(1:1-7, 112:1-4, ar-uthmani-hafs) — used to verify the bundled Uthmani text (word-for-word match with the reader page)
//   fetch_translation(1:1-7, 112:1-4, 2:255, 94:6; en-sahih-international, en-abdel-haleem, en-taqi-usmani, en-al-hilali-khan, en-yusufali, en-pickthall)
//   fetch_tafsir(1:1-7; ar-muyassar, en-tazkirul-quran)
//   fetch_word_morphology(1:1 … 1:7)
// In the live product these are requested from Quran.ai on demand; this file is the offline set for the design previews.

export interface GroundedEdition { id: string; qcId: number; name: string; by: string; lang: 'en' | 'ar' }
export const QURAN_AI_TRANSLATIONS: GroundedEdition[] = [
  { id: 'en-sahih-international', qcId: 20, name: 'Saheeh International', by: 'Sahih International', lang: 'en' },
  { id: 'en-abdel-haleem', qcId: 85, name: 'The Qur’an', by: 'M. A. S. Abdel Haleem', lang: 'en' },
  { id: 'en-taqi-usmani', qcId: 84, name: 'The Noble Qur’an', by: 'Muhammad Taqi Usmani', lang: 'en' },
  { id: 'en-al-hilali-khan', qcId: 203, name: 'The Noble Qur’an', by: 'al-Hilali & Muhsin Khan', lang: 'en' },
  { id: 'en-yusufali', qcId: 22, name: 'The Holy Qur’an', by: 'Abdullah Yusuf Ali', lang: 'en' },
  { id: 'en-pickthall', qcId: 19, name: 'The Meaning of the Glorious Koran', by: 'Marmaduke Pickthall', lang: 'en' },
];
export const trCitation = (qcId: number, k: string) => `https://quran.com/${k}?translations=${qcId}`;

export const GROUNDED_TR: Record<string, Record<string, string>> = {
  'en-sahih-international': {
    '1:1': 'In the name of Allāh, the Entirely Merciful, the Especially Merciful.',
    '1:2': '[All] praise is [due] to Allāh, Lord of the worlds -',
    '1:3': 'The Entirely Merciful, the Especially Merciful,',
    '1:4': 'Sovereign of the Day of Recompense.',
    '1:5': 'It is You we worship and You we ask for help.',
    '1:6': 'Guide us to the straight path -',
    '1:7': 'The path of those upon whom You have bestowed favor, not of those who have earned [Your] anger or of those who are astray.',
    '112:1': 'Say, "He is Allāh, [who is] One,',
    '112:2': 'Allāh, the Eternal Refuge.',
    '112:3': 'He neither begets nor is born,',
    '112:4': 'Nor is there to Him any equivalent."',
    '2:255': 'Allāh - there is no deity except Him, the Ever-Living, the Self-Sustaining. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursī extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.',
    '94:6': 'Indeed, with hardship [will be] ease.',
  },
  'en-abdel-haleem': {
    '1:1': 'In the name of God, the Lord of Mercy, the Giver of Mercy!',
    '1:2': 'Praise belongs to God, Lord of the Worlds,',
    '1:3': 'the Lord of Mercy, the Giver of Mercy,',
    '1:4': 'Master of the Day of Judgement.',
    '1:5': 'It is You we worship; it is You we ask for help.',
    '1:6': 'Guide us to the straight path:',
    '1:7': 'the path of those You have blessed, those who incur no anger and who have not gone astray.',
    '112:1': 'Say, ‘He is God the One,',
    '112:2': 'God the eternal.',
    '112:3': 'He begot no one nor was He begotten.',
    '112:4': 'No one is comparable to Him.’',
  },
  'en-taqi-usmani': {
    '1:1': 'With the name of Allah, the All-Merciful, the Very-Merciful.',
    '1:2': 'Praise belongs to Allah, the Lord of all the worlds.',
    '1:3': 'the All-Merciful, the Very Merciful.',
    '1:4': 'the Master of the Day of Requital.',
    '1:5': 'You alone do we worship, and from You alone do we seek help.',
    '1:6': 'Take us on the straight path.',
    '1:7': 'the path of those on whom You have bestowed Your Grace, not of those who have incurred Your wrath, nor of those who have gone astray.',
    '112:1': 'Say, “The truth is that Allah is One.',
    '112:2': 'Allah is Besought of all, needing none.',
    '112:3': 'He neither begot anyone, nor was he begotten.',
    '112:4': 'And equal to Him has never been any one.”',
  },
  'en-al-hilali-khan': {
    '1:1': 'In the Name of Allâh, the Most Gracious, the Most Merciful',
    '1:2': 'All the praises and thanks be to Allâh, the Lord of the ‘Âlamîn (mankind, jinn and all that exists).',
    '1:3': 'The Most Gracious, the Most Merciful.',
    '1:4': 'The Only Owner (and the Only Ruling Judge) of the Day of Recompense (i.e. the Day of Resurrection)',
    '1:5': 'You (Alone) we worship, and You (Alone) we ask for help (for each and everything).',
    '1:6': 'Guide us to the Straight Way.',
    '1:7': 'The Way of those on whom You have bestowed Your Grace , not (the way) of those who earned Your Anger  (i.e. those who knew the Truth, but did not follow it) nor of those who went astray (i.e. those who did not follow the Truth out of ignorance and error).',
    '112:1': 'Say (O Muhammad صلى الله عليه وسلم): "He is Allâh, (the) One.',
    '112:2': '"Allâh-us-Samad (السيد الذي يصمد إليه في الحاجات) [Allâh the Self-Sufficient Master, Whom all creatures need, (He neither eats nor drinks)].',
    '112:3': '"He begets not, nor was He begotten.',
    '112:4': '"And there is none co-equal or comparable unto Him."',
  },
  'en-yusufali': {
    '1:1': 'In the name of Allah, Most Gracious, Most Merciful.',
    '1:2': 'Praise be to Allah, the Cherisher and Sustainer of the worlds;',
    '1:3': 'Most Gracious, Most Merciful;',
    '1:4': 'Master of the Day of Judgment.',
    '1:5': 'Thee do we worship, and Thine aid we seek.',
    '1:6': 'Show us the straight way,',
    '1:7': 'The way of those on whom Thou hast bestowed Thy Grace, those whose (portion) is not wrath, and who go not astray.',
    '112:1': 'Say: He is Allah, the One and Only;',
    '112:2': 'Allah, the Eternal, Absolute;',
    '112:3': 'He begetteth not, nor is He begotten;',
    '112:4': 'And there is none like unto Him.',
  },
  'en-pickthall': {
    '1:1': 'In the name of Allah, the Beneficent, the Merciful.',
    '1:2': 'Praise be to Allah, Lord of the Worlds,',
    '1:3': 'The Beneficent, the Merciful.',
    '1:4': 'Master of the Day of Judgment,',
    '1:5': 'Thee (alone) we worship; Thee (alone) we ask for help.',
    '1:6': 'Show us the straight path,',
    '1:7': 'The path of those whom Thou hast favoured; Not the (path) of those who earn Thine anger nor of those who go astray.',
    '112:1': 'Say: He is Allah, the One!',
    '112:2': 'Allah, the eternally Besought of all!',
    '112:3': 'He begetteth not nor was begotten.',
    '112:4': 'And there is none comparable unto Him.',
  },
};

/* ---------- tafsir ---------- */
export interface TafsirEdition { id: string; qcId?: number; name: string; by: string; lang: 'ar' | 'en'; note: string }
export const QURAN_AI_TAFSIR: TafsirEdition[] = [
  { id: 'ar-muyassar', qcId: 16, name: 'التفسير الميسر', by: 'King Fahd Complex (al-Muyassar)', lang: 'ar', note: 'Brief, mainstream' },
  { id: 'en-tazkirul-quran', qcId: 817, name: 'Tazkirul Quran', by: 'Wahiduddin Khan', lang: 'en', note: 'Reflective, English' },
  { id: 'en-ibn-kathir', name: 'Tafsir Ibn Kathir (Abridged)', by: 'Isma‘il ibn Kathir', lang: 'en', note: 'Hadith-based, English' },
  { id: 'ar-saadi', name: 'تيسير الكريم الرحمن', by: '‘Abd al-Rahman al-Sa‘di', lang: 'ar', note: 'Practical lessons' },
];
export const tafsirCitation = (qcId: number, k: string) => `https://quran.com/${k}/tafsirs/${qcId}`;
/* each entry covers a range: [first ayah key, last ayah key, text] */
export const GROUNDED_TAFSIR: Record<string, Array<[string, string, string]>> = {
  'ar-muyassar': [
    ['1:1', '1:1', 'أبتدئ قراءة القرآن باسم الله مستعينا به، (اللهِ) علم على الرب -تبارك وتعالى- المعبود بحق دون سواه، وهو أخص أسماء الله تعالى، ولا يسمى به غيره سبحانه. (الرَّحْمَنِ) ذي الرحمة العامة الذي وسعت رحمته جميع الخلق، (الرَّحِيمِ) بالمؤمنين، وهما اسمان من أسمائه تعالى، يتضمنان إثبات صفة الرحمة لله تعالى كما يليق بجلاله.'],
    ['1:2', '1:2', 'الثناء على الله بصفاته التي كلُّها أوصاف كمال، وبنعمه الظاهرة والباطنة، الدينية والدنيوية، وفي ضمنه أَمْرٌ لعباده أن يحمدوه، فهو المستحق له وحده، وهو سبحانه المنشئ للخلق، القائم بأمورهم، المربي لجميع خلقه بنعمه، ولأوليائه بالإيمان والعمل الصالح.'],
    ['1:3', '1:3', '(الرَّحْمَنِ) ذي الرحمة العامة الذي وسعت رحمته جميع الخلق، (الرَّحِيمِ) ، بالمؤمنين، وهما اسمان من أسماء الله تعالى.'],
    ['1:4', '1:4', 'وهو سبحانه وحده مالك يوم القيامة، وهو يوم الجزاء على الأعمال. وفي قراءة المسلم لهذه الآية في كل ركعة من صلواته تذكير له باليوم الآخر، وحثٌّ له على الاستعداد بالعمل الصالح، والكف عن المعاصي والسيئات.'],
    ['1:5', '1:5', 'إنا نخصك وحدك بالعبادة، ونستعين بك وحدك في جميع أمورنا، فالأمر كله بيدك، لا يملك منه أحد مثقال ذرة. وفي هذه الآية دليل على أن العبد لا يجوز له أن يصرف شيئًا من أنواع العبادة كالدعاء والاستغاثة والذبح والطواف إلا لله وحده، وفيها شفاء القلوب من داء التعلق بغير الله، ومن أمراض الرياء والعجب، والكبرياء.'],
    ['1:6', '1:6', 'دُلَّنا، وأرشدنا، ووفقنا إلى الطريق المستقيم، وثبتنا عليه حتى نلقاك، وهو الإسلام، الذي هو الطريق الواضح الموصل إلى رضوان الله وإلى جنته، الذي دلّ عليه خاتم رسله وأنبيائه محمد صلى الله عليه وسلم، فلا سبيل إلى سعادة العبد إلا بالاستقامة عليه.'],
    ['1:7', '1:7', 'طريق الذين أنعمت عليهم من النبيين والصدِّيقين والشهداء والصالحين، فهم أهل الهداية والاستقامة، ولا تجعلنا ممن سلك طريق المغضوب عليهم، الذين عرفوا الحق ولم يعملوا به، وهم اليهود، ومن كان على شاكلتهم، والضالين، وهم الذين لم يهتدوا عن جهل منهم، فضلوا الطريق، وهم النصارى، ومن اتبع سنتهم. وفي هذا الدعاء شفاء لقلب المسلم من مرض الجحود والجهل والضلال، ودلالة على أن أعظم نعمة على الإطلاق هي نعمة الإسلام، فمن كان أعرف للحق وأتبع له، كان أولى بالصراط المستقيم، ولا ريب أن أصحاب رسول الله صلى الله عليه وسلم هم أولى الناس بذلك بعد الأنبياء عليهم السلام، فدلت الآية على فضلهم، وعظيم منزلتهم، رضي الله عنهم.'],
  ],
  'en-tazkirul-quran': [
    ['1:1', '1:1', 'The best way to begin any task is in the name of God, the Lord, the Being who is the source of all blessings, and whose blessings and mercy are continually pouring upon His creation. To commence any undertaking in His name is to pray that God, in His infinite mercy, should come to one’s assistance and bring one’s work to a successful conclusion. This is man’s acknowledgement of the fact that he is God’s servant, and also brings divine assurance of success.'],
    ['1:2', '1:7', 'The Quran has a special and characteristic way of expressing a believer’s inner sentiments in the most appropriate words. The invocation of God in the opening chapter of the Quran, constitute a supplication of this nature. The feelings which are naturally aroused in one after discovering the truth are expressed in these lines. When man looks at the world around him, he cannot fail to notice God’s power and mercy abundantly in evidence everywhere. Wherever he casts his glance, he finds extraordinary order and supervision.\n\nEverything has been extraordinarily and astonishingly adapted to man’s needs. This observation shows that the great cosmic machine cannot be in vain. Therefore, one realizes that there must come a day when the grateful and the ungrateful are rewarded for the way they have lived their lives in this world. One spontaneously entreats God in words to this effect, ‘Lord, You are the Master of the Day of Judgement. I have submitted to You and humbly seek Your help; have mercy on me. Lord, show us the path that is, to You, the true path. Enable us to tread the path of Your chosen servants. Help us to avoid the path of those who have gone astray, and the path of those who have incurred Your wrath due to their obstinacy.’ God requires His servant to live his life with such feelings and emotions.\n\nThe opening chapter of the Quran is a miniature portrayal of Islamic belief; the rest of the Quran is an enlargement of this picture.'],
  ],
};
const cmpKey = (k: string) => { const [s, a] = k.split(':').map(Number); return s * 1000 + a; };
export const groundedTafsir = (edition: string, k: string) => {
  const e = GROUNDED_TAFSIR[edition]; if (!e) return undefined;
  const hit = e.find(([a, b]) => cmpKey(a) <= cmpKey(k) && cmpKey(k) <= cmpKey(b));
  return hit ? { from: hit[0], to: hit[1], text: hit[2] } : undefined;
};

/* ---------- word-by-word morphology ----------
   [transliteration, gloss, root letters | '', root count (words) | 0, root ayat | 0, lemma, lemma count, segments as [text, part], grammar note] */
export type WordSeg = [string, string];
export type GroundedWord = [string, string, string, number, number, string, number, WordSeg[], string];
export const GROUNDED_WORDS: Record<string, GroundedWord[]> = {
  '1:1': [
    ['bis\'mi', 'In (the) name', 'سمو', 381, 352, 'اسْم', 39, [['بِ', 'preposition'], ['سْمِ', 'noun']], 'A preposition and noun. The prefixed preposition bi is usually translated as "with" or "by". The noun is masculine and is in the genitive case (مجرور). Together the segments form a preposition phrase known as jār wa majrūr (جار ومجرور).'],
    ['l-lahi', '(of) Allah', 'اله', 2851, 1879, 'اللَّه', 2699, [['ٱللَّهِ', 'proper noun']], 'A proper noun in the genitive case (مجرور).'],
    ['l-raḥmāni', 'the Most Gracious', 'رحم', 339, 313, 'رَّحْمَٰن', 57, [['ٱل', 'determiner'], ['رَّحْمَٰنِ', 'adjective']], 'A masculine singular adjective in the genitive case (مجرور).'],
    ['l-raḥīmi', 'the Most Merciful', 'رحم', 339, 313, 'رَّحِيم', 116, [['ٱل', 'determiner'], ['رَّحِيمِ', 'adjective']], 'A masculine singular adjective in the genitive case (مجرور).'],
  ],
  '1:2': [
    ['al-ḥamdu', 'All praises and thanks', 'حمد', 63, 61, 'حَمْد', 43, [['ٱلْ', 'determiner'], ['حَمْدُ', 'noun']], 'A masculine noun in the nominative case (مرفوع).'],
    ['lillahi', '(be) to Allah', 'اله', 2851, 1879, 'اللَّه', 2699, [['لِ', 'preposition'], ['لَّهِ', 'proper noun']], 'A preposition and proper noun. The prefixed preposition lām is usually translated as "for". Together the segments form a preposition phrase known as jār wa majrūr (جار ومجرور).'],
    ['rabbi', 'the Lord', 'ربب', 980, 871, 'رَبّ', 975, [['رَبِّ', 'noun']], 'A masculine noun in the genitive case (مجرور).'],
    ['l-ʿālamīna', 'of the universe', 'علم', 854, 728, 'عَٰلَمِين', 73, [['ٱلْ', 'determiner'], ['عَٰلَمِينَ', 'noun']], 'A masculine plural noun in the genitive case (مجرور).'],
  ],
  '1:3': [
    ['al-raḥmāni', 'The Most Gracious', 'رحم', 339, 313, 'رَّحْمَٰن', 57, [['ٱل', 'determiner'], ['رَّحْمَٰنِ', 'adjective']], 'A masculine singular adjective in the genitive case (مجرور).'],
    ['l-raḥīmi', 'the Most Merciful', 'رحم', 339, 313, 'رَّحِيم', 116, [['ٱل', 'determiner'], ['رَّحِيمِ', 'adjective']], 'A masculine singular adjective in the genitive case (مجرور).'],
  ],
  '1:4': [
    ['māliki', '(The) Master', 'ملك', 206, 191, 'مَٰلِك', 4, [['مَٰلِكِ', 'active participle']], 'A masculine active participle in the genitive case (مجرور).'],
    ['yawmi', '(of the) Day', 'يوم', 405, 377, 'يَوْم', 405, [['يَوْمِ', 'noun']], 'A masculine noun in the genitive case (مجرور).'],
    ['l-dīni', '(of the) Judgment', 'دين', 101, 87, 'دِين', 92, [['ٱل', 'determiner'], ['دِّينِ', 'noun']], 'A masculine noun in the genitive case (مجرور).'],
  ],
  '1:5': [
    ['iyyāka', 'You Alone', '', 0, 0, 'إِيَّا', 24, [['إِيَّاكَ', 'personal pronoun']], 'A second person masculine singular personal pronoun.'],
    ['naʿbudu', 'we worship', 'عبد', 275, 251, 'عَبَدَ', 122, [['نَعْبُدُ', 'verb']], 'An imperfect verb (فعل مضارع), first person plural, in the indicative mood (مرفوع).'],
    ['wa-iyyāka', 'and You Alone', '', 0, 0, 'إِيَّا', 24, [['وَ', 'conjunction'], ['إِيَّاكَ', 'personal pronoun']], 'A conjunction and personal pronoun. The prefixed conjunction wa is usually translated as "and".'],
    ['nastaʿīnu', 'we ask for help', 'عون', 11, 10, 'اسْتَعِينُ', 4, [['نَسْتَعِينُ', 'verb']], 'A form X imperfect verb (فعل مضارع), first person plural, in the indicative mood (مرفوع).'],
  ],
  '1:6': [
    ['ih\'dinā', 'Guide us', 'هدي', 316, 268, 'هَدَى', 144, [['ٱهْدِ', 'verb'], ['نَا', 'object pronoun']], 'A verb and object pronoun. The imperative verb (فعل أمر) is second person masculine singular. The attached object pronoun is first person plural.'],
    ['l-ṣirāṭa', '(to) the path', 'صرط', 45, 45, 'صِرَٰط', 45, [['ٱل', 'determiner'], ['صِّرَٰطَ', 'noun']], 'A masculine noun in the accusative case (منصوب).'],
    ['l-mus\'taqīma', 'the straight', 'قوم', 660, 597, 'مُّسْتَقِيم', 37, [['ٱلْ', 'determiner'], ['مُسْتَقِيمَ', 'active participle']], 'A form X masculine active participle in the accusative case (منصوب).'],
  ],
  '1:7': [
    ['ṣirāṭa', '(The) path', 'صرط', 45, 45, 'صِرَٰط', 45, [['صِرَٰطَ', 'noun']], 'A masculine noun in the accusative case (منصوب).'],
    ['alladhīna', '(of) those', '', 0, 0, 'الَّذِى', 1464, [['ٱلَّذِينَ', 'relative pronoun']], 'A masculine plural relative pronoun.'],
    ['anʿamta', 'You have bestowed (Your) Favors', 'نعم', 140, 128, 'أَنْعَمَ', 17, [['أَنْعَمْ', 'verb'], ['تَ', 'subject pronoun']], 'A verb and subject pronoun. The form IV perfect verb (فعل ماض) is second person masculine singular. The suffix (التاء) is an attached subject pronoun.'],
    ['ʿalayhim', 'on them', '', 0, 0, 'عَلَىٰ', 1445, [['عَلَيْ', 'preposition'], ['هِمْ', 'object pronoun']], 'A preposition and object pronoun (third person masculine plural). Together the segments form a preposition phrase known as jār wa majrūr (جار ومجرور).'],
    ['ghayri', 'not (of)', 'غير', 154, 146, 'غَيْر', 147, [['غَيْرِ', 'noun']], 'A masculine noun in the genitive case (مجرور).'],
    ['l-maghḍūbi', 'those who earned (Your) wrath', 'غضب', 24, 21, 'مَغْضُوب', 1, [['ٱلْ', 'determiner'], ['مَغْضُوبِ', 'passive participle']], 'A masculine passive participle in the genitive case (مجرور).'],
    ['ʿalayhim', 'on themselves', '', 0, 0, 'عَلَىٰ', 1445, [['عَلَيْ', 'preposition'], ['هِمْ', 'object pronoun']], 'A preposition and object pronoun (third person masculine plural). Together the segments form a preposition phrase known as jār wa majrūr (جار ومجرور).'],
    ['walā', 'and not', '', 0, 0, 'لَا', 1738, [['وَ', 'conjunction'], ['لَا', 'negative particle']], 'A conjunction and negative particle. The prefixed conjunction wa is usually translated as "and".'],
    ['l-ḍālīna', '(of) those who go astray', 'ضلل', 191, 170, 'ضَآلّ', 14, [['ٱل', 'determiner'], ['ضَّآلِّينَ', 'active participle']], 'A masculine plural active participle in the genitive case (مجرور).'],
  ],
};
export const spacedRoot = (r: string) => r.split('').join(' ');
export const GROUNDED_SOURCE = 'Quran.ai · quran.com';
