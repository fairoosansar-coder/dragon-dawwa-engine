import type { SampleHadithPreset } from '../types/hadith.ts';

export const SAMPLE_HADITHS: SampleHadithPreset[] = [
  {
    id: 'saturday-fasting',
    title: 'Prohibition of Fasting on Saturdays (Disputed / Shadh)',
    category: 'Fiqh & Contested Chains',
    hadith_text: 'Do not fast on Saturdays except for what has been made obligatory for you; and if one of you finds nothing but a grape skin or a twig of a tree, let him chew it.',
    isnad_text: "Qutaybah -> Yahya ibn Hamza -> Thawran ibn Yazid -> Khalid ibn Ma'dan -> 'Abdullah ibn Busr -> His sister (Al-Samma')",
    defaultData: {
      app_name: 'Dragon Dawwa',
      version: '2.5 Enterprise Engine',
      platform_owner: 'Prime Dragon Technologies (Pvt) Ltd',
      designed_and_created_by: 'Aegis Intelligence Pvt Ltd, Sri Lanka',
      query_hadith: 'Do not fast on Saturdays except for what has been made obligatory for you; and if one of you finds nothing but a grape skin or a twig of a tree, let him chew it.',
      agent_1_takhrij: {
        sources: [
          {
            collection: 'Sunan Abu Dawud',
            hadith_number: '2421',
            exact_wording: 'لا تصوموا يوم السبت إلا فيما افترض عليكم ، فإن لم يجد أحدكم إلا لحاء عنبة أو عود شجرة فليمضغه',
            wording_differences: 'Standard narration mentioning the grape peel (liha\' \'inabah) and twig.'
          },
          {
            collection: 'Jami\' at-Tirmidhi',
            hadith_number: '744',
            exact_wording: 'لا تصوموا يوم السبت إلا فيما افترض عليكم',
            wording_differences: 'Concise version without the addition of the grape twig.'
          },
          {
            collection: 'Sunan Ibn Majah',
            hadith_number: '1726',
            exact_wording: 'لا تصوموا يوم السبت إلا فيما افترض عليكم',
            wording_differences: 'Recorded under Kitab al-Siyam, Bab Siyam Yawm al-Sabt.'
          },
          {
            collection: "Sunan an-Nasa'i (Al-Kubra)",
            hadith_number: '2761',
            exact_wording: 'من لم يجد منكم إلا لحاء شجرة فليفطر عليه ولا يصم يوم السبت',
            wording_differences: 'Variation placing the tree peel clause first.'
          },
          {
            collection: 'Musnad Ahmad',
            hadith_number: '17684',
            exact_wording: 'عن عبد الله بن بسر عن أخته الصماء أن رسول الله صلى الله عليه وسلم قال...',
            wording_differences: 'Full chain transmitted via Levantines (Shamiyyun).'
          }
        ],
        variants_summary: 'Reported through multiple lines from Abdullah ibn Busr, sometimes from his sister Al-Samma\' bint Busr, sometimes from his father Busr, and sometimes directly from the Prophet without naming his sister. These variations (Idtirab) are central to the critical scrutiny by Imams Malik, Al-Zuhri, and Abu Dawud.'
      },
      agent_2_isnad: {
        narrator_sequence: [
          'The Prophet Muhammad (ﷺ)',
          'Al-Samma\' bint Busr (Companion)',
          'Abdullah ibn Busr (Companion / Brother)',
          'Khalid ibn Ma\'dan (Kibar al-Tabi\'in)',
          'Thawran ibn Yazid al-Kila\'i',
          'Yahya ibn Hamza al-Hadrami',
          'Qutaybah ibn Sa\'id'
        ],
        chain_links: [
          {
            teacher: 'The Prophet Muhammad (ﷺ)',
            student: 'Al-Samma\' bint Busr',
            transmission_mode: 'Sami\'at (Explicit Hearing)',
            connection_status: 'Connected (Muttasil)',
            historical_reasoning: 'Al-Samma\' bint Busr is an established female Companion who pledged allegiance to the Messenger of Allah.'
          },
          {
            teacher: 'Al-Samma\' bint Busr',
            student: 'Abdullah ibn Busr',
            transmission_mode: '\'An (From his sister)',
            connection_status: 'Connected (Muttasil)',
            historical_reasoning: 'Direct siblings residing together in Hims; continuous familial proximity verified.'
          },
          {
            teacher: 'Abdullah ibn Busr',
            student: 'Khalid ibn Ma\'dan',
            transmission_mode: 'Haddathana (Explicit Hearing)',
            connection_status: 'Connected (Muttasil)',
            historical_reasoning: 'Khalid ibn Ma\'dan was a chief Syrian scholar who narrated extensively and directly from Abdullah ibn Busr.'
          },
          {
            teacher: 'Khalid ibn Ma\'dan',
            student: 'Thawran ibn Yazid al-Kila\'i',
            transmission_mode: 'Haddathana / \'An',
            connection_status: 'Connected (Muttasil)',
            historical_reasoning: 'Thawran was Khalid\'s foremost student in Hims; meetings documented in Tahdhib al-Kamal.'
          },
          {
            teacher: 'Thawran ibn Yazid al-Kila\'i',
            student: 'Yahya ibn Hamza al-Hadrami',
            transmission_mode: 'Haddathana (Explicit Hearing)',
            connection_status: 'Connected (Muttasil)',
            historical_reasoning: 'Yahya served as Qadi of Damascus and received the Hadith book of Thawran directly.'
          },
          {
            teacher: 'Yahya ibn Hamza al-Hadrami',
            student: 'Qutaybah ibn Sa\'id',
            transmission_mode: 'Haddathana (Explicit Hearing)',
            connection_status: 'Connected (Muttasil)',
            historical_reasoning: 'Qutaybah traveled to Syria and studied with Yahya ibn Hamza; dates and transmission sound.'
          }
        ],
        overall_chain_status: 'Connected on the surface (Muttasil bi-dh-dhat), but afflicted with internal shakeup (Idtirab) in the identity of the upper narrator between Abdullah, his sister, and his father.'
      },
      agent_3_rijal: {
        narrators: [
          {
            narrator_name: 'Qutaybah ibn Sa\'id al-Baghlandi (d. 240 AH)',
            critic_verdicts: [
              'Ahmad ibn Hanbal: "He is Thiqah, a master of sunnah and hadith."',
              'Al-Nasa\'i: "Thiqah Thabt (Trustworthy and Firm)."'
            ],
            status: 'Thiqah Thiqah',
            citations: ['Tahdhib al-Tahdhib Vol 8, p. 312', 'Siyar A\'lam al-Nubala Vol 11, p. 13']
          },
          {
            narrator_name: 'Yahya ibn Hamza al-Hadrami (d. 183 AH)',
            critic_verdicts: [
              'Yahya ibn Ma\'in: "Thiqah, Qadi of Damascus."',
              'Abu Hatim: "Honest and sound narrator (Saduq la ba\'sa bihi)."'
            ],
            status: 'Thiqah',
            citations: ['Al-Jarh wa al-Ta\'dil Vol 9, p. 142', 'Tahdhib al-Kamal Vol 31, p. 288']
          },
          {
            narrator_name: 'Thawran ibn Yazid al-Kila\'i (d. 153 AH)',
            critic_verdicts: [
              'Yahya ibn Ma\'in: "Thiqah, though he was accused of Qadar (theological issue), his hadith is completely reliable."',
              'Al-Dhahabi: "A reliable hafiz from Hims who was unjustly persecuted."'
            ],
            status: 'Thiqah',
            citations: ['Mizan al-I\'tidal Vol 1, p. 373', 'Taqrib al-Tahdhib No. 848']
          },
          {
            narrator_name: 'Khalid ibn Ma\'dan al-Kala\'i (d. 104 AH)',
            critic_verdicts: [
              'Ibn Sa\'d: "Thiqah, devoted worshipper and leader of knowledge."',
              'Al-Ijli: "Shami, Tabi\'i, Thiqah of the highest caliber."'
            ],
            status: 'Thiqah Thiqah',
            citations: ['Tahdhib al-Tahdhib Vol 3, p. 118', 'Al-Thiqat li Ibn Hibban Vol 4, p. 195']
          },
          {
            narrator_name: 'Abdullah ibn Busr al-Mazini (d. 96 AH)',
            critic_verdicts: [
              'Consensus of Muhadditheen: Sahabi Jalil (Venerable Companion of the Prophet). Companions are universally deemed upright (\'Udool).'
            ],
            status: 'Thiqah (Sahabi)',
            citations: ['Al-Isabah fi Tamyiz al-Sahabah Vol 4, p. 23', 'Usd al-Ghabah Vol 3, p. 181']
          },
          {
            narrator_name: 'Al-Samma\' bint Busr (Companion)',
            critic_verdicts: [
              'Ibn Hajar: "Sahabiyyah (Female Companion), her companionships verified."'
            ],
            status: 'Thiqah (Sahabiyyah)',
            citations: ['Al-Isabah Vol 8, p. 214', 'Tahdhib al-Tahdhib Vol 12, p. 434']
          }
        ]
      },
      agent_4_shawahid_matn: {
        supporting_reports: [
          'Report of Abu Hurairah in Bukhari & Muslim: "None of you should fast on Friday unless he fasts a day before it or a day after it (which is Saturday)."',
          'Report of Juwayriyah bint al-Harith in Sahih al-Bukhari: The Prophet entered upon her on Friday while she was fasting, and asked: "Did you fast yesterday?" She said: "No." He asked: "Do you intend to fast tomorrow (Saturday)?" She said: "No." He ordered: "Then break your fast."'
        ],
        hidden_defects_ilal: [
          'Severe Matn Anomaly (Shudhudh): The blanket prohibition in this hadith ("except what is made obligatory") directly conflicts with Mutawatir/Mashhur authentic reports in Bukhari and Muslim where the Prophet explicitly commanded fasting Saturday if joined with Friday, or during the white days (Ayyam al-Beed), or the Fast of Dawud (every other day).',
          'Idtirab (Internal Agitation in Chain): Narrators differed wildly whether Khalid heard it from Abdullah b. Busr, from his sister Al-Samma\', from his father Busr, or without intermediary.'
        ],
        contradictions: [
          'Directly contradicts Sahih al-Bukhari #1986 and Sahih Muslim #1144.',
          'Imam Malik said: "This hadith is a fabrication or delusion (Kadhaba hadha al-hadith / Matruk)."'
        ]
      },
      agent_5_scholars_verdict: {
        gradings: [
          {
            scholar: 'Imam Malik ibn Anas',
            grading: 'Da\'if / Matruk (Rejected Matn)',
            reference: 'Masa\'il Abu Dawud, p. 111'
          },
          {
            scholar: 'Imam Abu Dawud al-Sijistani',
            grading: 'Mansukh (Abrogated) / Mu\'all (Defective)',
            reference: 'Sunan Abi Dawud, after Hadith 2421'
          },
          {
            scholar: 'Imam Al-Zuhri',
            grading: 'Munkar / Gayr Ma\'ruf',
            reference: 'Al-Ilal al-Kabir li al-Tirmidhi, p. 95'
          },
          {
            scholar: 'Al-Hafiz Ibn Hajar al-\'Asqalani',
            grading: 'Shadh (Irregular)',
            reference: 'Fath al-Bari Vol 4, p. 234'
          },
          {
            scholar: 'Shaykh Muhammad Nasir al-Din al-Albani',
            grading: 'Sahih (Authentic chain taken literally)',
            reference: 'Irwa\' al-Ghalil Vol 4, p. 118, Hadith 960'
          },
          {
            scholar: 'Shaykh Ibn Baz',
            grading: 'Da\'if / Shadh (Conflicting with Sahihayn)',
            reference: 'Majmu\' Fatawa Ibn Baz Vol 15, p. 412'
          }
        ]
      },
      agent_6_synthesis: {
        final_status: 'Da\'if bi-I\'tibar al-Shudhudh wa al-Idtirab (Irregular / Weakened by Defect)',
        purity_confidence_score: 54.5,
        consensus_and_disagreements: 'A classical textbook case of "Sihhat al-Isnad ma\'a Wujood al-Illa" (An apparently sound chain masking a critical hidden defect). While all individual transmitters are trustworthy (Thiqat) leading Shaykh al-Albani to authenticate it solely on chain merits, the overwhelming majority of classical critics—led by Malik, Al-Zuhri, Abu Dawud, Ibn Hajar, and contemporary jurists—deem the text Shadh (anomalous) because it unequivocally prohibits voluntary fasting on Saturday even when paired, conflicting directly with explicit commands in Sahih al-Bukhari and Sahih Muslim.',
        executive_report_markdown: `### Dragon Dawwa Technical Executive Authentication Report

**Hadith Dossier:** Prohibition of Fasting on Saturdays Except for Obligatory Fasts  
**Primary Identifiers:** Sunan Abu Dawud (2421), Jami' at-Tirmidhi (744), Sunan Ibn Majah (1726)  
**Assigned Purity Score:** 54.5% (Conditional / Deficient due to Matn Shudhudh)

#### 1. Chain Continuity & Transmitter Integrity
The individual links from Qutaybah through Yahya ibn Hamza, Thawran ibn Yazid, and Khalid ibn Ma'dan to Abdullah ibn Busr and his sister are populated exclusively by **Thiqah (trustworthy)** transmitters. There are no signs of fabrication or moral defect among the biographees.

#### 2. The Critical Hidden Defect ('Illa Qadihah)
Despite the formal connection of the chain, the narration suffers from two fatal defects recognized by the Mutaqaddimun (early critics):
1. **Idtirab (Turmoil in Sanad):** The transmission oscillates between Abdullah from the Prophet, Abdullah from his sister, and Abdullah from his father.
2. **Shudhudh (Textual Irregularity):** The text asserts that even if one finds only a grape twig, one must break the fast on Saturday. This clashes squarely with:
   - The established sunnah of the Fast of Prophet Dawud (peace be upon him) which inevitably lands on alternate Saturdays.
   - The authentic hadith of Juwayriyah in Sahih al-Bukhari, where the Prophet authorized her to fast Saturday if joined with Friday.

#### 3. Verdict Reconciliation
The consensus of the classical Hadith masters (Malik, Abu Dawud, Al-Nasa'i, Ibn Taymiyyah, and Ibn Hajar) holds that the hadith is either defective (Mu'all) or that its apparent generality is abrogated and not to be practiced in isolation.

---
*Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies*`,
        podcast_script: `[AUDIO CUE: INTRO UP - POLISHED RADIO BEAT (4 SECONDS) THEN FADE UNDER]

BROTHER FEROZ (HOST): Welcome to Dragon Dawwa Live, broadcasting from Prime Dragon Studios! I am Brother Feroz, your anchor. Today we unpack one of the most intriguing debates in Islamic jurisprudence: the disputed prohibition against fasting on Saturdays recorded in Sunan Abu Dawud. Before we open the manuscript vault, let us introduce our panel and how each table operates when a Hadith arrives for authentication.

DR. TARIQ: Assalamu alaikum, listeners! I am Dr. Tariq al-Mansoor, head of the Takhrij Table. When a narration lands on my desk, my mission is exhaustive source retrieval: indexing manuscripts across primary collections, comparing wording variants, and isolating additions or omissions across the Musnads and Sunan.

[AUDIO CUE: SOFT PENCIL TAP / DESK PAPERS]

DR. LAYLA: Greetings, everyone! I am Dr. Layla al-Qasimi, Senior Transmission Specialist at the Isnad Table. My job is mapping the chain of transmission. I verify direct hearing indicators like Sami'tu ('I heard') and Haddathana ('he narrated to us') versus ambiguous modes, checking historical meeting dates to detect broken links or hidden anomalies.

SHEIKH IMRAN: Peace be upon you all. I am Sheikh Imran al-Hasani, Biographical Critic at the Rijal Table. When the transmission chain arrives at my table, I open the biographical dictionaries of Jarh wa Ta'dil—such as Tahdhib al-Tahdhib and Mizan al-I'tidal—to scrutinize each transmitter's character, truthfulness, and memory retention.

DR. ZAINAB: Hello, listeners! I am Dr. Zainab al-Mubarak, Lead Investigator at the Shawahid and Matn Table. My table screens the actual text for hidden defects ('Ilal) and irregular deviations (Shudhudh). I check parallel corroborating paths and verify that the text does not clash with the Holy Quran or mass-transmitted Sunnah.

SHEIKH YUSUF: Assalamu alaikum. I am Sheikh Yusuf al-Azhari, Comparative Grading Jurist. Once data from all tables is gathered, I synthesize historical rulings across schools of thought—from the early classical jurists down to contemporary scholars.

[AUDIO CUE: DRAMATIC DRUM THUD]

BROTHER FEROZ (HOST): An elite panel of scholars! Dr. Tariq, bring us the Arabic recitation and source analysis for today's narration.

DR. TARIQ: Bismillah. The text in Sunan Abu Dawud (Hadith 2421) reads in Arabic: لَا تَصُومُوا يَوْمَ السَّبْتِ إِلَّا فِيمَا افْتُرِضَ عَلَيْكُمْ (Lā taṣūmū yawma as-sabti illā fīmā ufturiḍa 'alaykum). Which translates to: "Do not fast on Saturdays except for what has been made obligatory upon you." Abu Dawud also records the Syrian addition warning that even if one finds only a grape twig, one should chew it to break the fast!

DR. LAYLA: And from the Isnad table, Brother Feroz, this chain looks deceptively pristine at first glance! Qutaybah transmits from Yahya ibn Hamza, from Thawran ibn Yazid, from Khalid ibn Ma'dan, up to Abdullah ibn Busr. But when we map the sub-chains, our network detects severe turmoil—Idtirab! The transmitters couldn't agree whether Abdullah heard it directly from the Prophet, from his sister Al-Samma', or from his father Busr.

SHEIKH IMRAN: Brother Feroz, every individual narrator in this Syrian chain is formally Thiqah (trustworthy)—Yahya was a respected Qadi of Damascus and Thawran is dependable. That is why Shaykh al-Albani initially authenticated the chain on paper. But as Rijal critics know, individual trustworthiness cannot salvage a chain suffering from internal confusion!

DR. ZAINAB: [Interjecting with urgency] Exactly, Sheikh Imran and Brother Feroz! This is where the hidden defect—the 'Illa Qadihah—explodes the text!

BROTHER FEROZ (HOST): Dr. Zainab, go right ahead. What text abnormality did your table uncover?

DR. ZAINAB: Brother Feroz, this absolute prohibition crashes squarely into mass-transmitted traditions in Sahih al-Bukhari and Sahih Muslim! In Bukhari, the Prophet explicitly instructed Juwayriyah that she could fast Saturday if joined with Friday. Furthermore, the Fast of Prophet Dawud (peace be upon him)—fasting alternate days—inevitably lands on Saturdays! The text is textbook Shadh: irregular and clashing with established Sunnah!

SHEIKH YUSUF: Spot on, Dr. Zainab and Brother Feroz! That is why Imam Malik declared this narration rejected, and Imam Abu Dawud classified it as defective or abrogated. Ibn Hajar agreed: an authentic-looking chain cannot validate an abnormal matn!

BROTHER FEROZ (HOST): Masterful synthesis across all tables! The Dragon Dawwa Engine calculates a PURITY CONFIDENCE SCORE of 54.5% — WEAKENED BY SHUDHUDH & IDTIRAB. Thank you Dr. Tariq, Dr. Layla, Sheikh Imran, Dr. Zainab, and Sheikh Yusuf! Join us next time on Dragon Dawwa Live, I am Brother Feroz signing off.

[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]`
      },
      historical_variations_trend: [
        {
          id: "var-abudawud",
          collection: "Sunan Abu Dawud",
          label: "Abu Dawud (2421)",
          hadith_number: "2421",
          year_ah: 275,
          confidence_score: 54.5,
          matn_integrity: 60.0,
          isnad_continuity: 90.0,
          exact_wording_arabic: "لا تَصُومُوا يَوْمَ السَّبْتِ إِلا فِيمَا افْتُرِضَ عَلَيْكُمْ...",
          wording_differences: "Contains grape skin and twig clause; graded Shadh by Malik and Abu Dawud.",
          status: "Shadh / Da'if"
        },
        {
          id: "var-tirmidhi",
          collection: "Jami' at-Tirmidhi",
          label: "At-Tirmidhi (744)",
          hadith_number: "744",
          year_ah: 279,
          confidence_score: 58.0,
          matn_integrity: 65.0,
          isnad_continuity: 90.0,
          exact_wording_arabic: "لا تَصُومُوا يَوْمَ السَّبْتِ إِلا فِيمَا افْتُرِضَ عَلَيْكُمْ",
          wording_differences: "Concise wording omitting the grape peel clause; graded Hasan Gharib.",
          status: "Disputed / Hasan Gharib"
        },
        {
          id: "var-ibnmajah",
          collection: "Sunan Ibn Majah",
          label: "Ibn Majah (1726)",
          hadith_number: "1726",
          year_ah: 273,
          confidence_score: 52.0,
          matn_integrity: 58.0,
          isnad_continuity: 88.0,
          exact_wording_arabic: "لا تَصُومُوا يَوْمَ السَّبْتِ إِلا فِيمَا افْتُرِضَ عَلَيْكُمْ",
          wording_differences: "Bab Siyam Yawm al-Sabt in Kitab al-Siyam.",
          status: "Da'if bi-Shudhudh"
        },
        {
          id: "var-nasai",
          collection: "Sunan an-Nasa'i",
          label: "An-Nasa'i (2761)",
          hadith_number: "2761",
          year_ah: 303,
          confidence_score: 55.0,
          matn_integrity: 62.0,
          isnad_continuity: 89.0,
          exact_wording_arabic: "مَنْ لَمْ يَجِدْ مِنْكُمْ إِلا لِحَاءَ شَجَرَةٍ فَلْيُفْطِرْ عَلَيْهِ...",
          wording_differences: "Puts tree peel clause first.",
          status: "Mu'all"
        },
        {
          id: "var-ahmad",
          collection: "Musnad Ahmad",
          label: "Ahmad (17684)",
          hadith_number: "17684",
          year_ah: 241,
          confidence_score: 50.0,
          matn_integrity: 55.0,
          isnad_continuity: 85.0,
          exact_wording_arabic: "عَنْ عَبْدِ اللَّهِ بْنِ بُسْرٍ عَنْ أُخْتِهِ الصَّمَّاءِ...",
          wording_differences: "Chain displays internal oscillation (Idtirab) between sister, father, and direct hearing.",
          status: "Mudtarib"
        }
      ]
    }
  },
  {
    id: 'actions-by-intentions',
    title: 'Actions are by Intentions (Innama al-A\'malu bi al-Niyyat)',
    category: 'Foundational Muttafaq \'Alayh',
    hadith_text: "Innamā al-a'mālu bi-n-niyyāt, wa innamā li-kulli imri'in mā nawā... (Actions are judged solely by intentions, and every person shall have only what they intended...)",
    isnad_text: "Prophet Muhammad (PBUH) -> 'Umar ibn al-Khaṭṭāb -> 'Alqamah ibn Waqqāṣ al-Laythī -> Muḥammad ibn Ibrāhīm al-Taymī -> Yaḥyā ibn Sa'īd al-Anṣārī -> Mass Transmission (200+ Scholars)",
    defaultData: {
      app_name: "Dragon Dawwa",
      version: "2.5 Enterprise Engine",
      platform_owner: "Prime Dragon Technologies (Pvt) Ltd",
      designed_and_created_by: "Aegis Intelligence Pvt Ltd, Sri Lanka",
      query_hadith: "Innamā al-a'mālu bi-n-niyyāt, wa innamā li-kulli imri'in mā nawā... (Actions are judged solely by intentions, and every person shall have only what they intended...)",
      agent_1_takhrij: {
        sources: [
          {
            collection: "Sahih al-Bukhari",
            hadith_number: "1, 54, 2529, 3898, 5070, 6689, 6953",
            exact_wording: "Innamā al-a'mālu bi-n-niyyāt, wa innamā li-kulli imri'in mā nawā...",
            wording_differences: "Primary reference text; repeated across 7 legal chapters."
          },
          {
            collection: "Sahih Muslim",
            hadith_number: "1907",
            exact_wording: "Innamā al-a'mālu bi-n-niyyah...",
            wording_differences: "Uses singular form 'niyyah' in early transmission sub-path via Sufyan ibn 'Uyaynah."
          },
          {
            collection: "Sunan Abi Dawud",
            hadith_number: "2201",
            exact_wording: "...fa-hijratuhū ilā mā hājara ilayhi.",
            wording_differences: "Includes extended secondary claddings regarding trade or marriage specificities."
          },
          {
            collection: "Sunan al-Tirmidhi",
            hadith_number: "1647",
            exact_wording: "Innamā al-a'mālu bi-n-niyyāt...",
            wording_differences: "Identical core text to Sahih al-Bukhari."
          },
          {
            collection: "Sunan al-Nasa'i",
            hadith_number: "75, 3437, 3794",
            exact_wording: "Al-a'mālu bi-n-niyyah...",
            wording_differences: "Minor grammatical variation in chapter on purification and oaths."
          },
          {
            collection: "Sunan Ibn Majah",
            hadith_number: "4227",
            exact_wording: "Innamā al-a'mālu bi-n-niyyāt...",
            wording_differences: "Identical core wording in Kitab al-Zuhd."
          },
          {
            collection: "Musnad Ahmad ibn Hanbal",
            hadith_number: "168, 300",
            exact_wording: "Innamā al-a'mālu bi-n-niyyāt...",
            wording_differences: "Transmitted via multiple sub-chains starting from Yahya ibn Sa'id al-Ansari."
          }
        ],
        variants_summary: "Textual divergence across all six major canonical collections is strictly limited to minor grammatical preferences (plural 'niyyat' vs singular 'niyyah'). Semantic integrity remains 100% invariant."
      },
      agent_2_isnad: {
        narrator_sequence: [
          "Prophet Muhammad (PBUH)",
          "'Umar ibn al-Khaṭṭāb",
          "'Alqamah ibn Waqqāṣ al-Laythī",
          "Muḥammad ibn Ibrāhīm al-Taymī",
          "Yaḥyā ibn Sa'īd al-Anṣārī",
          "Mass Transmission (200+ Scholars)"
        ],
        chain_links: [
          {
            teacher: "Prophet Muhammad (PBUH)",
            student: "'Umar ibn al-Khaṭṭāb",
            transmission_mode: "Sami'tu ('I heard')",
            connection_status: "Muttasil (Connected)",
            historical_reasoning: "Direct Companion hearing on the pulpit in Madinah."
          },
          {
            teacher: "'Umar ibn al-Khaṭṭāb",
            student: "'Alqamah ibn Waqqāṣ",
            transmission_mode: "Sami'tu 'Umara khateeban ('I heard Umar preaching')",
            connection_status: "Muttasil (Connected)",
            historical_reasoning: "Direct sermon hearing; contemporary scholar of Madinah."
          },
          {
            teacher: "'Alqamah ibn Waqqāṣ",
            student: "Muḥammad ibn Ibrāhīm al-Taymī",
            transmission_mode: "'An (Direct student)",
            connection_status: "Muttasil (Connected)",
            historical_reasoning: "Verified direct student-teacher relationship; coexisted in Madinah."
          },
          {
            teacher: "Muḥammad ibn Ibrāhīm al-Taymī",
            student: "Yaḥyā ibn Sa'īd al-Anṣārī",
            transmission_mode: "Haddathanī ('He narrated to me')",
            connection_status: "Muttasil (Connected)",
            historical_reasoning: "Explicit direct dictation verified in early Hadith biographical registers."
          }
        ],
        overall_chain_status: "Muttasil (Continuous) & Gharib Mutlaq (Singular) in first 4 tiers; turns Mutawatir after Yahya ibn Sa'id."
      },
      agent_3_rijal: {
        narrators: [
          {
            narrator_name: "'Umar ibn al-Khaṭṭāb al-Fārūq (d. 23 AH)",
            critic_verdicts: [
              "Senior Companion (Sahabi)",
              "All Companions are universally established as upright (Al-Sahabah kulluhum 'udul)."
            ],
            status: "Sahabi / Universal Integrity",
            citations: [
              "Al-Isti'ab 3/1144",
              "Usd al-Ghabah 4/137"
            ]
          },
          {
            narrator_name: "'Alqamah ibn Waqqāṣ al-Laythī (d. ~60-70 AH)",
            critic_verdicts: [
              "Listed by Ibn Hibban in Al-Thiqat (Vol. 5, p. 192).",
              "Ibn Hajar al-'Asqalani in Taqrib al-Tahdhib: 'Thiqah (Trustworthy), highly esteemed.'"
            ],
            status: "Thiqah",
            citations: [
              "Al-Thiqat 5/192",
              "Taqrib al-Tahdhib #4681"
            ]
          },
          {
            narrator_name: "Muḥammad ibn Ibrāhīm ibn al-Ḥārith al-Taymī (d. 120 AH)",
            critic_verdicts: [
              "Yahya ibn Ma'in declared: 'Thiqah.'",
              "Al-Nasa'i stated: 'Thiqah Ma'mun (Trustworthy and Reliable).'",
              "Ibn Hajar in Tahdhib al-Tahdhib: 'Master hadith scholar of Madinah.'"
            ],
            status: "Thiqah Thiqah",
            citations: [
              "Tahdhib al-Tahdhib 9/5",
              "Tarikh Ibn Ma'in 2/502"
            ]
          },
          {
            narrator_name: "Yaḥyā ibn Sa'īd al-Anṣārī (d. 143 AH)",
            critic_verdicts: [
              "Imam Ahmad ibn Hanbal: 'Yahya ibn Sa'id is the most reliable of people; he is the pivot of Madinan tradition.'",
              "Al-Dhahabi in Siyar A'lam al-Nubala': 'Imam, Hafiz, Hujjah (Proof).'"
            ],
            status: "Thiqah Thiqah / Imam",
            citations: [
              "Siyar A'lam al-Nubala' 6/143",
              "Tadhkirat al-Huffaz 1/138"
            ]
          }
        ]
      },
      agent_4_shawahid_matn: {
        supporting_reports: [
          "Corroborated conceptually by Quranic injunctions (Surah Al-Bayyinah 98:5) and parallel authentic prophetic traditions (e.g., Sahih al-Bukhari #2783: 'There is no migration after the Conquest, but only Jihad and Intention')."
        ],
        hidden_defects_ilal: [
          "None ('Ilal Qadihah free). The singular isolation (Gharib) in the first three tiers is fully accounted for by direct Madinan scholarly dictation and mass fan-out from Yahya ibn Sa'id."
        ],
        contradictions: [
          "Zero abnormalities (Shudhudh) or contradictions. The text stands as a core foundation for Islamic jurisprudence."
        ]
      },
      agent_5_scholars_verdict: {
        gradings: [
          {
            scholar: "Imam al-Bukhārī (d. 256 AH)",
            grading: "Sahih (Authentic)",
            reference: "Sahih al-Bukhari, Hadith #1"
          },
          {
            scholar: "Imam Muslim (d. 261 AH)",
            grading: "Sahih (Authentic)",
            reference: "Sahih Muslim, Hadith #1907"
          },
          {
            scholar: "Imam al-Shafi'ī (d. 204 AH)",
            grading: "Sahih (Foundational Pillar)",
            reference: "Al-Umm, Vol. 1, p. 12"
          },
          {
            scholar: "Imam al-Nawawī (d. 676 AH)",
            grading: "Sahih (Agreed Upon)",
            reference: "Sharh Sahih Muslim, Vol. 13, p. 53"
          },
          {
            scholar: "Sheikh al-Albānī (d. 1420 AH)",
            grading: "Sahih (Authentic)",
            reference: "Irwa' al-Ghalil, Hadith #1"
          },
          {
            scholar: "Shu'ayb al-Arnā'ūṭ (d. 1438 AH)",
            grading: "Sahih (Authentic)",
            reference: "Tahqiq Musnad Ahmad, Hadith #168"
          }
        ]
      },
      agent_6_synthesis: {
        final_status: "Sahih Lizatihi (Authentic in and of itself)",
        purity_confidence_score: 100.0,
        consensus_and_disagreements: "100% Universal consensus among classical and contemporary scholars. Zero scholarly disagreement regarding its authenticity or legal authority.",
        executive_report_markdown: "# Academic Deep Research Dossier\n\n## Agent 1: Takhrij & Source Analysis\n**Author:** Dr. Tariq al-Mansoor\nThe narration *'Innamā al-a'mālu bi-n-niyyāt'* represents one of the most meticulously documented texts in Islamic Hadith literature, serving as the opening tradition of Imam al-Bukhari’s *Sahih*.\n\n## Agent 2: Isnad & Chain Transmission Analysis\n**Author:** Dr. Layla al-Qasimi\nWhile the transmission fan expands into hundreds of chains in the 2nd and 3rd centuries, the foundational chain is strictly singular (*Gharib Mutlaq*) across the first four generations. Every link utilizes explicit direct-hearing terminology.\n\n## Agent 3: Rijal Critical Evaluation\n**Author:** Sheikh Imran al-Hasani\nEvery authority in this single path belongs to the highest tier of biographical reliability (*Thiqah Thiqah*).\n\n## Agent 4: Shawahid & Matn Defect Analysis\n**Author:** Dr. Zainab al-Mubarak\nZero hidden defects (*'Ilal*). Zero abnormality (*Shudhudh*). Aligns perfectly with Qur'anic principles.\n\n## Agent 5: Scholar Gradings & Consensus\n**Author:** Sheikh Yusuf al-Azhari\nUniversal consensus across centuries. Formulates one-third of all Islamic legal jurisprudence.\n\n---\n*Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies*",
        podcast_script: `[AUDIO CUE: INTRO UP - POLISHED RADIO BEAT (4 SECONDS) THEN FADE UNDER]

BROTHER FEROZ (HOST): Welcome to Dragon Dawwa Live, broadcasting from Prime Dragon Studios! I am your host, Brother Feroz. Today we execute a complete multi-agent deep dive into one of the most famous Hadiths in history: Actions are judged solely by intentions. Before we examine the text, let us meet the world-class scholars on our panel and understand how a Hadith is processed at each table.

DR. TARIQ: Assalamu alaikum, listeners! I am Dr. Tariq al-Mansoor, head of the Takhrij Table. When a Hadith lands on my desk, my job is source discovery. I index hundreds of classical manuscripts, cross-referencing Sahih al-Bukhari, Sahih Muslim, the Sunan, and Musnad Ahmad. I compare every single letter to isolate text variants and additions.

[AUDIO CUE: SOFT PENCIL TAP / DESK PAPERS]

DR. LAYLA: Greetings, everyone! I am Dr. Layla al-Qasimi, Senior Transmission Specialist at the Isnad Table. Once Dr. Tariq identifies the sources, I trace the chain of narrators back to the Prophet, peace be upon him. I evaluate the exact connection terms—checking whether a narrator says Sami'tu, 'I heard', or Haddathana, 'he narrated to us', versus ambiguous terms like 'An, 'from'. I verify historical birth and death dates to ensure no broken links exist.

SHEIKH IMRAN: Peace be upon you all. I am Sheikh Imran al-Hasani, Biographical Critic at the Rijal Table. When Dr. Layla gives me the list of narrators, my table evaluates their personal integrity, memory retention, and moral standing. I consult biographical reference books like Ibn Hibban's Al-Thiqat and Ibn Hajar's Tahdhib al-Tahdhib to read what the master critics said about each narrator.

DR. ZAINAB: Hello, listeners! I am Dr. Zainab al-Mubarak, lead investigator at the Shawahid and Matn Table. My table screens the actual text for hidden defects, known as 'Ilal, and irregularities, known as Shudhudh. I look for parallel supporting chains and verify if the text aligns perfectly with the Holy Quran.

SHEIKH YUSUF: Assalamu alaikum. I am Sheikh Yusuf al-Azhari, Comparative Grading Collector. Once the scientific data from Tables 1 through 4 is compiled, I examine how the classical and contemporary jurists graded the Hadith—from Imam al-Shafi'i down to modern scholars like Sheikh al-Albani.

[AUDIO CUE: DRAMATIC DRUM THUD]

BROTHER FEROZ (HOST): Incredible! Now that we know our panel and their methodology, let us analyze our query Hadith. Dr. Tariq, start us off with the Arabic recitation and source breakdown.

DR. TARIQ: Bismillah. The Hadith opens with the profound statement recited by the Prophet, peace be upon him: إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى (Innamā al-a'mālu bi-n-niyyāt, wa innamā li-kulli imri'in mā nawā). Which translates to: Actions are judged solely by intentions, and every person shall have only what they intended. In Sahih al-Bukhari alone, this Hadith appears in seven distinct chapters!

DR. LAYLA: And from the Isnad perspective, this Hadith carries a fascinating structure, Brother Feroz! It is a Gharib Mutlaq narration in its first four tiers—carried by a single continuous line: 'Umar ibn al-Khattab, to 'Alqamah, to Muhammad ibn Ibrahim, to Yahya ibn Sa'id al-Ansari. Every link uses explicit direct hearing terms like سَمِعْتُ عُمَرَ خَطِيبًا (Sami'tu 'Umara khateeban), 'I heard Umar preaching on the pulpit'!

SHEIKH IMRAN: Brother Feroz, a singular chain is only as weak as its narrators, but here every narrator is a giant! 'Umar is the Second Caliph. 'Alqamah and Muhammad ibn Ibrahim are senior trustworthy Tabi'in. And Yahya ibn Sa'id was the Chief Judge of Madinah, declared Thiqah Thiqah, completely trustworthy! Dictated to over 200 scholars!

[AUDIO CUE: SOFT CHIME / TRANSITION SOUND]

DR. ZAINAB: Indeed! And when my table checks for Quranic alignment, Brother Feroz, it harmonizes directly with Allah's words in Surah Al-Bayyinah, verse 5: وَمَا أُمِرُوا إِلَّا لِيَعْبُدُوا اللَّهَ مُخْلِصِينَ لَهُ الدِّينَ (Wa mā umirū illā li-ya'budū Allāha mukhliṣīna lahu ad-dīn). Meaning: And they were not commanded except to worship Allah, being sincere to Him in religion. It has zero hidden defects!

SHEIKH YUSUF: That is why Imam al-Shafi'i stated that this Hadith constitutes one-third of all Islamic knowledge, Brother Feroz! Every major scholar—from Bukhari and Muslim down to Sheikh al-Albani—has graded it Sahih Lizatihi, authentic in and of itself.

BROTHER FEROZ (HOST): MashaAllah! A flawless demonstration across all six tables. The Dragon Dawwa Engine calculates an absolute PURITY CONFIDENCE SCORE of 100.0% — SAHIH! Thank you to our panel, and thank you to our listeners. Join us next time on Dragon Dawwa Live!

[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]`
      },
      historical_variations_trend: [
        {
          id: "var-bukhari",
          collection: "Sahih al-Bukhari",
          label: "Al-Bukhari (1)",
          hadith_number: "1",
          year_ah: 256,
          confidence_score: 100.0,
          matn_integrity: 100.0,
          isnad_continuity: 100.0,
          exact_wording_arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
          wording_differences: "Standard primary reference codex; plural 'niyyat'.",
          status: "Sahih"
        },
        {
          id: "var-muslim",
          collection: "Sahih Muslim",
          label: "Muslim (1907)",
          hadith_number: "1907",
          year_ah: 261,
          confidence_score: 100.0,
          matn_integrity: 99.8,
          isnad_continuity: 100.0,
          exact_wording_arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّةِ",
          wording_differences: "Singular form 'niyyah' via Sufyan ibn 'Uyaynah path.",
          status: "Sahih"
        },
        {
          id: "var-ahmad",
          collection: "Musnad Ahmad",
          label: "Ahmad (168)",
          hadith_number: "168",
          year_ah: 241,
          confidence_score: 99.2,
          matn_integrity: 99.5,
          isnad_continuity: 99.8,
          exact_wording_arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
          wording_differences: "Transmitted via multiple sub-chains from Yahya ibn Sa'id.",
          status: "Sahih"
        },
        {
          id: "var-abudawud",
          collection: "Sunan Abi Dawud",
          label: "Abu Dawud (2201)",
          hadith_number: "2201",
          year_ah: 275,
          confidence_score: 99.5,
          matn_integrity: 99.5,
          isnad_continuity: 99.8,
          exact_wording_arabic: "فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ...",
          wording_differences: "Detailed migration clause for marriage or worldly trade.",
          status: "Sahih"
        },
        {
          id: "var-tirmidhi",
          collection: "Sunan al-Tirmidhi",
          label: "Al-Tirmidhi (1647)",
          hadith_number: "1647",
          year_ah: 279,
          confidence_score: 99.5,
          matn_integrity: 99.7,
          isnad_continuity: 99.8,
          exact_wording_arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ...",
          wording_differences: "Core wording identical to Bukhari; Kitab al-Jihad.",
          status: "Sahih"
        },
        {
          id: "var-nasai",
          collection: "Sunan al-Nasa'i",
          label: "Al-Nasa'i (75)",
          hadith_number: "75",
          year_ah: 303,
          confidence_score: 99.0,
          matn_integrity: 99.2,
          isnad_continuity: 99.5,
          exact_wording_arabic: "الأَعْمَالُ بِالنِّيَّةِ...",
          wording_differences: "Without opening Innamā in Bab al-Niyyah fi al-Wudu'.",
          status: "Sahih"
        },
        {
          id: "var-ibnmajah",
          collection: "Sunan Ibn Majah",
          label: "Ibn Majah (4227)",
          hadith_number: "4227",
          year_ah: 273,
          confidence_score: 98.5,
          matn_integrity: 99.0,
          isnad_continuity: 99.2,
          exact_wording_arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ...",
          wording_differences: "Recorded under Kitab al-Zuhd, Bab al-Niyyah.",
          status: "Sahih"
        }
      ]
    }
  },
  {
    id: 'seek-knowledge-china',
    title: 'Seek Knowledge Even Unto China (Utlubu al-\'Ilma wa law bi al-Sin)',
    category: 'Famous Fabricated / Severely Defective Report',
    hadith_text: 'Seek knowledge even if it is in China, for the seeking of knowledge is an obligation upon every Muslim.',
    isnad_text: 'Abu Atikah Tarif ibn Salman -> Anas ibn Malik -> The Prophet (ﷺ)',
    defaultData: {
      app_name: 'Dragon Dawwa',
      version: '2.5 Enterprise Engine',
      platform_owner: 'Prime Dragon Technologies (Pvt) Ltd',
      designed_and_created_by: 'Aegis Intelligence Pvt Ltd, Sri Lanka',
      query_hadith: 'Seek knowledge even if it is in China, for the seeking of knowledge is an obligation upon every Muslim.',
      agent_1_takhrij: {
        sources: [
          {
            collection: 'Al-Mu\'jam al-Awsat li al-Tabarani',
            hadith_number: '111',
            exact_wording: 'اطلبوا العلم ولو بالصين فإن طلب العلم فريضة على كل مسلم',
            wording_differences: 'Recorded via Abu Atikah from Anas.'
          },
          {
            collection: 'Shu\'ab al-Iman li al-Bayhaqi',
            hadith_number: '1612',
            exact_wording: 'اطلبوا العلم ولو بالصين...',
            wording_differences: 'Al-Bayhaqi explicitly remarks that its text is famous but its chains are all defective.'
          },
          {
            collection: 'Tarikh Baghdad li al-Khatib',
            hadith_number: 'Vol 9, p. 364',
            exact_wording: 'اطلبوا العلم ولو بالصين...',
            wording_differences: 'Transmitted with varied false supporting links.'
          }
        ],
        variants_summary: 'The phrase "seeking knowledge is an obligation upon every Muslim" has authentic sound supporting reports (Hasan), BUT the addition "even unto China" is universally transmitted through corrupt, abandoned, or accused fabricators.'
      },
      agent_2_isnad: {
        narrator_sequence: [
          'The Prophet Muhammad (ﷺ)',
          'Anas ibn Malik (Companion)',
          'Abu Atikah Tarif ibn Salman (Al-Kufi)',
          'Al-Hasan ibn Atiyyah'
        ],
        chain_links: [
          {
            teacher: 'Anas ibn Malik',
            student: 'Abu Atikah Tarif ibn Salman',
            transmission_mode: '\'An (Claimed transmission)',
            connection_status: 'Uncertain / Fabricated link',
            historical_reasoning: 'Abu Atikah claimed to hear from Anas, but senior critics revealed he fabricated reports upon him.'
          },
          {
            teacher: 'Abu Atikah Tarif ibn Salman',
            student: 'Al-Hasan ibn Atiyyah',
            transmission_mode: '\'An',
            connection_status: 'Connected physically but narrators are discarded',
            historical_reasoning: 'Abu Atikah was deemed Matruk and accused of forgery.'
          }
        ],
        overall_chain_status: 'Severely defective / Collapsed chain (Saqit).'
      },
      agent_3_rijal: {
        narrators: [
          {
            narrator_name: 'Anas ibn Malik (d. 93 AH)',
            critic_verdicts: ['Venerable Companion and servant of the Prophet. Upright.'],
            status: 'Thiqah (Sahabi Jalil)',
            citations: ['Al-Isabah Vol 1, p. 126']
          },
          {
            narrator_name: 'Abu Atikah Tarif ibn Salman',
            critic_verdicts: [
              'Al-Bukhari: "Munkar al-Hadith (Rejected in Hadith)."',
              'Abu Hatim: "Dhahib al-Hadith (His hadith is worthless / discarded)."',
              'Al-Sulaymani: "Known for fabricating hadiths upon Anas."'
            ],
            status: 'Matruk / Accused of Fabrication',
            citations: ['Al-Du\'afa al-Kabir li al-Uqayli Vol 2, p. 230', 'Mizan al-I\'tidal Vol 2, p. 336']
          },
          {
            narrator_name: 'Al-Hasan ibn Atiyyah al-Qurashi',
            critic_verdicts: ['Abu Hatim: Da\'if, does not substantiate evidence.'],
            status: 'Da\'if',
            citations: ['Tahdhib al-Kamal Vol 6, p. 200']
          }
        ]
      },
      agent_4_shawahid_matn: {
        supporting_reports: [
          'The second half "Seeking knowledge is an obligation upon every Muslim" is graded Hasan through Sunan Ibn Majah #224 via other routes.',
          'The specific addition "even unto China" (wa law bi al-Sin) has ZERO authentic shawahid or mutaabi\'at.'
        ],
        hidden_defects_ilal: [
          'Sole transmission rests upon Abu Atikah, who is discarded.',
          'Textual addition of geographical extremity reflects later popular phrasing rather than prophetic terminology.'
        ],
        contradictions: [
          'Contradicts standards of prophetic speech regarding distance and phrasing.'
        ]
      },
      agent_5_scholars_verdict: {
        gradings: [
          {
            scholar: 'Imam Ibn al-Jawzi',
            grading: 'Mawdu\' (Fabricated)',
            reference: 'Al-Mawdu\'at Vol 1, p. 215'
          },
          {
            scholar: 'Imam al-Bayhaqi',
            grading: 'Da\'if Jiddan / Batil (Severely Weak / False)',
            reference: 'Shu\'ab al-Iman Vol 2, p. 253'
          },
          {
            scholar: 'Al-Hafiz Ibn Hajar al-\'Asqalani',
            grading: 'Da\'if bi-Kull Turuqihi (Weak through all its routes)',
            reference: 'Lisan al-Mizan Vol 3, p. 228'
          },
          {
            scholar: 'Shaykh al-Albani',
            grading: 'Mawdu\' (Fabricated with regard to "China")',
            reference: 'Silsilat al-Ahadith al-Da\'ifah #416'
          }
        ]
      },
      agent_6_synthesis: {
        final_status: 'Mawdu\' / Da\'if Jiddan (Fabricated / Severely Defective Addition)',
        purity_confidence_score: 11.2,
        consensus_and_disagreements: 'Total consensus among classical and modern Hadith authorities that the addition "even unto China" is baseless and fabricated. The general obligation of learning essential knowledge is sound from other texts, but attributing this specific wording to the Prophet is illicit.',
        executive_report_markdown: `### Dragon Dawwa Technical Executive Authentication Report

**Hadith Dossier:** "Seek Knowledge Even Unto China" (*Utlubu al-'Ilm wa law bi al-Sin*)  
**Primary Identifiers:** Al-Tabarani (Al-Awsat 111), Al-Bayhaqi (Shu'ab 1612)  
**Assigned Purity Score:** 11.2% (Fabricated / Severely Defective)

#### 1. Chain Pathology
The chain founders completely upon **Abu Atikah Tarif ibn Salman**. Bukhari labeled him *Munkar al-Hadith*, and Al-Sulaymani declared him an active fabricator of narrations attributed to Anas ibn Malik.

#### 2. Synthesis of Shudhudh and Wad'
While the sentence "Seeking knowledge is an obligation upon every Muslim" is substantiated by sound supporting chains (*Shawahid* in Sunan Ibn Majah), the clause *wa law bi al-Sin* was invented by later storytellers.

---
*Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies*`,
        podcast_script: `[AUDIO CUE: INTRO UP - POLISHED RADIO BEAT (4 SECONDS) THEN FADE UNDER]

BROTHER FEROZ (HOST): Welcome back to Dragon Dawwa Live, broadcasting from Prime Dragon Studios! I am Brother Feroz, your anchor. Today we investigate a phrase that virtually every Muslim has heard quoted in popular lectures and classroom walls: "Seek knowledge even unto China." Before we dissect the manuscripts, let us bring in our six-table scholarly panel and understand how each department audits a narration.

DR. TARIQ: Assalamu alaikum, listeners! I am Dr. Tariq al-Mansoor, head of the Takhrij Table. When a popular text arrives, my table combs through early manuscripts and secondary compendiums, searching for earliest citations, tracking textual variants, and distinguishing genuine prophetic core phrasing from later accretions.

[AUDIO CUE: SOFT PENCIL TAP / DESK PAPERS]

DR. LAYLA: Greetings, everyone! I am Dr. Layla al-Qasimi, Senior Transmission Specialist at the Isnad Table. My task is rigorously analyzing the chain of transmitters. I verify direct audition, scrutinize transmission terminology, and cross-reference geographic timelines to identify severed chains or isolated transmitters.

SHEIKH IMRAN: Peace be upon you all. I am Sheikh Imran al-Hasani, Biographical Critic at the Rijal Table. At my table, we open the grand registers of Jarh wa Ta'dil. We examine whether a narrator was praised for veracity or condemned for weakness, delusion, or active fabrication.

DR. ZAINAB: Hello, listeners! I am Dr. Zainab al-Mubarak, Lead Investigator at the Shawahid and Matn Table. My table examines the internal coherence of the text, screening for hidden defects ('Ilal), checking whether parallel authentic chains exist, and ensuring harmony with established Islamic tenets.

SHEIKH YUSUF: Assalamu alaikum. I am Sheikh Yusuf al-Azhari, Comparative Grading Jurist. My table gathers verdicts across centuries—from the early Hadith masters through medieval encyclopedists down to modern specialists.

[AUDIO CUE: DRAMATIC DRUM THUD]

BROTHER FEROZ (HOST): The full scholarly council is ready! Dr. Tariq, start us off with the Arabic recitation and source breakdown.

DR. TARIQ: Bismillah. The slogan circulated among the public claims the Prophet said: اطْلُبُوا الْعِلْمَ وَلَوْ بِالصِّينِ (Uṭlubū al-'ilma wa law bi-ṣ-Ṣīn). Meaning: "Seek knowledge even unto China." Our Takhrij sweep located this wording in Al-Mu'jam al-Awsat by Al-Tabarani and Shu'ab al-Iman by Al-Bayhaqi. But here is the critical discovery: while the second phrase—طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ (Ṭalabu al-'ilmi farīḍatun 'alā kulli muslim)—meaning "seeking knowledge is an obligation upon every Muslim," is substantiated in Sunan Ibn Majah through sound parallel routes, the addition "even unto China" only ever appears in critically wounded chains!

DR. LAYLA: And from the Isnad table, Brother Feroz, the chain carrying the "China" clause completely disintegrates upon one single transmitter: Abu Atikah Tarif ibn Salman, claiming to narrate from the venerable Companion Anas ibn Malik. Every single route referencing China passes through Abu Atikah!

SHEIKH IMRAN: Brother Feroz, this is an open-and-shut case of fabricated attribution! Imam al-Bukhari stated unequivocally in his Tarikh: "Munkar al-Hadith"—his narrations are rejected! Abu Hatim al-Razi declared his hadith worthless, and Al-Sulaymani revealed that Abu Atikah was infamous for fabricating narrations and falsely attributing them to Anas ibn Malik! He is Matruk—completely abandoned by scholars.

DR. ZAINAB: And Brother Feroz, our Matn and Shawahid inspection reveals that the wording "even unto China" reflects medieval folklore metaphors rather than authentic 7th-century prophetic eloquence. It has zero authentic supporting chains!

SHEIKH YUSUF: Precisely, Brother Feroz and Dr. Zainab! That is why Imam Ibn al-Jawzi categorized it in Al-Mawdu'at as an outright forgery; Imam al-Bayhaqi labeled it false; and Shaykh al-Albani confirmed that the China addition is Mawdu' (Fabricated).

BROTHER FEROZ (HOST): A crucial distinction between true prophetic guidance and later folk fabrications! The Dragon Dawwa Engine calculates a PURITY CONFIDENCE SCORE of 11.2% — FABRICATED / DEFECTIVE ADDITION. Thank you to our brilliant panel—Dr. Tariq, Dr. Layla, Sheikh Imran, Dr. Zainab, and Sheikh Yusuf! Thank you listeners for tuning into Dragon Dawwa Live!

[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]`
      }
    }
  }
];
