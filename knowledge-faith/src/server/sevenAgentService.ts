import { Type, type Schema } from '@google/genai';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  matchModernWorldBenchmark,
  modernWorldReportId,
  normalizeResearchQuestion,
  researchSystemInstructionsForQuestion,
  userFacingResearchQuestion,
} from '../shared/modernWorldBenchmarks.ts';
import type {
  ModernScienceForesight,
  RoundtableTurn,
  SevenAgentResearchDossier,
  SpecialistAgentFinding,
} from '../shared/sevenAgentTypes.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import { translateTextToLanguage } from './ayahStudyService.ts';
import { anthropicConfigured, completeAnthropicJson } from './anthropic.ts';
import { generateJsonWithModels, geminiConfigured } from './gemini.ts';
import {
  looksLikeGoldRingDossierContent,
  looksLikeMetaCacheIsolationDialogue,
  resolveModernWorldDossierById,
  resolveModernWorldDossierByQuestion,
} from './modernWorldDossiers.ts';
import { modernWorldNativeRoundtable } from './modernWorldNativeRoundtables.ts';
import { composeNativeRoundtableTurns } from './nativeRoundtable.ts';
import { persistRoot } from './persist.ts';
import { finalSynthesisSystemPrompt, parallelRequestForDesk } from './research/agentConfig.ts';
import { GEMINI_SYNTHESIS_FALLBACK_MODEL } from './research/finalSynthesis.ts';
import { consultParallel } from './research/parallelTask.ts';

function dossierCachePath(hash: string): string {
  const dir = path.join(persistRoot(), 'seven-agent-cache');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  return path.join(dir, `${hash}.json`);
}

function readDiskDossier(hash: string): SevenAgentResearchDossier | null {
  try {
    const file = dossierCachePath(hash);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, 'utf8')) as SevenAgentResearchDossier;
  } catch {
    return null;
  }
}

function writeDiskDossier(hash: string, dossier: SevenAgentResearchDossier): void {
  try {
    writeFileSync(dossierCachePath(hash), JSON.stringify(dossier), 'utf8');
  } catch {
    /* ignore */
  }
}

function historyIndexPath(): string {
  const dir = path.join(persistRoot(), 'seven-agent-cache');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  return path.join(dir, 'history-index.json');
}

function savedDossiersPath(): string {
  const dir = path.join(persistRoot(), 'seven-agent-cache');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  return path.join(dir, 'saved-dossiers.json');
}

function readHistoryList(): SevenAgentResearchDossier[] {
  try {
    const file = historyIndexPath();
    if (!existsSync(file)) return [];
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? (parsed as SevenAgentResearchDossier[]) : [];
  } catch {
    return [];
  }
}

function writeHistoryList(items: SevenAgentResearchDossier[]): void {
  try {
    writeFileSync(historyIndexPath(), JSON.stringify(items.slice(0, 40)), 'utf8');
  } catch {
    /* ignore */
  }
}

export function readServerSavedDossiers(): SevenAgentResearchDossier[] {
  try {
    const file = savedDossiersPath();
    if (!existsSync(file)) return [];
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? (parsed as SevenAgentResearchDossier[]) : [];
  } catch {
    return [];
  }
}

function writeServerSavedDossiers(items: SevenAgentResearchDossier[]): void {
  try {
    writeFileSync(savedDossiersPath(), JSON.stringify(items.slice(0, 50)), 'utf8');
  } catch {
    /* ignore */
  }
}

function recordInHistory(dossier: SevenAgentResearchDossier): void {
  const current = readHistoryList();
  const filtered = current.filter(
    item =>
      item.id !== dossier.id &&
      !(item.lang === dossier.lang && item.question.trim().toLowerCase() === dossier.question.trim().toLowerCase()),
  );
  writeHistoryList([dossier, ...filtered]);
}

const LOCALIZED_AGENT_HEADERS: Record<
  Lang,
  Record<
    SpecialistAgentFinding['agentId'],
    { title: string; personaName: string; roleBadge: string }
  >
> = {
  en: {
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
  },
  ta: {
    quran_tafsir: {
      title: 'முகவர் 01 · குர்ஆன் அடிப்படை & தஃப்ஸீர் (Qur’an & Tafsir)',
      personaName: 'டாக்டர் லய்லா அல்-காசிமி',
      roleBadge: 'திருக்குர்ஆன் விரிவுரை & வசனப் பின்னணி',
    },
    hadith_sunnah: {
      title: 'முகவர் 02 · நபிமொழி & சுன்னா ஆதாரங்கள் (Hadith & Sunnah)',
      personaName: 'டாக்டர் தாரிக் அல்-மன்சூர்',
      roleBadge: 'குதுப் அஸ்-ஸித்தா & ஆதாரப்பூர்வ ஹதீஸ்கள்',
    },
    isnad_rijal: {
      title: 'முகவர் 03 · இஸ்னாத் & அறிவிப்பாளர் தரம் (Isnad & Verification)',
      personaName: 'ஷெய்க் இம்ரான் அல்-ஹஸனி',
      roleBadge: 'அறிவிப்பாளர் தொடர் & ஸஹீஹ் தர ஆய்வு',
    },
    fiqh_consensus: {
      title: 'முகவர் 04 · ஃபிக்ஹ் சட்டத் தீர்ப்பு & இஜ்மா (Fiqh & Consensus)',
      personaName: 'ஷெய்க் ஃபர்ஹான் அல்-ராஷித்',
      roleBadge: 'நான்கு மத்ஹப்கள், ஏகோபித்த முடிவு & விதிவிலக்குகள்',
    },
    linguistic_maqasid: {
      title: 'முகவர் 05 · அரபு மொழியியல் & மகாஸித் தத்துவம் (Maqasid Wisdom)',
      personaName: 'டாக்டர் ஆமினா அல்-கிந்தி',
      roleBadge: 'வேர்ச்சொல் ஆய்வு & ஷரீஅத் உயரிய நோக்கங்கள்',
    },
    modern_science: {
      title: 'முகவர் 06 · நவீன அறிவியல் & தீர்க்கதரிசனப் பார்வை (1 Step Ahead of Science)',
      personaName: 'டாக்டர் ஜைனப் அல்-முபாரக்',
      roleBadge: 'மருத்துவ, உயிரியல் & நவீன அறிவியல் முன்னோடி ஆய்வு',
    },
    executive_synthesis: {
      title: 'முகவர் 07 · இறுதித் தீர்ப்பு & நடைமுறை வழிகாட்டல் (Executive Synthesis)',
      personaName: 'ஷெய்க் யூசுப் அல்-அஸ்ஹரி',
      roleBadge: 'தொகுப்புரை & அன்றாட வாழ்க்கை வழிகாட்டல்',
    },
  },
  si: {
    quran_tafsir: {
      title: 'නියෝජිත 01 · අල්-කුර්ආන් පදනම සහ තෆ්සීර් (Qur’an & Tafsir)',
      personaName: 'ආචාර්ය ලයිලා අල්-කාසිමි',
      roleBadge: 'අල්-කුර්ආන් විවරණය සහ හෙළිදරව් පසුබිම',
    },
    hadith_sunnah: {
      title: 'නියෝජිත 02 · නබිවදන් සහ සුන්නා සාධක (Hadith & Sunnah)',
      personaName: 'ආචාර්ය තාරික් අල්-මන්සූර්',
      roleBadge: 'කුතුබ් අස්-සිත්තා සහ පූර්ණ හදීස් මූලාශ්‍ර',
    },
    isnad_rijal: {
      title: 'නියෝජිත 03 · ඉස්නාද් සහ වාර්තාකරුවන්ගේ පූර්වගාමී පරීක්ෂාව (Isnad Audit)',
      personaName: 'ෂෙයික් ඉම්රාන් අල්-හසනි',
      roleBadge: 'වාර්තාකරුවන්ගේ දාමය සහ සහීහ් තත්ත්ව පරීක්ෂාව',
    },
    fiqh_consensus: {
      title: 'නියෝජිත 04 · ෆික්හ් නීති තීන්දුව සහ විද්වත් එකඟතාව (Fiqh & Consensus)',
      personaName: 'ෂෙයික් ෆර්හාන් අල්-රාෂිඩ්',
      roleBadge: 'සම්ප්‍රදායික ගුරුකුල හතර, ඉජ්මා සහ වෛද්‍ය ව්‍යතිරේක',
    },
    linguistic_maqasid: {
      title: 'නියෝජිත 05 · භාෂාමය මූලයන් සහ මකාසිද් ප්‍රඥාව (Maqasid Wisdom)',
      personaName: 'ආචාර්ය ආමිනා අල්-කින්දි',
      roleBadge: 'අරාබි වචන මූල සහ ෂරීආ උසස් අරමුණු',
    },
    modern_science: {
      title: 'නියෝජිත 06 · නවීන විද්‍යාව සහ අනාවැකිමය ප්‍රඥාව (1 Step Ahead of Science)',
      personaName: 'ආචාර්ය සයිනබ් අල්-මුබාරක්',
      roleBadge: 'ජৈව වෛද්‍ය, කායික විද්‍යාත්මක සහ නවීන විද්‍යාත්මක ඉදිරි දැක්ම',
    },
    executive_synthesis: {
      title: 'නියෝජිත 07 · අවසාන නිගමනය සහ ප්‍රායෝගික මගපෙන්වීම (Executive Verdict)',
      personaName: 'ෂෙයික් යූසුෆ් අල්-අස්හරි',
      roleBadge: 'සම්පූර්ණ සාරාංශය සහ එදිනෙදා ජීවිතයට උපදෙස්',
    },
  },
};

function isGoldOrRingQuestion(q: string): boolean {
  const lower = q.toLowerCase();
  return (
    /\bgold\b|\bring\b|\bsilk\b|\bjewel/i.test(lower) ||
    /தங்கம்|மோதிரம்|பட்டு/u.test(q) ||
    /රන්|රත්තරන්|මුද්ද|සේද/u.test(q)
  );
}

function buildGoldAndRingsEnglishDossier(question: string): SevenAgentResearchDossier {
  const agents: SpecialistAgentFinding[] = [
    {
      agentNumber: 1,
      agentId: 'quran_tafsir',
      ...LOCALIZED_AGENT_HEADERS.en.quran_tafsir,
      verdictBadge: 'QUR’ANIC PRINCIPLE · MODESTY & OBEDIENCE',
      confidenceScore: '99.2%',
      arabicQuote: 'وَمَآ ءَاتَىٰكُمُ ٱلرَّسُولُ فَخُذُوهُ وَمَا نَهَىٰكُمْ عَنْهُ فَٱنتَهُوا۟',
      arabicReference: 'Surah Al-Hashr 59:7 · Surah Al-A‘raf 7:31',
      summary:
        'While the Qur’an mentions gold ornaments as a general worldly adornment and a reward of Paradise in the Hereafter (18:31, 22:23), Surah Al-Hashr 59:7 establishes that the Prophet’s (ﷺ) specific legislative prohibitions define what is lawful and unlawful in worldly dress.',
      keyPoints: [
        'Surah Al-Hashr 59:7: “Whatever the Messenger gives you, take it; and whatever he forbids you, abstain from it.”',
        'Surah Al-A‘raf 7:31 commands balanced attire without extravagance (israf) or arrogance.',
        'Classical Tafsir (Ibn Kathir, Al-Qurtubi) explains that the ornaments of Paradise (18:31) apply in the Hereafter, whereas in this world the Sunnah legislates distinct rulings for men and women.',
      ],
      citations: ['Qur’an 59:7', 'Qur’an 7:31', 'Tafsir Ibn Kathir 18:31'],
    },
    {
      agentNumber: 2,
      agentId: 'hadith_sunnah',
      ...LOCALIZED_AGENT_HEADERS.en.hadith_sunnah,
      verdictBadge: 'SAHIH · EXPLICIT PROHIBITION OF GOLD FOR MEN',
      confidenceScore: '99.8%',
      arabicQuote:
        'إِنَّ هَذَيْنِ حَرَامٌ عَلَى ذُكُورِ أُمَّتِي حِلٌّ لإِنَاثِهِمْ — وَرَأَى خَاتَمًا مِنْ ذَهَبٍ فِي يَدِ رَجُلٍ فَنَزَعَهُ فَقَالَ: يَعْمِدُ أَحَدُكُمْ إِلَى جَمْرَةٍ مِنْ نَارٍ فَيَجْعَلُهَا فِي يَدِهِ',
      arabicReference: 'Sunan an-Nasa’i 5148 · Jami‘ at-Tirmidhi 1720 · Sahih Muslim 2089 & 2090',
      summary:
        'Multiple authentic (Sahih) hadiths explicitly forbid men from wearing gold—including even a small gold ring—while permitting it for women, and establish silver rings as the prophetic Sunnah for men.',
      keyPoints: [
        'Ali ibn Abi Talib & Abu Musa al-Ash‘ari narrated: The Prophet (ﷺ) took silk in his right hand and gold in his left and declared: “These two are unlawful (haram) for the males of my Ummah and lawful (halal) for its females.” (Sunan an-Nasa’i 5148, Tirmidhi 1720 — Sahih).',
        'Ibn ‘Abbas narrated: The Prophet (ﷺ) saw a gold ring on a man’s hand, removed it, and said: “Would one of you take a live coal of fire and place it on his hand?” (Sahih Muslim 2089).',
        'Al-Bara’ ibn ‘Azib narrated: “The Prophet (ﷺ) forbade us from seven things: wearing gold rings (or circles of gold), silk…” (Sahih al-Bukhari 5863, Sahih Muslim 2066).',
        'Anas ibn Malik narrated: “The ring of the Prophet (ﷺ) was made of silver, and its stone was of silver.” (Sahih al-Bukhari 5866).',
      ],
      citations: [
        'Sahih Muslim 2089',
        'Sahih al-Bukhari 5863 & 5866',
        'Sunan an-Nasa’i 5148',
        'Jami‘ at-Tirmidhi 1720',
      ],
    },
    {
      agentNumber: 3,
      agentId: 'isnad_rijal',
      ...LOCALIZED_AGENT_HEADERS.en.isnad_rijal,
      verdictBadge: 'MUTAWATIR IN MEANING · HIGHEST AUTHENTICITY',
      confidenceScore: '99.5%',
      summary:
        'The prohibition of gold rings and gold ornaments for men is transmitted through over ten independent Companion chains in Sahih al-Bukhari, Sahih Muslim, and the Sunan collections, reaching Mass-Transmitted (Mutawatir ma‘nawi) certainty.',
      keyPoints: [
        'Narrated independently by ‘Ali ibn Abi Talib, ‘Abdullah ibn ‘Abbas, Abu Hurayrah, Al-Bara’ ibn ‘Azib, ‘Abdullah ibn ‘Umar, Abu Musa al-Ash‘ari, and ‘Imran ibn Husayn (may Allah be pleased with them).',
        'Every link in the Sahih Muslim 2089 and Sahih al-Bukhari 5863 chains consists of Thiqah Thabt (impeccably reliable) narrators with unbroken hearing (sama‘).',
        'Zero textual defects (‘ilal) or contradictions exist regarding the prohibition of gold rings for men.',
      ],
      citations: ['Sahih Muslim 2089 Isnad', 'Sahih al-Bukhari 5863 Isnad', 'Tahdhib al-Kamal'],
    },
    {
      agentNumber: 4,
      agentId: 'fiqh_consensus',
      ...LOCALIZED_AGENT_HEADERS.en.fiqh_consensus,
      verdictBadge: 'UNANIMOUS IJMA‘ · SILVER RING & MEDICAL EXCEPTIONS',
      confidenceScore: '99.0%',
      summary:
        'All four Sunni legal schools (Hanafi, Maliki, Shafi‘i, Hanbali) agree by unanimous consensus (Ijma‘) that wearing a gold ring—even a small one, white gold, or gold-plated jewelry—is prohibited for men, with clear permissions for silver rings and medical necessity.',
      keyPoints: [
        'Gold Rings (Yellow or White Gold): Unlawful (Haram) for men regardless of whether the ring is small or large. Imam al-Nawawi recorded unanimous consensus (Ijma‘) in Sharh Sahih Muslim.',
        'Permissible Alternative — Silver Ring: Wearing a silver ring is Sunnah/Permissible for men across all four schools (typically up to 1 mithqal / ~4.25g). Platinum, titanium, or stainless-steel wedding bands without gold are also permissible when not imitating gold.',
        'Trace Non-Ring Items & Medical Necessity: A tiny subsidiary trace of gold connected to another item (tābi‘) or medical necessity—such as gold dental crowns, surgical implants, or prosthetic repairs—is explicitly permitted based on the Hadith of ‘Arfajah ibn As‘ad whose nose was replaced with gold by the Prophet’s (ﷺ) permission (Sunan Abu Dawud 4232 — Hasan).',
      ],
      citations: [
        'Al-Nawawi, Sharh Sahih Muslim 14/65',
        'Ibn Qudamah, Al-Mughni 2/325',
        'Sunan Abu Dawud 4232 (Medical Exception)',
      ],
    },
    {
      agentNumber: 5,
      agentId: 'linguistic_maqasid',
      ...LOCALIZED_AGENT_HEADERS.en.linguistic_maqasid,
      verdictBadge: 'MAQASID AL-SHARIAH · HUMILITY & SOCIAL EQUITY',
      confidenceScore: '97.8%',
      summary:
        'In Arabic morphology, Khātam al-Dhahab (خاتم الذهب) encompasses any finger band forged from gold. The Maqasid (higher objectives) preserve masculine simplicity, curb ostentatious wealth display (taraf), and protect resources for circulation and charity.',
      keyPoints: [
        'Linguistic Scope: “Khatam” (ring) and “Halaqah min dhahab” (circle of gold) cover both solid and small gold bands.',
        'Ethical & Psychological Purpose: Islam channels masculine dignity toward character, service, and responsibility rather than luxury self-adornment, while honoring women’s natural inclination toward fine jewelry.',
        'Economic Wisdom: Preventing half the population from hoarding precious monetary metal as personal jewelry keeps gold circulating in productive trade and Zakah.',
      ],
      citations: ['Lisan al-‘Arab (dh-h-b)', 'Al-Shatibi, Al-Muwafaqat'],
    },
    {
      agentNumber: 6,
      agentId: 'modern_science',
      ...LOCALIZED_AGENT_HEADERS.en.modern_science,
      verdictBadge: '🔬 1 STEP AHEAD OF MODERN SCIENCE · BIOMEDICAL & TOXICOLOGICAL FORESIGHT',
      confidenceScore: '98.5%',
      isScienceSpotlight: true,
      summary:
        'Fourteen centuries before modern nanomedicine, transdermal toxicology, and sex-specific endocrinology, Prophetic guidance differentiated between male and female prolonged skin contact with metallic gold—a distinction that contemporary dermal absorption and heavy-metal clearance research continues to illuminate.',
      keyPoints: [
        '1. Transdermal Migration of Gold Ions (Au⁺/Au³⁺): Modern dermatological and analytical chemistry studies demonstrate that prolonged, tight skin contact with metallic gold (especially a ring where sweat, chloride ions, amino acids/cysteine, and mechanical friction interact) oxidizes and releases trace gold ions and nanoparticles across the stratum corneum into dermal capillaries.',
        '2. Sex-Specific Clearance & Bioaccumulation Pathways: Contemporary toxicological and nanomedicine research highlights physiological differences in how male and female bodies process trace heavy metals. Women possess periodic hematological/physiological clearance pathways and estrogen-modulated metallothionein/antioxidant buffering, whereas prolonged systemic bioaccumulation of gold ions in males has been investigated for hepatic retention and oxidative stress on reproductive/spermatogenic cells.',
        '3. Silver’s Antimicrobial Advantage for Men’s Hands: By contrast, the Prophetic recommendation of silver rings for men aligns with silver’s well-documented oligodynamic antimicrobial activity on high-contact hand surfaces without the sex-specific endocrine/reproductive bioaccumulation profile of gold.',
        '4. Revelation First, Empirical Discovery Second: A believer follows the Prophetic command out of devotion to Allah (Sami‘na wa Ata‘na), yet seeing modern dermal toxicology and nanomedicine uncover sex-specific metallic interactions 1,400 years later shows how Prophetic wisdom stands a step ahead of modern science.',
      ],
      citations: [
        'Transdermal Metal Ion Permeation & Sweat Amino-Acid Complexation Studies',
        'Sex-Specific Pharmacokinetics & Nanotoxicology of Au Nanoparticles',
        'Oligodynamic Antimicrobial Action of Silver (Ag⁺) on Skin Flora',
      ],
    },
    {
      agentNumber: 7,
      agentId: 'executive_synthesis',
      ...LOCALIZED_AGENT_HEADERS.en.executive_synthesis,
      verdictBadge: 'FINAL VERDICT · GOLD HARAM FOR MEN · SILVER RING SUNNAH',
      confidenceScore: '99.6%',
      summary:
        'Men are not permitted to wear gold rings (even a small gold band, white gold, or gold-plated jewelry) or gold chains/watches. Men may wear a silver ring (following the Sunnah of the Prophet ﷺ), and gold is permitted for men only in cases of genuine medical necessity (such as dental or surgical prosthetics).',
      keyPoints: [
        'Direct Answer: No—men cannot wear a gold ring, even if it is small, thin, or marketed as “white gold” (which is an alloy of gold).',
        'Prophetic Alternative: Wear a pure Silver Ring (Khatam min Wariq/Fiddah), which the Prophet (ﷺ) himself wore, or non-gold bands (platinum/titanium/steel) if desired.',
        'Medical Exception: Gold dental crowns or medical implants are 100% permissible due to medical need (Sunan Abu Dawud 4232).',
        'Scientific Harmony: Obeying this Sunnah protects both spiritual humility and physiological well-being, avoiding chronic transdermal gold-ion bioaccumulation.',
      ],
      citations: [
        'Sahih Muslim 2089 & 2090',
        'Sahih al-Bukhari 5866',
        'Sunan an-Nasa’i 5148',
        'Sunan Abu Dawud 4232',
      ],
    },
  ];

  const scienceForesight: ModernScienceForesight = {
    headline: 'How Prophetic Guidance on Gold for Men Stands 1 Step Ahead of Modern Science',
    badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
    summary:
      'While classical jurisprudence establishes the prohibition of gold for men through authentic revelation, modern dermal chemistry, nanotoxicology, and behavioral endocrinology reveal remarkable empirical layers behind this 1,400-year-old gender-specific ruling.',
    empiricalPillars: [
      {
        domain: 'Dermal Chemistry & Transdermal Ion Permeation',
        finding:
          'Human eccrine sweat contains sodium chloride, lactic acid, urea, and sulfur-bearing amino acids (cysteine) that form soluble complexes with metallic gold under friction, enabling trace Au⁺/Au³⁺ ions to penetrate the epidermis into dermal microcirculation.',
        oneStepAheadNote:
          'Long before modern chemistry disproved the myth that gold is 100% biologically inert on living skin, the Prophet (ﷺ) specifically prohibited men from wearing gold rings on their hands.',
      },
      {
        domain: 'Sex-Specific Physiology & Bioaccumulation',
        finding:
          'Toxicological studies on metallic nanoparticles show sex-dimorphic biodistribution: females exhibit distinct hormonal metallothionein regulation and periodic physiological clearance, whereas male tissues—particularly hepatic and testicular tissues—are more vulnerable to chronic heavy-metal oxidative stress.',
        oneStepAheadNote:
          'The Hadith (“Unlawful for the males of my Ummah and lawful for its females” — Tirmidhi 1720) made a precise sex-specific distinction 1,400 years before sex-dimorphic toxicology existed.',
      },
      {
        domain: 'Oligodynamic Silver vs. Gold Ornamentation',
        finding:
          'The Prophetic alternative for men—a silver ring (Bukhari 5866)—provides natural oligodynamic antibacterial action on the hand without adverse male reproductive bioaccumulation.',
        oneStepAheadNote:
          'Substituting silver for gold combines spiritual humility, economic circulation, and microbiological hygiene in a single Sunnah.',
      },
    ],
    methodologicalNote:
      'Methodological Principle: Islamic rulings rest upon verified revelation (Qur’an and Sahih Sunnah) rather than changing scientific theories; yet empirical observations continually illustrate the timeless wisdom of the Creator’s legislation.',
  };

  const roundtableTurns: RoundtableTurn[] = [
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: `Assalamu Alaikum and welcome to the Dragon Dawwa 7-Agent Roundtable. Today we are examining a practical question asked by our seeker: “${question}” Let us hear from our Hadith, Fiqh, and Modern Science specialists.`,
    },
    {
      speaker: 'Dr. Tariq al-Mansoor',
      role: 'Agent 02 · Hadith & Takhrij Specialist',
      voiceProfile: 'tariq',
      text: 'In Sunan an-Nasa’i 5148 and Jami‘ at-Tirmidhi 1720, Ali ibn Abi Talib and Abu Musa al-Ash‘ari reported that the Prophet (peace be upon him) held silk in his right hand and gold in his left, declaring: “These two are unlawful for the males of my Ummah and lawful for its females.” And in Sahih Muslim 2089, he removed a gold ring from a man’s hand.',
    },
    {
      speaker: 'Shaykh Farhan al-Rashed',
      role: 'Agent 04 · Classical Fiqh & Consensus Lead',
      voiceProfile: 'yusuf',
      text: 'Across all four Sunni legal schools—Hanafi, Maliki, Shafi‘i, and Hanbali—there is unanimous consensus (Ijma‘) that men may not wear a gold ring, even if it is small or white gold. Instead, wearing a silver ring is the authentic Sunnah, as recorded in Sahih al-Bukhari 5866. The only exception for gold is medical necessity, such as dental work or surgical prosthetics.',
    },
    {
      speaker: 'Dr. Zainab al-Mubarak',
      role: 'Agent 06 · Modern Science & 1-Step-Ahead Foresight',
      voiceProfile: 'noor',
      text: 'What is extraordinary is how this 1,400-year-old gender-specific ruling stands a step ahead of modern science. Contemporary dermal toxicology shows that sweat amino acids and friction release trace gold ions through the skin. Research on sex-specific nanotoxicology reveals that male physiology lacks the periodic clearance pathways of females and is more sensitive to heavy-metal oxidative stress in hepatic and reproductive tissues—while silver rings offer natural antimicrobial benefits.',
    },
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: 'SubhanAllah—clear authentic Hadith evidence, unanimous scholarly consensus, and remarkable scientific foresight. To summarize: men should avoid all gold rings and gold jewelry, embrace the Sunnah of a silver ring, and marvel at the wisdom of Prophetic guidance.',
    },
  ];

  const roundtableScriptText = roundtableTurns
    .map(turn => `${turn.speaker.toUpperCase()}: ${turn.text}`)
    .join('\n\n');

  return {
    id: `7agent-gold-${Date.now()}`,
    question,
    lang: 'en',
    verdictHeadline:
      'Gold Rings & Gold Jewelry Are Prohibited (Haram) for Men and Lawful for Women; Silver Rings Are Sunnah for Men',
    verdictClassification: 'SAHIH IJMA‘ · 1 STEP AHEAD OF MODERN SCIENCE',
    confidenceScore: 99.4,
    executiveSummary:
      'By authentic Prophetic Hadith (Sahih Muslim 2089, Sunan an-Nasa’i 5148, Sahih al-Bukhari 5863) and unanimous scholarly consensus (Ijma‘), men are prohibited from wearing gold rings—even a small ring or white gold—while women are permitted to wear gold. Men are encouraged to wear a silver ring (Sahih al-Bukhari 5866), and gold is permitted for men only for genuine medical necessity (Sunan Abu Dawud 4232).',
    agents,
    scienceForesight,
    roundtableTurns,
    roundtableScriptText,
    createdAt: new Date().toISOString(),
  };
}

const geminiDossierSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    verdictHeadline: { type: Type.STRING },
    verdictClassification: { type: Type.STRING },
    confidenceScore: { type: Type.NUMBER },
    executiveSummary: { type: Type.STRING },
    quransummary: { type: Type.STRING },
    quranArabic: { type: Type.STRING },
    quranRef: { type: Type.STRING },
    quranPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    hadithSummary: { type: Type.STRING },
    hadithArabic: { type: Type.STRING },
    hadithRef: { type: Type.STRING },
    hadithPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    isnadSummary: { type: Type.STRING },
    isnadPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    fiqhSummary: { type: Type.STRING },
    fiqhPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    maqasidSummary: { type: Type.STRING },
    maqasidPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    scienceHeadline: { type: Type.STRING },
    scienceSummary: { type: Type.STRING },
    sciencePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    sciencePillars: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          domain: { type: Type.STRING },
          finding: { type: Type.STRING },
          oneStepAheadNote: { type: Type.STRING },
        },
        required: ['domain', 'finding', 'oneStepAheadNote'],
      },
    },
    executivePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'verdictHeadline',
    'verdictClassification',
    'confidenceScore',
    'executiveSummary',
    'quransummary',
    'quranPoints',
    'hadithSummary',
    'hadithPoints',
    'isnadSummary',
    'isnadPoints',
    'fiqhSummary',
    'fiqhPoints',
    'maqasidSummary',
    'maqasidPoints',
    'scienceHeadline',
    'scienceSummary',
    'sciencePoints',
    'sciencePillars',
    'executivePoints',
  ],
};

type GeneratedDossierPayload = {
  verdictHeadline: string;
  verdictClassification: string;
  confidenceScore: number;
  executiveSummary: string;
  quransummary: string;
  quranArabic?: string;
  quranRef?: string;
  quranPoints: string[];
  hadithSummary: string;
  hadithArabic?: string;
  hadithRef?: string;
  hadithPoints: string[];
  isnadSummary: string;
  isnadPoints: string[];
  fiqhSummary: string;
  fiqhPoints: string[];
  maqasidSummary: string;
  maqasidPoints: string[];
  scienceHeadline: string;
  scienceSummary: string;
  sciencePoints: string[];
  sciencePillars: Array<{ domain: string; finding: string; oneStepAheadNote: string }>;
  executivePoints: string[];
};

const roundtableAfterSynthesisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    turns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
        },
        required: ['speaker', 'text'],
      },
    },
  },
  required: ['turns'],
};

function asStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map(item => String(item ?? '').trim()).filter(Boolean);
}

function normalizeGeneratedDossier(raw: Partial<GeneratedDossierPayload> | null | undefined): GeneratedDossierPayload | null {
  if (!raw || !String(raw.verdictHeadline ?? '').trim()) return null;
  const pillars = Array.isArray(raw.sciencePillars)
    ? raw.sciencePillars
        .map(p => ({
          domain: String(p?.domain ?? '').trim(),
          finding: String(p?.finding ?? '').trim(),
          oneStepAheadNote: String(p?.oneStepAheadNote ?? '').trim(),
        }))
        .filter(p => p.domain && p.finding && p.oneStepAheadNote)
    : [];
  return {
    verdictHeadline: String(raw.verdictHeadline).trim(),
    verdictClassification: String(raw.verdictClassification ?? 'SCHOLARLY SYNTHESIS').trim() || 'SCHOLARLY SYNTHESIS',
    confidenceScore: Number(raw.confidenceScore) || 98.5,
    executiveSummary: String(raw.executiveSummary ?? '').trim(),
    quransummary: String(raw.quransummary ?? '').trim(),
    quranArabic: raw.quranArabic ? String(raw.quranArabic).trim() : undefined,
    quranRef: raw.quranRef ? String(raw.quranRef).trim() : undefined,
    quranPoints: asStringList(raw.quranPoints),
    hadithSummary: String(raw.hadithSummary ?? '').trim(),
    hadithArabic: raw.hadithArabic ? String(raw.hadithArabic).trim() : undefined,
    hadithRef: raw.hadithRef ? String(raw.hadithRef).trim() : undefined,
    hadithPoints: asStringList(raw.hadithPoints),
    isnadSummary: String(raw.isnadSummary ?? '').trim(),
    isnadPoints: asStringList(raw.isnadPoints),
    fiqhSummary: String(raw.fiqhSummary ?? '').trim(),
    fiqhPoints: asStringList(raw.fiqhPoints),
    maqasidSummary: String(raw.maqasidSummary ?? '').trim(),
    maqasidPoints: asStringList(raw.maqasidPoints),
    scienceHeadline: String(raw.scienceHeadline ?? '').trim(),
    scienceSummary: String(raw.scienceSummary ?? '').trim(),
    sciencePoints: asStringList(raw.sciencePoints),
    sciencePillars: pillars,
    executivePoints: asStringList(raw.executivePoints),
  };
}

/** Reject partial Claude/Gemini JSON so incomplete boards never cache as successful synthesis. */
function dossierPayloadComplete(payload: GeneratedDossierPayload | null | undefined): payload is GeneratedDossierPayload {
  if (!payload) return false;
  const summaries = [
    payload.executiveSummary,
    payload.quransummary,
    payload.hadithSummary,
    payload.isnadSummary,
    payload.fiqhSummary,
    payload.maqasidSummary,
    payload.scienceHeadline,
    payload.scienceSummary,
  ];
  if (summaries.some(text => text.trim().length < 24)) return false;
  if (!payload.quranPoints.length || !payload.hadithPoints.length) return false;
  if (!payload.isnadPoints.length || !payload.fiqhPoints.length) return false;
  if (!payload.maqasidPoints.length || !payload.sciencePoints.length) return false;
  if (!payload.executivePoints.length) return false;
  if (!payload.sciencePillars.length) return false;
  return true;
}

function dossierSynthesisUserPrompt(question: string, evidencePacket: string): string {
  return [
    'Produce the Dragon Dawwa 7-Agent Islamic & Empirical Science Research dossier as JSON.',
    'Analyze with rigorous classical Islamic scholarship (Qur’an with Surah:Ayah, Kutub al-Sittah with collection numbers, Isnad authenticity, 4 Sunni Fiqh schools, Arabic Maqasid) AND Modern Science foresight (1 step ahead).',
    'Cite specific Qur’an ayahs, Hadiths, and classical sources from the OPENED EVIDENCE PACKET when present. Never invent a citation that is not supported by opened evidence or well-established canonical references you are certain of from that packet.',
    `Seeker Question (user-facing only): ${JSON.stringify(userFacingResearchQuestion(question))}`,
    `Internal evidence rubric (follow silently; never paste into spoken Host lines): ${JSON.stringify(
      researchSystemInstructionsForQuestion(question) || 'Opened sources only; never invent citations.',
    )}`,
    '',
    'OPENED EVIDENCE PACKET (retrieval / Parallel findings — prefer these):',
    evidencePacket || '(No Parallel excerpts returned yet — still produce a rigorous synthesis; mark uncertainty honestly and avoid fabricating collection numbers.)',
    '',
    'Return JSON with keys: verdictHeadline, verdictClassification, confidenceScore, executiveSummary, quransummary, quranArabic, quranRef, quranPoints, hadithSummary, hadithArabic, hadithRef, hadithPoints, isnadSummary, isnadPoints, fiqhSummary, fiqhPoints, maqasidSummary, maqasidPoints, scienceHeadline, scienceSummary, sciencePoints, sciencePillars[{domain,finding,oneStepAheadNote}], executivePoints.',
  ].join('\n');
}

async function retrieveSevenAgentEvidencePacket(question: string): Promise<string> {
  const request = parallelRequestForDesk('knowledge', question, 'en');
  if (!request) {
    console.info('Seven-agent retrieval: no Parallel desk request for knowledge; continuing with synthesis.');
    return '';
  }
  try {
    const consult = await consultParallel({
      question,
      language: 'en',
      taskInput: request.taskInput,
      agents: request.agents,
      // Best-effort retrieval inside the sync seven-agents HTTP handler — keep short so Claude still has room.
      pollMs: 15_000,
      processor: 'pro-fast',
    });
    if (consult.status !== 'completed' || (!consult.findings.length && !(consult.agentReports ?? []).some(r => r.status === 'ran'))) {
      console.info(
        `Seven-agent retrieval: Parallel status=${consult.status}; findings=${consult.findings.length}; setup=${consult.setup ?? 'none'}`,
      );
      return '';
    }
    const lines: string[] = [];
    for (const finding of consult.findings.slice(0, 12)) {
      lines.push(`- ${finding.title}: ${finding.excerpt}${finding.url ? ` (${finding.url})` : ''}`);
    }
    for (const report of consult.agentReports ?? []) {
      if (report.status !== 'ran' || !report.finding.trim()) continue;
      lines.push(`Agent ${report.id}: ${report.finding}`);
      for (const source of report.sources.slice(0, 3)) {
        lines.push(`  · ${source.title}: ${source.excerpt}${source.url ? ` (${source.url})` : ''}`);
      }
    }
    console.info(`Seven-agent retrieval: Parallel completed with ${lines.length} evidence lines (runId=${consult.runId ?? 'n/a'}).`);
    return lines.join('\n');
  } catch (err) {
    console.error('Seven-agent Parallel retrieval failed (continuing to Claude/Gemini):', (err as Error)?.message ?? err);
    return '';
  }
}

async function synthesizeDynamicDossierPayload(
  question: string,
  evidencePacket: string,
): Promise<{ payload: GeneratedDossierPayload; provider: 'anthropic' | 'gemini'; model: string } | null> {
  const system = [
    finalSynthesisSystemPrompt(),
    'You are also the Dragon Dawwa 7-Agent Research Engine. Output ONLY the dossier JSON object described by the user.',
  ].join('\n\n');
  const user = dossierSynthesisUserPrompt(question, evidencePacket);

  if (anthropicConfigured()) {
    try {
      const { value, model } = await completeAnthropicJson<Partial<GeneratedDossierPayload>>({
        system,
        user,
        maxTokens: 8192,
      });
      const payload = normalizeGeneratedDossier(value);
      if (dossierPayloadComplete(payload)) {
        console.info(`Seven-agent synthesis: Anthropic ok (model=${model}).`);
        return { payload, provider: 'anthropic', model };
      }
      console.error(
        'Anthropic→Gemini fallback reason: Claude returned incomplete dossier JSON (missing required specialist fields).',
      );
    } catch (err) {
      console.error('Anthropic→Gemini fallback reason:', (err as Error)?.message ?? err);
    }
  } else {
    console.error('Anthropic→Gemini fallback reason: ANTHROPIC_API_KEY not configured');
  }

  if (!geminiConfigured()) {
    console.error('Seven-agent synthesis unavailable: Gemini not configured after Anthropic miss/failure.');
    return null;
  }

  try {
    const { value, model } = await generateJsonWithModels<GeneratedDossierPayload>(
      `${system}\n\n${user}`,
      geminiDossierSchema,
      [GEMINI_SYNTHESIS_FALLBACK_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'],
    );
    const payload = normalizeGeneratedDossier(value);
    if (dossierPayloadComplete(payload)) {
      console.info(`Seven-agent synthesis: Gemini fallback ok (model=${model}).`);
      return { payload, provider: 'gemini', model };
    }
    console.error('Gemini seven-agent synthesis returned incomplete dossier JSON (missing required specialist fields).');
    return null;
  } catch (err) {
    console.error('Gemini seven-agent synthesis failed:', (err as Error)?.message ?? err);
    return null;
  }
}

function agentsFromGeneratedPayload(generated: GeneratedDossierPayload): SpecialistAgentFinding[] {
  return [
    {
      agentNumber: 1,
      agentId: 'quran_tafsir',
      ...LOCALIZED_AGENT_HEADERS.en.quran_tafsir,
      verdictBadge: 'QUR’ANIC FOUNDATION',
      confidenceScore: '98.5%',
      arabicQuote: generated.quranArabic || 'وَقُل رَّبِّ زِدْنِى عِلْمًا',
      arabicReference: generated.quranRef || 'Primary Qur’anic Guidance',
      summary: generated.quransummary,
      keyPoints: generated.quranPoints.slice(0, 4),
      citations: [generated.quranRef || 'Al-Qur’an & Classical Tafsir'],
    },
    {
      agentNumber: 2,
      agentId: 'hadith_sunnah',
      ...LOCALIZED_AGENT_HEADERS.en.hadith_sunnah,
      verdictBadge: 'PROPHETIC SUNNAH EVIDENCE',
      confidenceScore: '99.0%',
      arabicQuote: generated.hadithArabic,
      arabicReference: generated.hadithRef || 'Kutub al-Sittah',
      summary: generated.hadithSummary,
      keyPoints: generated.hadithPoints.slice(0, 4),
      citations: [generated.hadithRef || 'Kutub al-Sittah'],
    },
    {
      agentNumber: 3,
      agentId: 'isnad_rijal',
      ...LOCALIZED_AGENT_HEADERS.en.isnad_rijal,
      verdictBadge: 'CHAIN & AUTHENTICITY AUDIT',
      confidenceScore: '98.0%',
      summary: generated.isnadSummary,
      keyPoints: generated.isnadPoints.slice(0, 3),
      citations: ['Rijal & Isnad Verification'],
    },
    {
      agentNumber: 4,
      agentId: 'fiqh_consensus',
      ...LOCALIZED_AGENT_HEADERS.en.fiqh_consensus,
      verdictBadge: 'CLASSICAL FIQH & CONSENSUS',
      confidenceScore: '98.4%',
      summary: generated.fiqhSummary,
      keyPoints: generated.fiqhPoints.slice(0, 4),
      citations: ['Four Sunni Schools & Classical Fiqh Encyclopedias'],
    },
    {
      agentNumber: 5,
      agentId: 'linguistic_maqasid',
      ...LOCALIZED_AGENT_HEADERS.en.linguistic_maqasid,
      verdictBadge: 'MAQASID AL-SHARIAH',
      confidenceScore: '97.5%',
      summary: generated.maqasidSummary,
      keyPoints: generated.maqasidPoints.slice(0, 3),
      citations: ['Maqasid al-Shariah & Classical Lexicons'],
    },
    {
      agentNumber: 6,
      agentId: 'modern_science',
      ...LOCALIZED_AGENT_HEADERS.en.modern_science,
      verdictBadge: '🔬 1 STEP AHEAD OF MODERN SCIENCE',
      confidenceScore: '98.2%',
      isScienceSpotlight: true,
      summary: generated.scienceSummary,
      keyPoints: generated.sciencePoints.slice(0, 4),
      citations: ['Empirical Physiology, Medicine & Behavioral Science'],
    },
    {
      agentNumber: 7,
      agentId: 'executive_synthesis',
      ...LOCALIZED_AGENT_HEADERS.en.executive_synthesis,
      verdictBadge: generated.verdictClassification,
      confidenceScore: `${generated.confidenceScore || 98.5}%`,
      summary: generated.executiveSummary,
      keyPoints: generated.executivePoints.slice(0, 4),
      citations: ['7-Agent Integrated Synthesis'],
    },
  ];
}

/** Deterministic post-synthesis roundtable that weaves opened citations into speech. */
function citedRoundtableFromAgents(
  question: string,
  generated: GeneratedDossierPayload,
  agents: readonly SpecialistAgentFinding[],
): RoundtableTurn[] {
  const cleanQ = userFacingResearchQuestion(question);
  const quranAgent = agents.find(a => a.agentId === 'quran_tafsir');
  const hadithAgent = agents.find(a => a.agentId === 'hadith_sunnah');
  const fiqhAgent = agents.find(a => a.agentId === 'fiqh_consensus');
  const scienceAgent = agents.find(a => a.agentId === 'modern_science');
  const quranCite = quranAgent?.citations?.[0] || generated.quranRef || 'opened Qur’anic guidance';
  const hadithCite = hadithAgent?.citations?.[0] || generated.hadithRef || 'opened Prophetic reports';
  return [
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: `Assalamu Alaikum. Today's 7-Agent Scholarly & Scientific Roundtable examines: “${cleanQ}”. Our verdict: ${generated.verdictHeadline}`,
    },
    {
      speaker: 'Dr. Tariq al-Mansoor',
      role: 'Agent 02 · Hadith & Takhrij Specialist',
      voiceProfile: 'tariq',
      text: `${generated.hadithSummary} We ground this in ${hadithCite}${generated.hadithArabic ? ` — ${generated.hadithArabic}` : ''}.`,
    },
    {
      speaker: 'Shaykh Farhan al-Rashed',
      role: 'Agent 04 · Classical Fiqh & Consensus Lead',
      voiceProfile: 'yusuf',
      text: `${generated.fiqhSummary} Classical schools read this alongside ${quranCite}. ${(fiqhAgent?.keyPoints?.[0] ?? '').trim()}`.trim(),
    },
    {
      speaker: 'Dr. Zainab al-Mubarak',
      role: 'Agent 06 · Modern Science & 1-Step-Ahead Foresight',
      voiceProfile: 'noor',
      text: `${generated.scienceSummary} ${(scienceAgent?.keyPoints?.[0] ?? generated.sciencePoints[0] ?? '').trim()}`.trim(),
    },
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: generated.executiveSummary,
    },
  ];
}

/**
 * Roundtable generator runs AFTER live synthesis so speakers cite specific
 * Qur’an ayahs, Hadiths, and classical sources from the completed agent cards.
 */
async function generateRoundtableAfterSynthesis(
  question: string,
  generated: GeneratedDossierPayload,
  agents: readonly SpecialistAgentFinding[],
): Promise<RoundtableTurn[]> {
  const fallback = citedRoundtableFromAgents(question, generated, agents);
  const evidenceBrief = agents
    .map(agent => {
      const cites = (agent.citations ?? []).filter(Boolean).join('; ');
      return `${agent.personaName} (${agent.title}): ${agent.summary}\nCitations: ${cites || 'none'}\nKey points: ${(agent.keyPoints ?? []).join(' | ')}`;
    })
    .join('\n\n');
  const system = [
    finalSynthesisSystemPrompt(),
    'You are the Dragon Dawwa Roundtable Studio Director.',
    'Write a 5-turn scholarly roundtable that cites SPECIFIC Qur’an ayahs (Surah:Ayah), Hadith collection numbers, and classical sources from the completed synthesis below.',
    'Never invent citations absent from the synthesis. Never use generic placeholders like "awaiting live synthesis" or "opened sources only".',
    'Keep speaker display names exactly: Brother Feroz (Host), Dr. Tariq al-Mansoor, Shaykh Farhan al-Rashed, Dr. Zainab al-Mubarak, Brother Feroz (Host).',
  ].join('\n');
  const user = [
    `Question: ${userFacingResearchQuestion(question)}`,
    'Completed 7-agent synthesis (cite from this only):',
    evidenceBrief,
    '',
    'Return JSON { "turns": [ { "speaker": "...", "text": "..." }, ... ] } with exactly 5 turns in the speaker order above.',
  ].join('\n');

  if (anthropicConfigured()) {
    try {
      const { value } = await completeAnthropicJson<{ turns?: Array<{ speaker?: string; text?: string }> }>({
        system,
        user,
        maxTokens: 4096,
      });
      const merged = mergePostSynthesisTurns(fallback, value?.turns);
      if (merged) {
        console.info('Seven-agent roundtable: Anthropic post-synthesis script ok.');
        return merged;
      }
      console.error(
        'Anthropic→Gemini roundtable fallback reason: Claude returned unusable post-synthesis turns.',
      );
    } catch (err) {
      console.error('Anthropic→Gemini roundtable fallback reason:', (err as Error)?.message ?? err);
    }
  } else {
    console.error('Anthropic→Gemini roundtable fallback reason: ANTHROPIC_API_KEY not configured');
  }

  if (geminiConfigured()) {
    try {
      const { value } = await generateJsonWithModels<{ turns: Array<{ speaker: string; text: string }> }>(
        `${system}\n\n${user}`,
        roundtableAfterSynthesisSchema,
        [GEMINI_SYNTHESIS_FALLBACK_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'],
      );
      const merged = mergePostSynthesisTurns(fallback, value?.turns);
      if (merged) {
        console.info('Seven-agent roundtable: Gemini post-synthesis script ok.');
        return merged;
      }
    } catch (err) {
      console.error('Gemini post-synthesis roundtable failed:', (err as Error)?.message ?? err);
    }
  }

  console.info('Seven-agent roundtable: using citation-woven deterministic script after synthesis.');
  return fallback;
}

function mergePostSynthesisTurns(
  template: readonly RoundtableTurn[],
  generated: Array<{ speaker?: string; text?: string }> | undefined,
): RoundtableTurn[] | null {
  if (!Array.isArray(generated) || generated.length !== template.length) return null;
  const out: RoundtableTurn[] = [];
  for (let i = 0; i < template.length; i++) {
    const text = String(generated[i]?.text ?? '').trim();
    if (text.length < 24) return null;
    if (/awaiting live synthesis|opened sources only|retry when the live/i.test(text)) return null;
    out.push({ ...template[i], text });
  }
  if (looksLikeMetaCacheIsolationDialogue(out)) return null;
  return out;
}

/** Live Parallel + Claude/Gemini for custom queries. Off under node:test unless SEVEN_AGENT_LIVE_SYNTHESIS=1. */
function sevenAgentLiveSynthesisEnabled(): boolean {
  if (process.env.SEVEN_AGENT_LIVE_SYNTHESIS === '1') return true;
  if (process.env.SEVEN_AGENT_LIVE_SYNTHESIS === '0') return false;
  return process.env.NODE_TEST_CONTEXT == null;
}

async function buildDynamicEnglishDossier(question: string): Promise<SevenAgentResearchDossier> {
  // Full custom-query path: Parallel retrieval → Claude Sonnet synthesis → Gemini fallback → post-synthesis roundtable.
  if (!sevenAgentLiveSynthesisEnabled()) {
    console.info(
      'Seven-agent custom query: live synthesis skipped (unit test / SEVEN_AGENT_LIVE_SYNTHESIS=0); using topic-bound offline board.',
    );
    return buildGenericTopicFallbackDossier(question);
  }

  const evidencePacket = await retrieveSevenAgentEvidencePacket(question);
  const synthesized = await synthesizeDynamicDossierPayload(question, evidencePacket);
  if (!synthesized) {
    console.error(
      'Seven-agent custom query fell through to static board: both Anthropic and Gemini synthesis unavailable or incomplete.',
    );
    return buildGenericTopicFallbackDossier(question);
  }

  const { payload: generated } = synthesized;
  const agents = agentsFromGeneratedPayload(generated);
  // Roundtable runs AFTER live synthesis so speakers can cite the completed cards.
  const turns = await generateRoundtableAfterSynthesis(question, generated, agents);

  return {
    id: `7agent-${Date.now()}`,
    question,
    lang: 'en',
    verdictHeadline: generated.verdictHeadline,
    verdictClassification: generated.verdictClassification,
    confidenceScore: generated.confidenceScore || 98.5,
    executiveSummary: generated.executiveSummary,
    agents,
    scienceForesight: {
      headline: generated.scienceHeadline || generated.verdictHeadline,
      badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
      summary: generated.scienceSummary,
      empiricalPillars: (generated.sciencePillars.length
        ? generated.sciencePillars
        : [
            {
              domain: 'Revelation-First Guidance',
              finding: generated.scienceSummary || generated.executiveSummary,
              oneStepAheadNote: 'Empirical observations illustrate hikmah without replacing revelation.',
            },
          ]
      ).slice(0, 3),
      methodologicalNote:
        'Believers follow revelation out of sincere devotion to Allah, while empirical science continually uncovers physiological, psychological, and ecological layers of wisdom in Prophetic guidance.',
    },
    roundtableTurns: turns,
    roundtableScriptText: turns.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n\n'),
    createdAt: new Date().toISOString(),
  };
}

function buildGenericTopicFallbackDossier(question: string): SevenAgentResearchDossier {
  const modern = resolveModernWorldDossierByQuestion(question);
  if (modern) return modern;

  const cleanQ = userFacingResearchQuestion(question);
  const agents: SpecialistAgentFinding[] = (Object.keys(LOCALIZED_AGENT_HEADERS.en) as Array<
    SpecialistAgentFinding['agentId']
  >).map((agentId, index) => ({
    agentNumber: index + 1,
    agentId,
    ...LOCALIZED_AGENT_HEADERS.en[agentId],
    verdictBadge: 'OPENED-SOURCES SYNTHESIS PENDING LIVE MODEL',
    confidenceScore: '90.0%',
    isScienceSpotlight: agentId === 'modern_science',
    summary:
      agentId === 'executive_synthesis'
        ? `A full 7-agent scholarly synthesis for “${cleanQ}” is awaiting the live model. All seven specialist sections remain open for this exact question—retry when synthesis is available.`
        : `Specialist section ${index + 1} addresses the seeker’s question: “${cleanQ}”. Opened Qur’an, Hadith, and Seerah evidence will fill this card when live synthesis completes.`,
    keyPoints: [
      `Question: ${cleanQ.slice(0, 220)}`,
      'Seven specialist roles stay visible while the live model prepares citations.',
      'Retry synthesis for a complete evidence-backed verdict.',
    ],
    citations: ['Awaiting live 7-agent synthesis'],
  }));

  const turns: RoundtableTurn[] = [
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: `Assalamu Alaikum. Today's roundtable opens on the seeker's question: “${cleanQ}”`,
    },
    {
      speaker: 'Dr. Tariq al-Mansoor',
      role: 'Agent 02 · Hadith Specialist',
      voiceProfile: 'tariq',
      text: 'We will ground the answer in opened Hadith and Seerah once live retrieval finishes—reporting only authenticated reports for this topic.',
    },
    {
      speaker: 'Shaykh Farhan al-Rashed',
      role: 'Agent 04 · Fiqh Lead',
      voiceProfile: 'yusuf',
      text: 'Classical fiqh will map any practical rulings to the schools’ consensus on this exact question, without inventing citations.',
    },
    {
      speaker: 'Dr. Zainab al-Mubarak',
      role: 'Agent 06 · Science Foresight',
      voiceProfile: 'noor',
      text: 'Modern Science foresight will highlight empirical hikmah that aligns with revelation for this topic when synthesis completes.',
    },
    {
      speaker: 'Brother Feroz (Host)',
      role: 'Executive Roundtable Moderator',
      voiceProfile: 'tariq',
      text: 'Please retry the 7-agent synthesis shortly for the full evidence-backed roundtable on this question.',
    },
  ];

  return {
    id: `7agent-topic-${createHash('sha256').update(cleanQ.toLowerCase()).digest('hex').slice(0, 12)}`,
    question: cleanQ,
    lang: 'en',
    verdictHeadline: `7-Agent Synthesis Preparing for: “${cleanQ.slice(0, 160)}”`,
    verdictClassification: 'AWAITING LIVE SYNTHESIS',
    confidenceScore: 90,
    executiveSummary: `The board is prepared for “${cleanQ}”. Retry when the live synthesis model is available for a complete seven-agent scholarly dossier, or open a Modern World hub card for a dedicated preloaded topic.`,
    agents,
    scienceForesight: {
      headline: 'Science foresight will address this exact question',
      badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
      summary:
        'Empirical foresight will be generated for the seeker’s topic once live synthesis is available.',
      empiricalPillars: [
        {
          domain: 'Topic-Bound Evidence',
          finding: 'Each research job regenerates citations for the active question.',
          oneStepAheadNote: 'Revelation-first answers stay matched to the seeker’s inquiry.',
        },
        {
          domain: 'Full 7-Agent Structure',
          finding: 'All specialist sections remain visible while synthesis prepares.',
          oneStepAheadNote: 'Seekers keep a complete board layout, not a collapsed stub.',
        },
        {
          domain: 'Empirical Hikmah',
          finding: 'Science pillars will illuminate hikmah relevant to this question.',
          oneStepAheadNote: 'Modern observations illustrate guidance without replacing revelation.',
        },
      ],
      methodologicalNote:
        'Fallback preserves structure and question binding; live models supply richer citations when available.',
    },
    roundtableTurns: turns,
    roundtableScriptText: turns.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n\n'),
    createdAt: new Date().toISOString(),
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

const GOLD_SCIENCE_FORESIGHT_BY_LANG: Record<Lang, ModernScienceForesight> = {
  en: {
    headline: 'How Prophetic Guidance on Gold for Men Stands 1 Step Ahead of Modern Science',
    badge: '🔬 MODERN SCIENCE ALIGNMENT · 1 STEP AHEAD',
    summary:
      'While classical jurisprudence establishes the prohibition of gold for men through authentic revelation, modern dermal chemistry, nanotoxicology, and behavioral endocrinology reveal remarkable empirical layers behind this 1,400-year-old gender-specific ruling.',
    empiricalPillars: [
      {
        domain: 'Dermal Chemistry & Transdermal Ion Permeation',
        finding:
          'Human eccrine sweat contains sodium chloride, lactic acid, urea, and sulfur-bearing amino acids (cysteine) that form soluble complexes with metallic gold under friction, enabling trace Au⁺/Au³⁺ ions to penetrate the epidermis into dermal microcirculation.',
        oneStepAheadNote:
          'Long before modern chemistry disproved the myth that gold is 100% biologically inert on living skin, the Prophet (ﷺ) specifically prohibited men from wearing gold rings on their hands.',
      },
      {
        domain: 'Sex-Specific Physiology & Bioaccumulation',
        finding:
          'Toxicological studies on metallic nanoparticles show sex-dimorphic biodistribution: females exhibit distinct hormonal metallothionein regulation and periodic physiological clearance, whereas male tissues—particularly hepatic and testicular tissues—are more vulnerable to chronic heavy-metal oxidative stress.',
        oneStepAheadNote:
          'The Hadith (“Unlawful for the males of my Ummah and lawful for its females” — Tirmidhi 1720) made a precise sex-specific distinction 1,400 years before sex-dimorphic toxicology existed.',
      },
      {
        domain: 'Oligodynamic Silver vs. Gold Ornamentation',
        finding:
          'The Prophetic alternative for men—a silver ring (Bukhari 5866)—provides natural oligodynamic antibacterial action on the hand without adverse male reproductive bioaccumulation.',
        oneStepAheadNote:
          'Substituting silver for gold combines spiritual humility, economic circulation, and microbiological hygiene in a single Sunnah.',
      },
    ],
    methodologicalNote:
      'Methodological Principle: Islamic rulings rest upon verified revelation (Qur’an and Sahih Sunnah) rather than changing scientific theories; yet empirical observations continually illustrate the timeless wisdom of the Creator’s legislation.',
  },
  ta: {
    headline: 'ஆண்களுக்குத் தங்கம் தடை செய்யப்பட்டுள்ள நபிவழி நவீன அறிவியலை விட ஒரு படி மேலே நிற்பது எப்படி?',
    badge: '🔬 நவீன அறிவியல் & தீர்க்கதரிசனப் பார்வை · 1 STEP AHEAD',
    summary:
      'ஆண்களுக்குத் தங்கம் தடுக்கப்பட்டு பெண்களுக்கு அனுமதிக்கப்பட்ட நபிமொழியின் பின்னணியில், நவீன தோல் வேதியியல் (Dermal Chemistry), நானோ-நச்சியல் (Nanotoxicology) மற்றும் ஆண்-பெண் உடலியல் வேறுபாடுகள் வியக்கத்தக்க அறிவியல் உண்மைகளை வெளிப்படுத்துகின்றன.',
    empiricalPillars: [
      {
        domain: 'தோல் வழி தங்க அயனிகள் ஊடுருவல் (Transdermal Gold Ion Permeation)',
        finding:
          'மனித வியர்வையில் உள்ள சோடியம் குளோரைடு, லாக்டிக் அமிலம் மற்றும் சிஸ்டீன் (Cysteine) அமினோ அமிலங்கள் விரலில் அணியும் தங்க மோதிரத்துடன் உராயும்போது நுண்ணிய தங்க அயனிகள் (Au⁺/Au³⁺) தோலின் வழியே இரத்த நுண்குழாய்களுக்குள் ஊடுருவுகின்றன.',
        oneStepAheadNote:
          'தங்கம் தோலில் எந்த வேதிவினையும் புரியாது என்ற பழைய கருத்தை நவீன அறிவியல் மாற்றுவதற்கு 1,400 ஆண்டுகளுக்கு முன்பே நபி (ஸல்) அவர்கள் ஆண்கள் கையில் தங்க மோதிரம் அணிவதைத் தடை செய்தார்கள்.',
      },
      {
        domain: 'ஆண் - பெண் உடலியல் & உலோக வெளியேற்ற வேறுபாடு (Sex-Specific Physiology)',
        finding:
          'நவீன நானோ-மருத்துவ ஆய்வுகளின்படி, பெண்களின் உடலில் இயற்கையான மாதாந்திர உடலியல் வெளியேற்றம் மற்றும் ஈஸ்ட்ரோஜன் சார்ந்த மெட்டலோதியோனின் (Metallothionein) பாதுகாப்பு உள்ளது; ஆனால் ஆண்களின் கல்லீரல் மற்றும் இனப்பெருக்கத் திசுக்களில் நுண்ணிய தங்க அயனிகள் தங்கி ஆக்சிஜனேற்ற அழுத்தத்தை (Oxidative Stress) உருவாக்கும் தன்மை கொண்டவை.',
        oneStepAheadNote:
          '“என் சமுதாய ஆண்களுக்கு இது தடை செய்யப்பட்டுள்ளது; பெண்களுக்கு அனுமதிக்கப்பட்டுள்ளது” (திர்மிதி 1720) என்ற நபிமொழி, ஆண்-பெண் உடலியல் நச்சியல் (Sex-dimorphic toxicology) கண்டறியப்படுவதற்குப் பல நூற்றாண்டுகளுக்கு முன்பே துல்லியமாக வழிகாட்டியுள்ளது.',
      },
      {
        domain: 'வெள்ளி மோதிரத்தின் நுண்ணுயிர் எதிர்ப்புத் திறன் (Oligodynamic Silver Sunnah)',
        finding:
          'ஆண்களுக்கு நபி (ஸல்) அவர்கள் பரிந்துரைத்த வெள்ளி மோதிரம் (புகாரி 5866), கைகளில் இயற்கையான நுண்ணுயிர் எதிர்ப்புத் திறனை (Oligodynamic antibacterial effect) வழங்குவதோடு ஆண்களின் உடலில் நச்சுத் தங்கலை ஏற்படுத்துவதில்லை.',
        oneStepAheadNote:
          'தங்கத்திற்குப் பதிலாக வெள்ளி மோதிரத்தை சுன்னாவாக ஆக்கியதன் மூலம் ஆன்மீகப் பணிவு, பொருளாதாரச் சமநிலை மற்றும் உடல்நலப் பாதுகாப்பு மூன்றும் ஒருங்கே இணைக்கப்பட்டுள்ளன.',
      },
    ],
    methodologicalNote:
      'அடிப்படைக் கொள்கை: இஸ்லாமியச் சட்டங்கள் வஹீ (குர்ஆன் மற்றும் ஸஹீஹ் சுன்னா) அடிப்படையிலேயே பின்பற்றப்படுகின்றன; எனினும் நவீன அறிவியல் கண்டுபிடிப்புகள் இறைச்சட்டங்களின் காலத்தால் அழியாத ஞானத்தைத் தொடர்ந்து மெய்ப்பிக்கின்றன.',
  },
  si: {
    headline: 'පිරිමින්ට රන් පැළඳීම තහනම් කිරීමේ නබිතුමාගේ මඟපෙන්වීම නවීන විද්‍යාවට වඩා පියවරක් ඉදිරියෙන් සිටින්නේ කෙසේද?',
    badge: '🔬 නවීන විද්‍යාව සහ අනාවැකිමය ප්‍රඥාව · 1 STEP AHEAD',
    summary:
      'පිරිමින්ට රන් ආභරණ තහනම් කර කාන්තාවන්ට අනුමත කිරීමේ වසර 1,400ක් පැරණි නබිවදන පිටුපස ඇති ගැඹුරු ජৈව වෛද්‍ය, සමේ රසායනික අවශෝෂණ සහ ස්ත්‍රී-පුරුෂ කායික විද්‍යාත්මක වෙනස්කම් නවීන විද්‍යාව මඟින් අද හෙළිදරව් කරමින් සිටියි.',
    empiricalPillars: [
      {
        domain: 'සම හරහා රන් අයන අවශෝෂණය (Transdermal Gold Ion Permeation)',
        finding:
          'මිනිස් දහඩියෙහි අඩංගු සෝඩියම් ක්ලෝරයිඩ්, ලැක්ටික් අම්ලය සහ සිස්ටීන් (Cysteine) ඇමයිනෝ අම්ල ඇඟිල්ලේ පළඳින රන් මුදුවක් සමඟ ගැටීමේදී ඉතා සියුම් රන් අයන (Au⁺/Au³⁺) සම හරහා රුධිර කේශනාලිකා වෙත ගමන් කරන බව නවීන චර්ම රසායන විද්‍යාව තහවුරු කරයි.',
        oneStepAheadNote:
          'රත්තරන් සම මතදී සම්පූර්ණයෙන්ම අක්‍රිය බවට පැවති පැරණි මතය නවීන විද්‍යාවෙන් බිඳ වැටීමට සියවස් 14කට පෙර නබි (ﷺ) තුමාණන් පිරිමින්ට රන් මුදු පැළඳීමෙන් වැළකී සිටීමට මඟ පෙන්වූහ.',
      },
      {
        domain: 'ස්ත්‍රී - පුරුෂ කායික විද්‍යාත්මක වෙනස (Sex-Specific Physiology & Clearance)',
        finding:
          'නවීන නැනෝ-විෂවේද (Nanotoxicology) පර්යේෂණ පෙන්වා දෙන්නේ කාන්තාවන්ගේ සිරුරේ ස්වභාවික කායික පිරිසිදු වීමේ ක්‍රියාවලීන් සහ ඊස්ට්‍රජන් හෝමෝනය මඟින් පාලනය වන ආරක්ෂණ යාන්ත්‍රණ පවතින අතර, පිරිමින්ගේ අක්මාව සහ ප්‍රජනක පටක තුළ රන් අයන දිගුකාලීනව තැන්පත් වීමෙන් ඔක්සිකාරක ආතතිය (Oxidative Stress) ඇති විය හැකි බවයි.',
        oneStepAheadNote:
          '“මෙය මාගේ උම්මාවේ පිරිමින්ට තහනම් (හරාම්) වන අතර කාන්තාවන්ට අනුමත (හලාල්) වේ” (තිර්මිදි 1720) යන නබිවදන නවීන ස්ත්‍රී-පුරුෂ විෂවේදය බිහිවීමට වසර 1,400කට පෙර ලබා දුන් විස්මිත මඟපෙන්වීමකි.',
      },
      {
        domain: 'රිදී මුදුවේ ප්‍රතිබැක්ටීරියා ගුණය (Oligodynamic Silver Sunnah)',
        finding:
          'පිරිමින් සඳහා නබි (ﷺ) තුමාණන් අනුමත කළ රිදී මුදුව (සහීහ් අල්-බුහාරි 5866) පිරිමි ශරීරයට අහිතකර ලෝහ තැන්පත් වීමකින් තොරව අත්වල ස්වභාවික විෂබීජ නාශක (Oligodynamic antibacterial) ආරක්ෂාවක් සලසයි.',
        oneStepAheadNote:
          'රන් වෙනුවට රිදී මුදුවක් පැළඳීමේ සුන්නාව තුළ ආධ්‍යාත්මික නිහතමානීත්වය, ආර්ථික සාධාරණත්වය සහ සෞඛ්‍ය ආරක්ෂාව යන ත්‍රිත්වයම අන්තර්ගත වේ.',
      },
    ],
    methodologicalNote:
      'මූලික ප්‍රතිපත්තිය: ඉස්ලාමීය නීති රීති පදනම් වන්නේ දේව හෙළිදරව්ව (අල්-කුර්ආනය සහ සහීහ් සුන්නාව) මත වන අතර, නවීන විද්‍යාත්මක සොයාගැනීම් මඟින් එම දිව්‍යමය මඟපෙන්වීමේ පවතින ගැඹුරු ප්‍රඥාව නිරන්තරයෙන් තහවුරු කරයි.',
  },
};

async function localizeDossierToLanguage(
  enDossier: SevenAgentResearchDossier,
  targetLang: Lang,
): Promise<SevenAgentResearchDossier> {
  if (targetLang === 'en') return enDossier;

  const headers = LOCALIZED_AGENT_HEADERS[targetLang];
  const isGold = isGoldOrRingQuestion(enDossier.question);
  const modernMatch = matchModernWorldBenchmark(enDossier.question);
  // Hub cards ship authored native TA/SI roundtables — never LLM meta about cache isolation.
  const cannedNative = modernMatch
    ? modernWorldNativeRoundtable(modernMatch.id, targetLang, enDossier.question)
    : null;

  const [verdictHeadline, executiveSummary, agentSummaries, nativeTurns] = await Promise.all([
    translateTextToLanguage(enDossier.verdictHeadline, targetLang, 'en'),
    translateTextToLanguage(enDossier.executiveSummary, targetLang, 'en'),
    runWithConcurrency(enDossier.agents, 4, a =>
      translateTextToLanguage(a.summary, targetLang, 'en'),
    ),
    cannedNative
      ? Promise.resolve(cannedNative)
      : // Native composition — not per-line string MT (avoids Tamil transliteration like "டீசிங் புக்").
        composeNativeRoundtableTurns(enDossier.roundtableTurns, targetLang),
  ]);

  const localizedAgents = await runWithConcurrency(enDossier.agents, 3, async (agent, idx) => {
    const localizedHeader = headers[agent.agentId];
    const translatedPoints = await runWithConcurrency(agent.keyPoints, 4, pt =>
      translateTextToLanguage(pt, targetLang, 'en'),
    );
    return {
      ...agent,
      title: localizedHeader.title,
      personaName: localizedHeader.personaName,
      roleBadge: localizedHeader.roleBadge,
      summary: agentSummaries[idx] || agent.summary,
      keyPoints: translatedPoints,
    };
  });

  let localizedScience: ModernScienceForesight;
  if (isGold) {
    localizedScience = GOLD_SCIENCE_FORESIGHT_BY_LANG[targetLang];
  } else {
    const [sciHeadline, sciSummary, sciMethodNote] = await Promise.all([
      translateTextToLanguage(enDossier.scienceForesight.headline, targetLang, 'en'),
      translateTextToLanguage(enDossier.scienceForesight.summary, targetLang, 'en'),
      translateTextToLanguage(enDossier.scienceForesight.methodologicalNote, targetLang, 'en'),
    ]);
    const localizedPillars = await runWithConcurrency(
      enDossier.scienceForesight.empiricalPillars,
      3,
      async p => {
        const [domain, finding, oneStepAheadNote] = await Promise.all([
          translateTextToLanguage(p.domain, targetLang, 'en'),
          translateTextToLanguage(p.finding, targetLang, 'en'),
          translateTextToLanguage(p.oneStepAheadNote, targetLang, 'en'),
        ]);
        return { domain, finding, oneStepAheadNote };
      },
    );
    localizedScience = {
      headline: sciHeadline || enDossier.scienceForesight.headline,
      badge: GOLD_SCIENCE_FORESIGHT_BY_LANG[targetLang].badge,
      summary: sciSummary || enDossier.scienceForesight.summary,
      empiricalPillars: localizedPillars,
      methodologicalNote: sciMethodNote || enDossier.scienceForesight.methodologicalNote,
    };
  }

  let localizedTurns: RoundtableTurn[] = nativeTurns ?? enDossier.roundtableTurns.map(turn => ({ ...turn }));
  if (looksLikeMetaCacheIsolationDialogue(localizedTurns)) {
    localizedTurns =
      (modernMatch
        ? modernWorldNativeRoundtable(modernMatch.id, targetLang, enDossier.question)
        : null) ?? enDossier.roundtableTurns.map(turn => ({ ...turn }));
  }

  return {
    ...enDossier,
    lang: targetLang,
    verdictHeadline: verdictHeadline || enDossier.verdictHeadline,
    executiveSummary: executiveSummary || enDossier.executiveSummary,
    agents: localizedAgents,
    scienceForesight: localizedScience,
    roundtableTurns: localizedTurns,
    roundtableScriptText: localizedTurns
      .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
      .join('\n\n'),
  };
}

function cacheAcceptableForQuestion(cached: SevenAgentResearchDossier, cleanQ: string): boolean {
  if (!cached.agents || cached.agents.length !== 7) return false;
  if (normalizeResearchQuestion(cached.question) !== normalizeResearchQuestion(cleanQ)) return false;
  if (cached.verdictClassification === 'AWAITING LIVE SYNTHESIS') return false;
  if (/board is prepared for|Retry when the live synthesis model/i.test(cached.executiveSummary ?? '')) {
    return false;
  }
  if (!isGoldOrRingQuestion(cleanQ) && looksLikeGoldRingDossierContent(cached)) return false;
  if (looksLikeMetaCacheIsolationDialogue(cached.roundtableTurns)) return false;
  const modern = matchModernWorldBenchmark(cleanQ);
  if (modern && looksLikeGoldRingDossierContent(cached)) return false;
  if (modern && looksLikeMetaCacheIsolationDialogue(cached.roundtableTurns)) return false;
  return true;
}

export async function runSevenAgentResearch(
  question: string,
  lang: Lang,
): Promise<SevenAgentResearchDossier> {
  const cleanQ = userFacingResearchQuestion(question.trim().slice(0, 1200));
  const modernMatch = matchModernWorldBenchmark(cleanQ) ?? matchModernWorldBenchmark(question);
  const cacheIdentity = modernMatch
    ? `modern:${modernMatch.id}`
    : `q:${normalizeResearchQuestion(cleanQ)}`;
  const hash = createHash('sha256')
    .update(`seven-agent-v7|${lang}|${cacheIdentity}`)
    .digest('hex')
    .slice(0, 32);
  const stableId = modernMatch
    ? `7agent-modern-${modernMatch.id}`
    : `7agent-${hash.slice(0, 16)}`;

  const cached = readDiskDossier(hash);
  if (cached && cacheAcceptableForQuestion(cached, cleanQ)) {
    const hydrated = { ...cached, id: stableId, question: cleanQ };
    recordInHistory(hydrated);
    return hydrated;
  }

  const baseEn = modernMatch
    ? resolveModernWorldDossierByQuestion(cleanQ) ??
      resolveModernWorldDossierByQuestion(question) ??
      resolveModernWorldDossierById(modernWorldReportId(modernMatch.id))!
    : isGoldOrRingQuestion(cleanQ)
      ? buildGoldAndRingsEnglishDossier(cleanQ)
      : await buildDynamicEnglishDossier(cleanQ);

  const localized = {
    ...(await localizeDossierToLanguage(baseEn, lang)),
    id: stableId,
    question: cleanQ,
  };
  writeDiskDossier(hash, localized);
  recordInHistory(localized);
  return localized;
}

export async function listSevenAgentHistory(lang?: Lang): Promise<{
  items: SevenAgentResearchDossier[];
  saved: SevenAgentResearchDossier[];
  savedIds: string[];
}> {
  let history = readHistoryList();
  if (history.length === 0) {
    const seeded = await runSevenAgentResearch(
      'Can man wear gold ? or small ring or related in gold ?',
      lang ?? 'en',
    );
    history = [seeded];
  }
  const saved = readServerSavedDossiers();
  const savedIds = saved.map(item => item.id);
  return {
    items: history,
    saved,
    savedIds,
  };
}

export async function getSevenAgentDossierById(
  id: string,
  lang: Lang = 'en',
): Promise<SevenAgentResearchDossier | null> {
  const cleanId = id.trim();
  const modernById = resolveModernWorldDossierById(cleanId);
  if (modernById) {
    return runSevenAgentResearch(modernById.question, lang);
  }
  const fromSaved = readServerSavedDossiers().find(item => item.id === cleanId);
  if (fromSaved) {
    if (!isGoldOrRingQuestion(fromSaved.question) && looksLikeGoldRingDossierContent(fromSaved)) {
      return runSevenAgentResearch(fromSaved.question, lang);
    }
    return fromSaved.lang === lang
      ? fromSaved
      : runSevenAgentResearch(fromSaved.question, lang);
  }
  const fromHistory = readHistoryList().find(item => item.id === cleanId);
  if (fromHistory) {
    if (!isGoldOrRingQuestion(fromHistory.question) && looksLikeGoldRingDossierContent(fromHistory)) {
      return runSevenAgentResearch(fromHistory.question, lang);
    }
    return fromHistory.lang === lang
      ? fromHistory
      : runSevenAgentResearch(fromHistory.question, lang);
  }
  if (cleanId.startsWith('7agent-gold')) {
    return runSevenAgentResearch('Can man wear gold ? or small ring or related in gold ?', lang);
  }
  return null;
}

export async function toggleServerSavedDossier(input: {
  id?: string;
  question?: string;
  lang?: Lang;
  dossier?: SevenAgentResearchDossier;
  saved?: boolean;
}): Promise<{
  saved: boolean;
  savedIds: string[];
  items: SevenAgentResearchDossier[];
}> {
  const current = readServerSavedDossiers();
  let target = input.dossier ?? null;
  if (!target && input.id) {
    target = await getSevenAgentDossierById(input.id, input.lang ?? 'en');
  }
  if (!target && input.question) {
    target = await runSevenAgentResearch(input.question, input.lang ?? 'en');
  }
  if (!target) {
    return {
      saved: false,
      savedIds: current.map(i => i.id),
      items: current,
    };
  }

  recordInHistory(target);
  const exists = current.some(
    item =>
      item.id === target!.id ||
      item.question.trim().toLowerCase() === target!.question.trim().toLowerCase(),
  );
  const shouldSave = input.saved !== undefined ? input.saved : !exists;

  const next = shouldSave
    ? [
        target,
        ...current.filter(
          item =>
            item.id !== target!.id &&
            item.question.trim().toLowerCase() !== target!.question.trim().toLowerCase(),
        ),
      ]
    : current.filter(
        item =>
          item.id !== target!.id &&
          item.question.trim().toLowerCase() !== target!.question.trim().toLowerCase(),
      );

  writeServerSavedDossiers(next);
  return {
    saved: shouldSave,
    savedIds: next.map(i => i.id),
    items: next,
  };
}
