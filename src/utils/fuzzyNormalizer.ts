import { FuzzyNormalizationResult, BenchmarkCorpusItem } from '../types/normalization';

export const BENCHMARK_CORPUS: BenchmarkCorpusItem[] = [
  {
    id: "saturday_fast",
    title: "Prohibition of Fasting on Saturdays",
    tag: "Fiqh & Contested Chains",
    score: "54.5%",
    scoreValue: 54.5,
    scoreType: "warning",
    matn: "Do not fast on Saturdays except for what has been made obligatory for you; and if one of you finds nothing but a grape skin or a twig of a tree, let him chew it.",
    isnad: "Qutaybah -> Yahya ibn Hamza -> Thawran ibn Yazid -> Khalid ibn Ma'dan -> 'Abdullah ibn Busr -> His sister (Al-Samma')",
    category: "Fiqh & Contested Chains (Abu Dawud, Al-Tirmidhi)"
  },
  {
    id: "intentions",
    title: "Actions are by Intentions",
    tag: "Foundational Muttafaq 'Alayh",
    score: "100.0%",
    scoreValue: 100.0,
    scoreType: "success",
    matn: "Actions are by intentions, and every person will have only what they intended. So whoever migrated for the sake of Allah and His Messenger...",
    isnad: "Bukhari -> Humaydi -> Sufyan -> Yahya ibn Sa'id -> Muhammad ibn Ibrahim -> 'Alqamah -> 'Umar ibn al-Khattab",
    category: "Muttafaq 'Alayh (Sahih al-Bukhari #1, Sahih Muslim #1907)"
  },
  {
    id: "china_knowledge",
    title: "Seek Knowledge Even Unto China",
    tag: "Famous Fabricated / Severely Defective Report",
    score: "11.2%",
    scoreValue: 11.2,
    scoreType: "danger",
    matn: "Seek knowledge even if you have to go as far as China, for seeking knowledge is an obligation upon every Muslim.",
    isnad: "Abu 'Atikah Tarif ibn Sulayman -> Anas ibn Malik",
    category: "Fabricated / Severely Weak (Ibn al-Jawzi, Al-Dhahabi)"
  }
];

// Mapping common transliterations and synonyms
const CANONICAL_KNOWLEDGE_BASE = [
  {
    id: "intentions",
    aliases: [
      "actions are by intentions",
      "deeds are according to intentions",
      "innama al-a'malu bi al-niyyat",
      "innamal a'malu binniyat",
      "actions are judged by motives",
      "umar intentions hadith",
      "bukhari 1"
    ],
    arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
    english: "Actions are by intentions, and each person will be judged according to what they intended.",
    primarySource: "Sahih al-Bukhari (1), Sahih Muslim (1907)",
    isnad: "Al-Humaydi -> Sufyan -> Yahya ibn Sa'id al-Ansari -> Muhammad ibn Ibrahim al-Taymi -> 'Alqamah ibn Waqqas -> 'Umar ibn al-Khattab"
  },
  {
    id: "saturday_fast",
    aliases: [
      "do not fast on saturdays",
      "fasting on saturday",
      "prohibition of saturday fast",
      "la tasumu yawm al-sabt",
      "la tasumu yawmas sabti",
      "grape skin twig chew it",
      "abdullah ibn busr sister"
    ],
    arabic: "لا تَصُومُوا يَوْمَ السَّبْتِ إِلاَّ فِيمَا افْتُرِضَ عَلَيْكُمْ",
    english: "Do not fast on Saturdays except for what has been made obligatory for you; and if one of you finds nothing but a grape skin or a twig of a tree, let him chew it.",
    primarySource: "Sunan Abi Dawud (2421), Jami' at-Tirmidhi (744)",
    isnad: "Qutaybah -> Yahya ibn Hamza -> Thawran ibn Yazid -> Khalid ibn Ma'dan -> 'Abdullah ibn Busr -> His sister (Al-Samma')"
  },
  {
    id: "china_knowledge",
    aliases: [
      "seek knowledge even unto china",
      "seek knowledge even in china",
      "utlubul ilma walaw bissin",
      "utlub al-'ilm walaw bi-s-sin",
      "knowledge china hadith",
      "china hadith"
    ],
    arabic: "اُطْلُبُوا العِلْمَ وَلَوْ بِالصِّينِ فَإِنَّ طَلَبَ العِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ",
    english: "Seek knowledge even if you have to go as far as China, for seeking knowledge is an obligation upon every Muslim.",
    primarySource: "Al-Uqayli (Al-Du'afa), Ibn al-Jawzi (Al-Mawdu'at)",
    isnad: "Abu 'Atikah Tarif ibn Sulayman -> Anas ibn Malik"
  }
];

/**
 * Levenshtein distance calculation for fuzzy matching
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculates similarity ratio between two strings (0.0 to 1.0)
 */
function similarityRatio(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

/**
 * Fuzzy normalization engine for queries, detecting typos, transliterations, and canonical intent.
 */
export function normalizeHadithQuery(input: string): FuzzyNormalizationResult | null {
  const cleanInput = input.trim().toLowerCase();
  if (cleanInput.length < 3) return null;

  let bestMatch: typeof CANONICAL_KNOWLEDGE_BASE[0] | null = null;
  let highestScore = 0;
  const appliedCorrections: { original: string; corrected: string }[] = [];

  for (const item of CANONICAL_KNOWLEDGE_BASE) {
    // Check aliases
    for (const alias of item.aliases) {
      if (cleanInput.includes(alias) || alias.includes(cleanInput)) {
        const score = Math.max(0.85, similarityRatio(cleanInput, alias));
        if (score > highestScore) {
          highestScore = score;
          bestMatch = item;
        }
      } else {
        const sim = similarityRatio(cleanInput, alias);
        if (sim > highestScore && sim > 0.45) {
          highestScore = sim;
          bestMatch = item;
        }
      }
    }

    // Direct token overlap
    const inputWords = cleanInput.split(/\s+/).filter(w => w.length > 3);
    for (const word of inputWords) {
      for (const alias of item.aliases) {
        if (alias.includes(word)) {
          if (highestScore < 0.70) {
            highestScore = 0.70;
            bestMatch = item;
          }
        }
      }
    }
  }

  if (bestMatch && highestScore >= 0.48) {
    return {
      raw_input: input,
      matched_hadith_id: bestMatch.id,
      canonical_arabic: bestMatch.arabic,
      canonical_english: bestMatch.english,
      canonical_primary_source: bestMatch.primarySource,
      canonical_isnad: bestMatch.isnad,
      fuzzy_similarity_ratio: Math.round(highestScore * 100) / 100,
      detected_intents: ["Hadith Authentication", "Takhrij Cross-Reference", "Isnad Verification"],
      spelling_corrections_applied: appliedCorrections,
      is_close_match: true
    };
  }

  return null;
}
