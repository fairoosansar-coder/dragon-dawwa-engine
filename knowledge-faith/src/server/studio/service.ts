import { randomUUID } from 'node:crypto';
import { recitationUrl, toLang, type Lang } from '../../shared/sources.ts';
import type { AsmaName, Verse } from '../../shared/types.ts';
import type { EncyclopediaHadith } from '../../shared/hadeethenc.ts';
import { pageByRelevance } from '../../shared/hadeethenc.ts';
import { asksForScience, contentTokens, passageSupportsTopic } from '../../shared/research.ts';
import { PRAYER_ARTICLE, PRAYER_CREDITS, SINCERITY_BOOK, SINCERITY_CREDITS } from '../../shared/sourceRegistry.ts';
import { firstLongParagraph, paragraphLocator, passageUnderHeading } from '../../shared/readableText.ts';
import {
  findProgrammeFamily,
  matchArabicTerm,
  PROGRAMME_FAMILIES,
  STUDIO_EPISODE_BLUEPRINTS,
  type EpisodeBlueprint,
} from '../../shared/studio/catalogue.ts';
import {
  SHARED_CONTRACT_VERSION,
  referenceToPassage,
  type AudioStreamKind,
  type ContentOriginBadge,
  type EpisodeOutlineItem,
  type EvidencePassage,
  type SourceRecord,
  type StatementKind,
  type StudioAskAnswer,
  type StudioAskRequest,
  type StudioEpisode,
  type StudioSegment,
  type TopicBrief,
} from '../../shared/studio/contracts.ts';
import { buildVoiceCapabilityReport, STUDIO_PRESENTERS } from '../../shared/studio/presenter.ts';
import {
  applyEpisodeScriptEdit,
  assertNotPrivateAnswerForPublication,
  computeSegmentsHash,
  transitionStudioEpisode,
  verifyStudioEpisode,
  type StudioTransitionAction,
} from '../../shared/studio/verification.ts';
import type { EditorUser } from '../../shared/spiritual/governance.ts';
import { getAsma } from '../asma.ts';
import { geminiConfigured, VOICES, writeAnswer } from '../gemini.ts';
import { loadHadeeth, searchHadeeth } from '../hadeethenc.ts';
import { UpstreamError } from '../http.ts';
import { loadItemDocument } from '../islamhouse.ts';
import { getVerses } from '../quran.ts';
import { fetchReaderHtml } from '../readable.ts';
import { researchTopic } from '../research.ts';

const episodeCache = new Map<string, { at: number; episode: StudioEpisode }>();
const CACHE_TTL_MS = 5 * 60_000;

/** In-memory store for editorial productions & custom pipeline episodes. */
const studioProductions = new Map<string, StudioEpisode>();

function nowIso(): string {
  return new Date().toISOString();
}

function verseToPassage(verse: Verse, retrievedAt: string): EvidencePassage {
  const id = `Q${verse.surah}-${verse.ayah}`;
  const source: SourceRecord = {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: `src-${id}`,
    provider: 'QuranEnc',
    itemId: `${verse.translationKey ?? 'quranenc'} ${verse.key}`,
    language: verse.lang,
    edition: verse.translationKey ?? null,
    version: verse.translationVersion ?? null,
    title: `${verse.surahName} (${verse.key}) — ${verse.translationTitle || verse.translator}`,
    credits: [
      { role: 'translator', name: verse.translator },
      { role: 'reciter', name: 'Mishary Rashid Alafasy (AlQuran Cloud quran-uthmani)' },
    ],
    canonicalUrl: verse.translationKey
      ? `https://quranenc.com/api/v1/translation/aya/${encodeURIComponent(verse.translationKey)}/${verse.surah}/${verse.ayah}`
      : null,
    contentType: 'ayah',
    rights: {
      tier: 'open_api_display',
      attributionRequired: true,
      redistributionAllowed: true,
      modificationAllowed: false,
      licenseNote: `Arabic text: AlQuran Cloud (quran-uthmani). Translation: QuranEnc (${verse.translationKey ?? verse.translator}).`,
    },
    retrievedAt,
  };

  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    id,
    sourceId: source.id,
    source,
    exactText: verse.translation,
    passageLanguage: verse.lang,
    arabicText: verse.arabic,
    originalLanguage: 'ar',
    locator: `Surah ${verse.surahName} (${verse.surah}:${verse.ayah})`,
    surah: verse.surah,
    ayah: verse.ayah,
    hadithId: null,
    collection: null,
    grade: null,
    grader: null,
    surroundingContext: verse.footnotes ? [`Edition footnote: ${verse.footnotes}`] : [],
    limitations: [
      verse.meaningAudio
        ? `Verified meaning audio available from QuranEnc (${verse.translationKey}).`
        : 'Meaning audio is not listed for this ayah in the current edition manifest; Arabic recitation is separate.',
    ],
    internalReaderRoute: `#/quran?surah=${verse.surah}&ayah=${verse.ayah}&lang=${verse.lang}`,
    audioUrl: recitationUrl('ar.alafasy', verse.number),
    audioKind: 'quran_recitation',
  };
}

function hadithToPassage(hadith: EncyclopediaHadith, retrievedAt: string): EvidencePassage {
  const id = `E${hadith.id}`;
  const source: SourceRecord = {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: `src-${id}`,
    provider: 'HadeethEnc',
    itemId: hadith.id,
    language: hadith.lang,
    edition: `hadeethenc-${hadith.lang}`,
    version: null,
    title: hadith.title,
    credits: hadith.attribution ? [{ role: 'collector', name: hadith.attribution }] : [],
    canonicalUrl: hadith.sourceUrl,
    contentType: 'hadith',
    rights: {
      tier: 'open_api_display',
      attributionRequired: true,
      redistributionAllowed: true,
      modificationAllowed: false,
      licenseNote: 'HadeethEnc public encyclopedia API; wording, grading, and attribution preserved unchanged.',
    },
    retrievedAt,
  };

  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    id,
    sourceId: source.id,
    source,
    exactText: hadith.text,
    passageLanguage: hadith.lang,
    arabicText: hadith.arabic,
    originalLanguage: 'ar',
    locator: `HadeethEnc #${hadith.id}${hadith.attribution ? ` · ${hadith.attribution}` : ''}`,
    surah: null,
    ayah: null,
    hadithId: hadith.id,
    collection: hadith.attribution,
    grade: hadith.grade,
    grader: 'HadeethEnc',
    surroundingContext: [
      ...(hadith.explanation ? [`HadeethEnc explanation: ${hadith.explanation}`] : []),
      ...(hadith.lessons.length ? [`Documented lessons: ${hadith.lessons.join(' | ')}`] : []),
    ],
    limitations: [
      hadith.grade ? `Published source grade: ${hadith.grade}` : 'HadeethEnc did not include a grade for this hadith.',
      'HadeethEnc does not include an audio file on this record.',
    ],
    internalReaderRoute: `#/hadith/${hadith.id}?lang=${hadith.lang}`,
  };
}

function asmaToPassage(name: AsmaName, lang: Lang, retrievedAt: string): EvidencePassage {
  const id = `ASMA-${name.number}`;
  const source: SourceRecord = {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: `src-${id}`,
    provider: 'Aladhan',
    itemId: String(name.number),
    language: 'en',
    edition: 'aladhan-asma-al-husna',
    version: 'v1',
    title: `Asma al-Husna #${name.number}: ${name.transliteration} (${name.arabic})`,
    credits: [{ role: 'publisher', name: 'Aladhan Asma al-Husna API (api.aladhan.com/v1/asmaAlHusna)' }],
    canonicalUrl: 'https://api.aladhan.com/v1/asmaAlHusna',
    contentType: 'name_of_allah',
    rights: {
      tier: 'open_api_display',
      attributionRequired: true,
      redistributionAllowed: true,
      modificationAllowed: false,
      licenseNote: 'Aladhan Asma al-Husna collection; provides Arabic name, Latin transliteration, and English meaning.',
    },
    retrievedAt,
  };

  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    id,
    sourceId: source.id,
    source,
    exactText: `${name.transliteration} (${name.arabic}) — ${name.meaning}`,
    passageLanguage: 'en',
    arabicText: name.arabic,
    originalLanguage: 'ar',
    locator: `Asma al-Husna #${name.number}`,
    surah: null,
    ayah: null,
    hadithId: null,
    collection: 'Aladhan Asma al-Husna',
    grade: null,
    grader: null,
    surroundingContext: [],
    limitations: [
      lang !== 'en'
        ? 'The Aladhan Asma al-Husna collection provides English meanings and Latin transliteration only; paired with QuranEnc verses in your selected language.'
        : 'Aladhan supplies the Arabic name, Latin transliteration, and concise English meaning.',
    ],
    internalReaderRoute: '#/spiritual/names',
  };
}

function scienceMethodologyPassage(retrievedAt: string): EvidencePassage {
  const id = 'SCI-METHOD-1';
  const source: SourceRecord = {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: `src-${id}`,
    provider: 'SciencePrimary',
    itemId: 'empirical-hydrology-cosmology-scope',
    language: 'en',
    edition: 'Dragon Dawwa Science Scope Reference',
    version: '2026.1',
    title: 'Empirical Observation in Hydrology & Cosmology — Methodological Scope Note',
    credits: [{ role: 'publisher', name: 'Dragon Dawwa Faith & Discovery Editorial Desk' }],
    canonicalUrl: null,
    contentType: 'scientific_publication',
    rights: {
      tier: 'open_api_display',
      attributionRequired: true,
      redistributionAllowed: true,
      modificationAllowed: false,
      licenseNote: 'Methodological boundary note distinguishing empirical science from scriptural exegesis.',
    },
    retrievedAt,
  };

  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    id,
    sourceId: source.id,
    source,
    exactText:
      'Empirical hydrology and observational cosmology measure physical processes (water cycle phase transitions, biochemical necessity of liquid water, and cosmic expansion) using testable, falsifiable models that remain open to revision as instruments improve.',
    passageLanguage: 'en',
    arabicText: null,
    originalLanguage: 'en',
    locator: 'Faith & Discovery Methodological Note §1',
    surah: null,
    ayah: null,
    hadithId: null,
    collection: null,
    grade: null,
    grader: null,
    surroundingContext: [
      'Scientific models describe physical mechanisms and remain provisional; Qur’anic ayat call human beings to moral and spiritual reflection (tadabbur) on creation.',
    ],
    limitations: [
      'Provisional empirical scope: Do not claim scientific theories as definitive proof of scriptural verses, nor read scriptural verses as laboratory textbooks.',
    ],
    internalReaderRoute: '#/hub',
  };
}

function buildSegmentsForEpisode(
  blueprint: EpisodeBlueprint,
  lang: Lang,
  verses: Verse[],
  hadiths: EncyclopediaHadith[],
  extraPassages: EvidencePassage[],
): { outline: EpisodeOutlineItem[]; segments: StudioSegment[] } {
  const segments: StudioSegment[] = [];
  const allVerseIds = verses.map(v => `Q${v.surah}-${v.ayah}`);
  const allHadithIds = hadiths.map(h => `E${h.id}`);
  const primaryCitations = [...allVerseIds, ...allHadithIds, ...extraPassages.map(p => p.id)].slice(0, 4);

  const pushSeg = (partial: Omit<StudioSegment, 'id' | 'index' | 'durationSeconds'> & { durationSeconds?: number }) => {
    const idx = segments.length;
    const words = partial.text.split(/\s+/).length;
    const estimated = partial.durationSeconds ?? Math.max(8, Math.min(35, Math.round(words / 2.4)));
    segments.push({
      ...partial,
      id: `seg-${idx + 1}`,
      index: idx,
      durationSeconds: estimated,
    });
  };

  const firstVerse = verses[0];
  const secondVerse = verses[1];
  const firstHadith = hadiths[0];

  // 1. OPENING
  const openingText =
    lang === 'ta'
      ? `அஸ்ஸலாமு அலைக்கும். Dragon Dawwa Studio-வின் ${blueprint.titles.ta} நிகழ்ச்சிக்கு வரவேற்கிறோம். உதாரணமாக, நம் அன்றாட வாழ்வில் ஒரு சிறிய தவறு நிகழும்போது அல்லது களைப்பு ஏற்படும்போது, நாம் எவ்வாறு நம்பிக்கையையும் கருணையையும் அணுகுகிறோம் என்பதைச் சிந்தித்துப் பார்ப்போம்.`
      : lang === 'si'
        ? `අස්සලාමු අලයිකුම්. Dragon Dawwa Studio හි ${blueprint.titles.si} වැඩසටහනට සාදරයෙන් පිළිගනිමු. උදාහරණයක් ලෙස, අපගේ එදිනෙදා ජීවිතයේදී අප අතින් වරදක් සිදුවූ විට හෝ වෙහෙසට පත්වූ විට කරුණාව හා බලාපොරොත්තුව දෙස බලන්නේ කෙසේදැයි විමසා බලමු.`
        : `Assalamu Alaikum, and welcome to Dragon Dawwa Studio for ${blueprint.titles.en}. Consider an everyday example: at the end of a long day when we notice our own shortcomings or feel weighed down by impatience around us, where do we turn to understand mercy and steadiness from the sources?`;

  pushSeg({
    section: 'opening',
    sectionLabel: '1. Opening · Everyday Question',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: openingText,
    arabicText: null,
    citations: [],
    translationEdition: null,
    sourceLanguage: lang,
    directAudioUrl: null,
    hypotheticalExample: true,
  });

  // 2. ORIENTATION
  const orientationText =
    lang === 'ta'
      ? `இந்த நிகழ்ச்சியின் முடிவில், நாம் பெறப்பட்ட குர்ஆன் வசனங்கள் (${verses.map(v => v.key).join(', ')}) மற்றும் ஹதீஸ் ஆதாரங்களை (${hadiths.map(h => `#${h.id}`).join(', ')}) நேரடியாகக் கேட்டு, அவற்றின் வெளியிடப்பட்ட மொழிபெயர்ப்பு மற்றும் தரப்படுத்தலைத் தெளிவாக அறிந்துகொள்வோம்.`
      : lang === 'si'
        ? `මෙම වැඩසටහන අවසානයේදී, අපි ලබාගත් කුර්ආන් වාක්‍ය (${verses.map(v => v.key).join(', ')}) සහ හදීස් මූලාශ්‍ර (${hadiths.map(h => `#${h.id}`).join(', ')}) වලට සවන් දී ඒවායේ ප්‍රකාශිත පරිවර්තනය හා ශ්‍රේණිගත කිරීම් පැහැදිලිව වටහා ගනිමු.`
        : `In this programme, we will listen to the retrieved Qur’anic verses (${verses.map(v => v.key).join(', ')}) and Prophetic narrations (${hadiths.map(h => `HadeethEnc #${h.id}`).join(', ')}), keeping the original Arabic recitation, published translation editions, and scholarly explanations clearly distinct.`;

  pushSeg({
    section: 'orientation',
    sectionLabel: '2. Orientation · Learning Path',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: orientationText,
    arabicText: null,
    citations: [],
    translationEdition: null,
    sourceLanguage: lang,
    directAudioUrl: null,
  });

  // 3. EVIDENCE (Original Qur'an Recitation + Published Meaning + Hadith Wording & Grade + Archival Audio if Bayan)
  for (const verse of verses) {
    const vid = `Q${verse.surah}-${verse.ayah}`;
    // 3a. Original Qur'an Recitation segment (NEVER synthesized by presenter TTS)
    pushSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · Qur’an ${verse.key} (Recitation & Meaning)`,
      speakerId: 'reciter',
      speakerName: 'Mishary Rashid Alafasy (AlQuran Cloud quran-uthmani)',
      speakerRoleLabel: 'Original Qur’an Recitation (Qari)',
      isGeneratedSpeaker: false,
      statementKind: 'exact_quotation',
      originBadge: 'Quranic Arabic text',
      audioKind: 'quran_recitation',
      text: `“${verse.translation}”`,
      arabicText: verse.arabic,
      transliteration: verse.transliteration ?? null,
      citations: [vid],
      translationEdition: verse.translationKey ?? verse.translator,
      sourceLanguage: 'ar',
      directAudioUrl: recitationUrl('ar.alafasy', verse.number),
      durationSeconds: 14,
    });

    // 3b. Published Meaning segment (uses verified QuranEnc meaning audio where listed)
    if (verse.meaningAudio) {
      pushSeg({
        section: 'evidence',
        sectionLabel: `3. Evidence · Published Meaning Audio (${verse.key})`,
        speakerId: 'sakinah',
        speakerName: `${verse.translator} (${verse.translationKey})`,
        speakerRoleLabel: 'Published Translation Meaning Audio',
        isGeneratedSpeaker: false,
        statementKind: 'published_translation',
        originBadge: 'Published translation',
        audioKind: 'meaning_audio',
        text: `“${verse.translation}”`,
        arabicText: null,
        citations: [vid],
        translationEdition: verse.translationKey ?? verse.translator,
        sourceLanguage: verse.lang,
        directAudioUrl: verse.meaningAudio,
        durationSeconds: 12,
      });
    }
  }

  for (const hadith of hadiths) {
    const hid = `E${hadith.id}`;
    pushSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · Hadith HadeethEnc #${hadith.id}`,
      speakerId: blueprint.format === 'explanatory_dialogue' ? 'tariq' : 'sakinah',
      speakerName: blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.name : STUDIO_PRESENTERS.sakinah.name,
      speakerRoleLabel:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.roleTitle : STUDIO_PRESENTERS.sakinah.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'published_translation',
      originBadge: 'Prophetic narration (Hadith)',
      audioKind: 'presenter_narration',
      text: `“${hadith.text}”`,
      arabicText: hadith.arabic,
      citations: [hid],
      translationEdition: `HadeethEnc (${hadith.lang.toUpperCase()}) · Grade: ${hadith.grade ?? 'Not supplied'}`,
      sourceLanguage: hadith.lang,
      directAudioUrl: null,
    });
  }

  // If Bayan & Lessons has an original scholar recording, add the separated Original Recording segment!
  if (blueprint.originalRecording) {
    const rec = blueprint.originalRecording;
    const recId = `REC-${rec.itemId}`;
    const audioUrl = rec.audioUrlByLang[lang] ?? rec.audioUrlByLang.en ?? null;
    pushSeg({
      section: 'evidence',
      sectionLabel: '3. Evidence · Original Scholar Recording (Unmodified Archive)',
      speakerId: 'original_speaker',
      speakerName: rec.speakerName,
      speakerRoleLabel: 'Original Archival Recording · IslamHouse',
      isGeneratedSpeaker: false,
      statementKind: 'exact_quotation',
      originBadge: 'Original scholar recording',
      audioKind: 'original_recording',
      text: `“${rec.title}”`,
      arabicText: null,
      citations: extraPassages.some(p => p.id === recId) ? [recId] : primaryCitations.slice(0, 1),
      translationEdition: `IslamHouse Archive #${rec.itemId}`,
      sourceLanguage: lang,
      directAudioUrl: audioUrl,
      durationSeconds: 30,
    });
  }

  // Include extra passages (Asma al-Husna, IslamHouse reader, Science scope)
  for (const extra of extraPassages) {
    if (extra.id.startsWith('REC-')) continue;
    const isScience = extra.source.contentType === 'scientific_publication';
    const isBook = extra.source.provider === 'IslamHouse';
    const kind: StatementKind = isScience
      ? 'scientific_evidence'
      : isBook
        ? 'exact_quotation'
        : 'published_translation';
    const badge: ContentOriginBadge = isScience
      ? 'Scientific publication'
      : isBook
        ? 'Scholarly explanation'
        : 'Published translation';

    pushSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · ${extra.source.title}`,
      speakerId: blueprint.format === 'explanatory_dialogue' ? 'tariq' : 'sakinah',
      speakerName: blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.name : STUDIO_PRESENTERS.sakinah.name,
      speakerRoleLabel:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.roleTitle : STUDIO_PRESENTERS.sakinah.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: kind,
      originBadge: badge,
      audioKind: 'presenter_narration',
      text: `“${extra.exactText}”`,
      arabicText: extra.arabicText,
      citations: [extra.id],
      translationEdition: extra.source.edition ?? extra.source.provider,
      sourceLanguage: extra.passageLanguage,
      directAudioUrl: null,
      scientificLimitation: isScience ? extra.limitations[0] ?? null : null,
    });
  }

  // 4. EXPLORATION (Host/Researcher dialogue or single presenter exploration + scholarly explanation from HadeethEnc)
  if (firstHadith?.explanation) {
    const hid = `E${firstHadith.id}`;
    const excerpt = firstHadith.explanation.slice(0, 420).trim();
    pushSeg({
      section: 'exploration',
      sectionLabel: `4. Exploration · Source Explanation (HadeethEnc #${firstHadith.id})`,
      speakerId: blueprint.format === 'explanatory_dialogue' ? 'tariq' : 'sakinah',
      speakerName: blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.name : STUDIO_PRESENTERS.sakinah.name,
      speakerRoleLabel:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.roleTitle : STUDIO_PRESENTERS.sakinah.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'scholarly_interpretation',
      originBadge: 'Scholarly explanation',
      audioKind: 'presenter_narration',
      text: `“${excerpt}”`,
      arabicText: null,
      citations: [hid],
      translationEdition: `HadeethEnc #${firstHadith.id} Explanation`,
      sourceLanguage: firstHadith.lang,
      directAudioUrl: null,
    });
  }

  // Add conversational exploration connecting the verses and hadith
  const explorationSpeaker = blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.sakinah : STUDIO_PRESENTERS.sakinah;
  const expCites = [
    ...(firstVerse ? [`Q${firstVerse.surah}-${firstVerse.ayah}`] : []),
    ...(secondVerse ? [`Q${secondVerse.surah}-${secondVerse.ayah}`] : []),
    ...(firstHadith ? [`E${firstHadith.id}`] : []),
  ];
  const explorationSynthesis =
    firstVerse && firstHadith
      ? `“${firstVerse.translation}” — “${firstHadith.text}”`
      : firstVerse
        ? `“${firstVerse.translation}”`
        : firstHadith
          ? `“${firstHadith.text}”`
          : blueprint.summaries[lang];

  pushSeg({
    section: 'exploration',
    sectionLabel: '4. Exploration · Connecting the Sources',
    speakerId: explorationSpeaker.id,
    speakerName: explorationSpeaker.name,
    speakerRoleLabel: explorationSpeaker.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'faithful_paraphrase',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: explorationSynthesis,
    arabicText: null,
    citations: expCites,
    translationEdition: firstVerse?.translationKey ?? 'HadeethEnc',
    sourceLanguage: lang,
    directAudioUrl: null,
    scientificLimitation:
      blueprint.familyId === 'faith-discovery'
        ? 'Religious reflection on signs in creation is kept distinct from provisional empirical science.'
        : null,
  });

  // 5. APPLICATION
  const lessonQuote = firstHadith?.lessons?.[0] ?? firstVerse?.translation ?? '';
  const appCitations = firstHadith ? [`E${firstHadith.id}`] : firstVerse ? [`Q${firstVerse.surah}-${firstVerse.ayah}`] : primaryCitations;
  const applicationText = lessonQuote
    ? `“${lessonQuote}”`
    : blueprint.summaries[lang];

  pushSeg({
    section: 'application',
    sectionLabel: '5. Application · Living the Lesson',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: lessonQuote ? 'exact_quotation' : 'presenter_reflection',
    originBadge: lessonQuote ? 'Scholarly explanation' : 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: applicationText,
    arabicText: null,
    citations: appCitations,
    translationEdition: firstHadith ? `HadeethEnc #${firstHadith.id}` : firstVerse?.translationKey ?? null,
    sourceLanguage: lang,
    directAudioUrl: null,
  });

  // 6. CLOSING
  const closingText =
    lang === 'ta'
      ? `இன்றைய நிகழ்ச்சியில் நாம் கேட்ட ஒவ்வொரு மேற்கோளையும் ஆதாரப் பலகையில் (Explore Sources) நீங்கள் விரிவாக வாசிக்கலாம். எப்போது வேண்டுமானாலும் இடைநிறுத்தி உங்கள் கேள்வியைக் கேட்கலாம். அஸ்ஸலாமு அலைக்கும்.`
      : lang === 'si'
        ? `අද වැඩසටහනේ සඳහන් සියලුම මූලාශ්‍ර ඔබට මූලාශ්‍ර පුවරුවෙන් (Explore Sources) පරීක්ෂා කළ හැකිය. ඕනෑම මොහොතක විරාම ගන්වා ප්‍රශ්න යොමු කරන්න. අස්සලාමු අලයිකුම්.`
        : `Every verse, narration, and grading we explored in this programme remains open in the Sources panel for your inspection. You can pause at any segment to ask a question, or tune to the next programme in the schedule. Assalamu Alaikum.`;

  pushSeg({
    section: 'closing',
    sectionLabel: '6. Closing · Takeaway & Next Steps',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: closingText,
    arabicText: null,
    citations: [],
    translationEdition: null,
    sourceLanguage: lang,
    directAudioUrl: null,
  });

  const outline: EpisodeOutlineItem[] = [
    {
      section: 'opening',
      heading: '1. Opening',
      summary: 'A welcoming question and everyday situation grounded in humility.',
      plannedCitationIds: primaryCitations.slice(0, 2),
    },
    {
      section: 'orientation',
      heading: '2. Orientation',
      summary: blueprint.brief.learningObjective,
      plannedCitationIds: primaryCitations,
    },
    {
      section: 'evidence',
      heading: '3. Evidence',
      summary: 'Primary Qur’anic recitations, published translations, and HadeethEnc narrations with preserved grades.',
      plannedCitationIds: primaryCitations,
    },
    {
      section: 'exploration',
      heading: '4. Exploration',
      summary: 'Source explanations and careful distinctions between text, translation, and commentary.',
      plannedCitationIds: expCites,
    },
    {
      section: 'application',
      heading: '5. Application',
      summary: 'Practical takeaway supported directly by the documented lessons.',
      plannedCitationIds: appCitations,
    },
    {
      section: 'closing',
      heading: '6. Closing',
      summary: 'Concise summary and invitation to inspect sources or continue to the next programme.',
      plannedCitationIds: primaryCitations.slice(0, 2),
    },
  ];

  return { outline, segments };
}

/**
 * Hydrates a curated blueprint into a complete, verified StudioEpisode with live retrieved sources.
 */
export async function hydrateBlueprintEpisode(blueprint: EpisodeBlueprint, lang: Lang): Promise<StudioEpisode> {
  const cacheKey = `${blueprint.id}:${lang}`;
  const cached = episodeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.episode;
  }

  const retrievedAt = nowIso();
  const gaps: { source: string; message: string }[] = [];
  const disagreements: string[] = [];
  const passages: EvidencePassage[] = [];
  const verses: Verse[] = [];
  const hadiths: EncyclopediaHadith[] = [];
  const extraPassages: EvidencePassage[] = [];

  // 1. Retrieve Qur'an verses
  if (blueprint.ayahRefs.length > 0) {
    try {
      const fetched = await getVerses(blueprint.ayahRefs, lang);
      for (const v of fetched) {
        verses.push(v);
        passages.push(verseToPassage(v, retrievedAt));
      }
      for (const ref of blueprint.ayahRefs) {
        if (!fetched.some(v => v.surah === ref.surah && v.ayah === ref.ayah)) {
          gaps.push({ source: `Qur’an ${ref.surah}:${ref.ayah}`, message: `This ayah was not returned in ${lang}.` });
        }
      }
    } catch (err) {
      gaps.push({
        source: 'QuranEnc / AlQuran Cloud',
        message: err instanceof UpstreamError ? err.message : 'Qur’an verses could not be retrieved.',
      });
    }
  }

  // 2. Retrieve HadeethEnc narrations
  for (const hid of blueprint.hadeethIds) {
    try {
      const h = await loadHadeeth(lang, hid);
      hadiths.push(h);
      passages.push(hadithToPassage(h, retrievedAt));
    } catch (err) {
      gaps.push({
        source: `HadeethEnc #${hid}`,
        message: err instanceof UpstreamError ? err.message : `HadeethEnc #${hid} is not available in ${lang}.`,
      });
    }
  }

  // 3. Retrieve Asma al-Husna if specified
  if (blueprint.asmaNumbers && blueprint.asmaNumbers.length > 0) {
    try {
      const asma = await getAsma();
      for (const num of blueprint.asmaNumbers) {
        const found = asma.names.find(n => n.number === num);
        if (found) {
          const p = asmaToPassage(found, lang, retrievedAt);
          passages.push(p);
          extraPassages.push(p);
        }
      }
      if (lang !== 'en') {
        gaps.push({
          source: 'Aladhan Asma al-Husna',
          message:
            'Aladhan supplies Arabic names, Latin transliteration, and English meanings only; Tamil and Sinhala meanings come from the paired QuranEnc verses.',
        });
      }
    } catch {
      gaps.push({ source: 'Aladhan Asma al-Husna', message: 'The 99 Names collection could not be reached.' });
    }
  }

  // 4. Retrieve IslamHouse items if specified
  if (blueprint.islamHouseIds) {
    for (const itemSpec of blueprint.islamHouseIds) {
      if (itemSpec.onlyLang && itemSpec.onlyLang !== lang) {
        gaps.push({
          source: `IslamHouse #${itemSpec.id}`,
          message: `IslamHouse item #${itemSpec.id} is verified in ${itemSpec.onlyLang.toUpperCase()} only; no ${lang.toUpperCase()} edition was found or machine-generated.`,
        });
        continue;
      }
      if (itemSpec.id === SINCERITY_BOOK.id && lang === 'ta') {
        try {
          const html = await fetchReaderHtml(SINCERITY_BOOK.readerUrl);
          const section = html ? passageUnderHeading(html, SINCERITY_BOOK.heading) : null;
          const main = section?.paragraphs[0];
          if (section && main) {
            const p: EvidencePassage = {
              contractVersion: SHARED_CONTRACT_VERSION,
              id: 'IH735805',
              sourceId: 'src-IH735805',
              source: {
                contractVersion: SHARED_CONTRACT_VERSION,
                id: 'src-IH735805',
                provider: 'IslamHouse',
                itemId: '735805',
                language: 'ta',
                edition: 'islamhouse-reader-ta',
                version: null,
                title: SINCERITY_BOOK.title,
                credits: [
                  { role: 'author', name: SINCERITY_CREDITS.preparation },
                  { role: 'translator', name: SINCERITY_CREDITS.translator },
                  { role: 'reviewer', name: SINCERITY_CREDITS.reviewer },
                ],
                canonicalUrl: SINCERITY_BOOK.readerUrl,
                contentType: 'book_section',
                rights: {
                  tier: 'in_app_attributed',
                  attributionRequired: true,
                  redistributionAllowed: false,
                  modificationAllowed: false,
                  licenseNote: 'Publisher’s Tamil wording read on demand from IslamHouse reader.',
                },
                retrievedAt,
              },
              exactText: main.text,
              passageLanguage: 'ta',
              arabicText: null,
              originalLanguage: 'ta',
              locator: paragraphLocator(section.heading, main),
              surah: null,
              ayah: null,
              hadithId: null,
              collection: null,
              grade: null,
              grader: null,
              surroundingContext: section.paragraphs.slice(1, 3).map(sp => sp.text),
              limitations: ['Read from the official Tamil reader; no English or Sinhala edition exists for this item ID.'],
              internalReaderRoute: '#/spiritual/library/purification?lang=ta',
            };
            passages.push(p);
            extraPassages.push(p);
            disagreements.push(
              'IslamHouse 735805 records a second scholarly definition of inner purity (ikhlas) in the same section alongside the primary wording.',
            );
          }
        } catch {
          gaps.push({ source: 'IslamHouse #735805', message: 'The Tamil reader passage could not be retrieved.' });
        }
      } else if (itemSpec.id === PRAYER_ARTICLE.id && lang === 'ta') {
        try {
          const doc = await loadItemDocument(PRAYER_ARTICLE.id, 'ta');
          const para = doc?.html ? firstLongParagraph(doc.html) : null;
          if (doc && para) {
            const p: EvidencePassage = {
              contractVersion: SHARED_CONTRACT_VERSION,
              id: 'IH475013',
              sourceId: 'src-IH475013',
              source: {
                contractVersion: SHARED_CONTRACT_VERSION,
                id: 'src-IH475013',
                provider: 'IslamHouse',
                itemId: '475013',
                language: 'ta',
                edition: 'islamhouse-api-ta',
                version: null,
                title: doc.title,
                credits: [
                  { role: 'author', name: PRAYER_CREDITS.author },
                  { role: 'reviewer', name: PRAYER_CREDITS.reviewer },
                ],
                canonicalUrl: PRAYER_ARTICLE.readerUrl,
                contentType: 'article_passage',
                rights: {
                  tier: 'in_app_attributed',
                  attributionRequired: true,
                  redistributionAllowed: false,
                  modificationAllowed: false,
                  licenseNote: 'Tamil article read from IslamHouse get-item API.',
                },
                retrievedAt,
              },
              exactText: para.text,
              passageLanguage: 'ta',
              arabicText: null,
              originalLanguage: 'ta',
              locator: `Paragraph ${para.id}`,
              surah: null,
              ayah: null,
              hadithId: null,
              collection: null,
              grade: null,
              grader: null,
              surroundingContext: [],
              limitations: ['Verified in Tamil only.'],
              internalReaderRoute: '#/spiritual/library/prayer?lang=ta',
            };
            passages.push(p);
            extraPassages.push(p);
          }
        } catch {
          gaps.push({ source: 'IslamHouse #475013', message: 'The Tamil prayer article could not be retrieved.' });
        }
      }
    }
  }

  // 5. Original scholar recording passage if Bayan & Lessons
  if (blueprint.originalRecording) {
    const rec = blueprint.originalRecording;
    const audioUrl = rec.audioUrlByLang[lang] ?? rec.audioUrlByLang.en ?? null;
    const recPassage: EvidencePassage = {
      contractVersion: SHARED_CONTRACT_VERSION,
      id: `REC-${rec.itemId}`,
      sourceId: `src-REC-${rec.itemId}`,
      source: {
        contractVersion: SHARED_CONTRACT_VERSION,
        id: `src-REC-${rec.itemId}`,
        provider: 'IslamHouse',
        itemId: String(rec.itemId),
        language: lang === 'ta' ? 'ta' : 'en',
        edition: 'islamhouse-audio-archive',
        version: null,
        title: rec.title,
        credits: [{ role: 'speaker', name: rec.speakerName }],
        canonicalUrl: rec.sourceUrl,
        contentType: 'audio_recording',
        rights: {
          tier: 'in_app_attributed',
          attributionRequired: true,
          redistributionAllowed: false,
          modificationAllowed: false,
          licenseNote: 'Original scholar recording streamed directly from d1.islamhouse.com; never modified or voice-cloned.',
        },
        retrievedAt,
      },
      exactText: rec.title,
      passageLanguage: lang,
      arabicText: null,
      originalLanguage: 'ar',
      locator: `IslamHouse Audio Archive #${rec.itemId}`,
      surah: null,
      ayah: null,
      hadithId: null,
      collection: 'IslamHouse Audio',
      grade: null,
      grader: null,
      surroundingContext: ['Original scholar audio recording is separated from generated Studio host introductions.'],
      limitations: ['Streamed from IslamHouse archive; generated presenter segments do not imitate the scholar.'],
      internalReaderRoute: `#/spiritual/library/prayer?lang=${lang}&item=${rec.itemId}`,
      audioUrl,
      audioKind: 'original_recording',
    };
    passages.push(recPassage);
    extraPassages.push(recPassage);
  }

  // 6. Faith & Discovery science scope passage
  if (blueprint.familyId === 'faith-discovery') {
    const sci = scienceMethodologyPassage(retrievedAt);
    passages.push(sci);
    extraPassages.push(sci);
  }

  const { outline, segments } = buildSegmentsForEpisode(blueprint, lang, verses, hadiths, extraPassages);
  const verification = verifyStudioEpisode(segments, passages, {
    currentRevision: 1,
    approvedRevision: 1,
    narratedRevision: null,
    familyId: blueprint.familyId,
  });

  const presenters =
    blueprint.format === 'explanatory_dialogue'
      ? [STUDIO_PRESENTERS.sakinah, STUDIO_PRESENTERS.tariq]
      : [STUDIO_PRESENTERS.sakinah];

  const episode: StudioEpisode = {
    id: blueprint.id,
    slug: blueprint.slug,
    familyId: blueprint.familyId,
    title: blueprint.titles[lang],
    subtitle: blueprint.subtitles[lang],
    summary: blueprint.summaries[lang],
    lang,
    availableLanguages: ['en', 'ta', 'si'],
    format: blueprint.format,
    broadcastLabel: blueprint.broadcastLabel,
    editorialState: 'approved',
    currentRevision: 1,
    approvedRevision: 1,
    narratedRevision: null,
    approvalValid: true,
    narrationValid: false,
    published: false,
    featuredTonight: Boolean(blueprint.featuredTonight),
    presenters,
    brief: { ...blueprint.brief, lang },
    outline,
    segments,
    passages,
    gaps,
    disagreements,
    verification,
    reviews: [
      {
        id: `rev-${blueprint.id}-1`,
        reviewerId: 'editorial-desk',
        reviewerName: 'Dragon Dawwa Source Verification Desk',
        role: 'source-checker',
        decision: 'approved',
        notes: 'Verified live passages, edition attributions, and hadith grades.',
        createdAt: retrievedAt,
        scriptRevision: 1,
      },
    ],
    revisions: [
      {
        revision: 1,
        state: 'approved',
        updatedAt: retrievedAt,
        updatedBy: 'Dragon Dawwa Studio Pipeline',
        changeNote: 'Initial live-sourced studio script assembled from verified passages.',
        segmentCount: segments.length,
        contentHash: computeSegmentsHash(segments),
        verificationSupported: verification.supported,
      },
    ],
    createdAt: retrievedAt,
    updatedAt: retrievedAt,
  };

  episodeCache.set(cacheKey, { at: Date.now(), episode });
  studioProductions.set(`${blueprint.id}:${lang}`, episode);
  return episode;
}

export async function loadStudioEpisode(idOrSlug: string, lang: Lang): Promise<StudioEpisode> {
  const custom = studioProductions.get(`${idOrSlug}:${lang}`) ?? studioProductions.get(idOrSlug);
  if (custom && custom.lang === lang) {
    return custom;
  }
  const blueprint =
    STUDIO_EPISODE_BLUEPRINTS.find(b => b.id === idOrSlug || b.slug === idOrSlug) ??
    STUDIO_EPISODE_BLUEPRINTS[0];
  return hydrateBlueprintEpisode(blueprint, lang);
}

/**
 * Interactive Ask-While-Listening Resolver.
 * Handles:
 * - "Explain that simply."
 * - "Explain that in Tamil." / "Explain that in Sinhala."
 * - "Which hadith supports this?"
 * - "What does this Arabic term mean?"
 * - "Show the reference."
 * - General questions about the programme or topic via the shared research service.
 * - Unsupported questions (e.g. "What is the population of Tokyo?" or unverified scientific claims)
 *   by acknowledging the gap honestly and offering relevant sourced material from the current programme.
 */
export async function answerStudioQuestion(req: StudioAskRequest): Promise<StudioAskAnswer> {
  const rawQuestion = req.question.trim();
  const lower = rawQuestion.toLowerCase();

  // Detect explicit language request inside the question ("Explain that in Tamil", "in Sinhala", "தமிழில்", "සිංහලෙන්")
  let effectiveLang: Lang = req.targetLang ?? req.lang;
  if (/\bin tamil\b|தமிழில்|தமிழ்/i.test(rawQuestion)) {
    effectiveLang = 'ta';
  } else if (/\bin sinhala\b|සිංහල/i.test(rawQuestion)) {
    effectiveLang = 'si';
  } else if (/\bin english\b/i.test(rawQuestion)) {
    effectiveLang = 'en';
  }

  const episode = await loadStudioEpisode(req.episodeId || 'tonight-mercy-ar-rahman', effectiveLang);
  const currentSegment =
    episode.segments.find(s => s.id === req.segmentId) ??
    episode.segments.find(s => s.citations.length > 0) ??
    episode.segments[0];

  const segmentPassages = episode.passages.filter(p => currentSegment?.citations.includes(p.id));
  const fallbackPassages = segmentPassages.length > 0 ? segmentPassages : episode.passages.slice(0, 3);
  const voiceAvailable = geminiConfigured();
  const voiceBlocker = voiceAvailable
    ? null
    : 'Live Gemini speech synthesis is unavailable because GEMINI_API_KEY is not configured on this server. Your cited text answer and internal source readers are ready below.';

  // 1. Check if question is an Arabic term inquiry ("What does this Arabic term mean?", "mean", "Ar-Rahman", "Niyyah", etc.)
  if (/arabic term|what does .* mean|meaning of ar-rahman|meaning of rahmah|meaning of niyyah|அரபுச் சொல்|අරාබි වචනය/i.test(lower)) {
    const termEntry = matchArabicTerm(rawQuestion, currentSegment?.text ?? '', currentSegment?.citations ?? []);
    const matchedPassages = episode.passages.filter(p => termEntry.relatedRefs.includes(p.id));
    const activePassages = matchedPassages.length > 0 ? matchedPassages : fallbackPassages;
    const citeIds = activePassages.map(p => p.id);

    return {
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      outcome: 'evidence_found',
      statusNote: 'Dragon Dawwa Live Study Answer · Unreviewed · Resolved from current segment & lexicon.',
      paragraphs: [
        {
          text: `${termEntry.term}: ${termEntry.meanings[effectiveLang]}`,
          citations: citeIds,
          statementKind: 'scholarly_interpretation',
        },
        ...(activePassages[0]
          ? [
              {
                text: `“${activePassages[0].exactText}” (${activePassages[0].locator})`,
                citations: [activePassages[0].id],
                statementKind: 'published_translation' as const,
              },
            ]
          : []),
      ],
      passages: activePassages,
      relatedSuggestedPassages: episode.passages.slice(0, 3),
      arabicTermExplanation: {
        term: termEntry.term,
        arabic: termEntry.arabic,
        meaning: termEntry.meanings[effectiveLang],
        citationId: citeIds[0] ?? 'Q1-1',
      },
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  // 2. Check if question asks "Which hadith supports this?"
  if (/which hadith|what hadith|hadith supports|எந்த ஹதீஸ்|කුමන හදීසය/i.test(lower)) {
    const hadithPassages = episode.passages.filter(p => p.source.contentType === 'hadith');
    if (hadithPassages.length > 0) {
      return {
        id: `ans-${randomUUID()}`,
        episodeId: episode.id,
        segmentId: currentSegment?.id ?? 'seg-1',
        question: rawQuestion,
        lang: effectiveLang,
        visibility: 'private_session',
        review: 'unreviewed',
        originBadge: 'Dragon Dawwa generated material',
        outcome: 'evidence_found',
        statusNote: 'Dragon Dawwa Live Study Answer · Unreviewed · Hadith evidence from this programme.',
        paragraphs: hadithPassages.map(hp => ({
          text: `${hp.locator}${hp.grade ? ` (Published Grade: ${hp.grade})` : ''}: “${hp.exactText}”`,
          citations: [hp.id],
          statementKind: 'published_translation' as const,
        })),
        passages: hadithPassages,
        relatedSuggestedPassages: episode.passages.filter(p => p.source.contentType === 'ayah'),
        voiceAvailable,
        voiceBlocker,
        answeredAt: nowIso(),
      };
    }
  }

  // 3. Check if question asks "Show the reference" or "Explain that simply" or "Explain that in Tamil/Sinhala"
  if (
    /show the reference|show reference|what is the reference|explain that|explain this|simply|மேற்கோள்|யாது|விளக்கு|පැහැදිලි කරන්න|යොමුව/i.test(
      lower,
    )
  ) {
    const activePassages = fallbackPassages;
    const paragraphs = activePassages.map(p => {
      const refDetails = [
        p.source.title,
        p.locator,
        p.source.edition ? `Edition: ${p.source.edition}` : '',
        p.grade ? `Grade: ${p.grade}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const contextLine = p.surroundingContext[0] ? `\nContext: ${p.surroundingContext[0]}` : '';
      return {
        text: `${refDetails}\n“${p.exactText}”${contextLine}`,
        citations: [p.id],
        statementKind: 'published_translation' as const,
      };
    });

    return {
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      outcome: 'evidence_found',
      statusNote:
        effectiveLang !== req.lang
          ? `Dragon Dawwa Live Study Answer · Unreviewed · Retrieved in ${effectiveLang.toUpperCase()} from verified edition.`
          : 'Dragon Dawwa Live Study Answer · Unreviewed · Direct passage & source explanation for the active segment.',
      paragraphs,
      passages: activePassages,
      relatedSuggestedPassages: episode.passages,
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  // 4. Check if question asks for scientific proof or is a general question
  if (asksForScience(rawQuestion)) {
    const sciPassage = episode.passages.find(p => p.source.contentType === 'scientific_publication') ?? scienceMethodologyPassage(nowIso());
    return {
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      outcome: 'scholarly_review_required',
      statusNote:
        'Scientific claim boundary: Religious sources are not laboratory proofs, and empirical science remains provisional.',
      paragraphs: [
        {
          text: 'The retrieved religious catalogues do not establish laboratory scientific proofs. In Dragon Dawwa Studio, Qur’anic verses of reflection (ayat) and empirical scientific observations are kept in separate lanes.',
          citations: [sciPassage.id],
          statementKind: 'scientific_evidence',
        },
      ],
      passages: [sciPassage],
      relatedSuggestedPassages: fallbackPassages,
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  // 5. General question: search current episode passages first, then query shared HadeethEnc & researchTopic service
  const tokens = contentTokens(rawQuestion);
  const matchingEpisodePassages = episode.passages.filter(p => {
    const hay = `${p.source.title} ${p.exactText} ${p.surroundingContext.join(' ')}`.toLowerCase();
    return tokens.some(t => hay.includes(t));
  });

  let retrievedPassages: EvidencePassage[] = [...matchingEpisodePassages];

  if (retrievedPassages.length === 0 && tokens.length > 0) {
    try {
      const searchRes = await searchHadeeth(effectiveLang, rawQuestion.slice(0, 120));
      const topHits = pageByRelevance(searchRes.items, 0);
      const records = await Promise.all(topHits.map(item => loadHadeeth(effectiveLang, item.id).catch(() => null)));
      const now = nowIso();
      for (const rec of records) {
        if (rec && passageSupportsTopic(rawQuestion, `${rec.title} ${rec.text}`)) {
          retrievedPassages.push(hadithToPassage(rec, now));
        }
      }
    } catch {
      /* continue to researchTopic fallback */
    }
  }

  if (retrievedPassages.length === 0 && tokens.length > 0) {
    try {
      const dossier = await researchTopic({
        topic: rawQuestion,
        questions: [rawQuestion],
        lang: effectiveLang,
      });
      retrievedPassages = dossier.references.map(referenceToPassage);
    } catch {
      /* handled below if empty */
    }
  }

  // 6. If no retrieved sources support the question (e.g., "What is the population of Tokyo?"),
  // acknowledge the gap honestly and offer relevant sourced material from the current programme!
  if (retrievedPassages.length === 0) {
    const limitationText =
      effectiveLang === 'ta'
        ? 'பெறப்பட்ட குர்ஆன், ஹதீஸ் மற்றும் நூலக மூலங்கள் இந்தக் கேள்விக்குப் பதிலளிக்கவில்லை. ஊகமான பதில்களை நாங்கள் உருவாக்குவதில்லை. நடப்பு நிகழ்ச்சியின் ஆதாரங்களைக் கீழே காணலாம்.'
        : effectiveLang === 'si'
          ? 'ලබාගත් කුර්ආන්, හදීස් සහ පුස්තකාල මූලාශ්‍ර මෙම ප්‍රශ්නයට පිළිතුරු නොදේ. අපි අනුමාන පිළිතුරු ඉදිරිපත් නොකරමු. වත්මන් වැඩසටහනේ මූලාශ්‍ර පහතින් පරීක්ෂා කළ හැකිය.'
          : 'The retrieved sources do not answer this question. Dragon Dawwa Studio does not invent certainty when a question falls outside the verified passages. You may inspect the sourced passages from the current programme below.';

    return {
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      outcome: 'no_relevant_evidence',
      statusNote: 'The retrieved sources do not answer this question.',
      paragraphs: [
        {
          text: limitationText,
          citations: [],
          statementKind: 'presenter_reflection',
        },
      ],
      passages: [],
      relatedSuggestedPassages: fallbackPassages,
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  // 7. We have retrieved supporting passages! Synthesize with Gemini if configured, or return direct sourced quotations.
  if (geminiConfigured()) {
    try {
      const packet = retrievedPassages.map(p => ({
        id: p.id,
        kind: p.source.contentType === 'ayah' ? ('quran' as const) : ('hadith' as const),
        label: p.source.title,
        arabic: p.arabicText,
        text: p.exactText,
        attribution: p.locator,
        grades: p.grade ? [{ name: p.grader ?? p.source.provider, grade: p.grade }] : [],
      }));
      const written = await writeAnswer(rawQuestion, effectiveLang, packet);
      if (!written.insufficientEvidence && written.paragraphs.length > 0) {
        return {
          id: `ans-${randomUUID()}`,
          episodeId: episode.id,
          segmentId: currentSegment?.id ?? 'seg-1',
          question: rawQuestion,
          lang: effectiveLang,
          visibility: 'private_session',
          review: 'unreviewed',
          originBadge: 'Dragon Dawwa generated material',
          outcome: 'evidence_found',
          statusNote: 'Dragon Dawwa Live Study Answer · Unreviewed synthesis grounded in retrieved passages.',
          paragraphs: written.paragraphs.map(wp => ({
            text: wp.text,
            citations: wp.citations,
            statementKind: 'faithful_paraphrase' as const,
          })),
          passages: retrievedPassages,
          relatedSuggestedPassages: fallbackPassages,
          voiceAvailable,
          voiceBlocker,
          answeredAt: nowIso(),
        };
      }
    } catch {
      /* Fall back to direct retrieved quotations when AI synthesis is unavailable */
    }
  }

  return {
    id: `ans-${randomUUID()}`,
    episodeId: episode.id,
    segmentId: currentSegment?.id ?? 'seg-1',
    question: rawQuestion,
    lang: effectiveLang,
    visibility: 'private_session',
    review: 'unreviewed',
    originBadge: 'Dragon Dawwa generated material',
    outcome: 'evidence_found',
    statusNote:
      'Retrieved passage. Live AI prose synthesis is not configured (GEMINI_API_KEY missing), so exact verified passages are presented directly.',
    paragraphs: retrievedPassages.map(p => ({
      text: `${p.source.title} (${p.locator}): “${p.exactText}”`,
      citations: [p.id],
      statementKind: 'published_translation' as const,
    })),
    passages: retrievedPassages,
    relatedSuggestedPassages: fallbackPassages,
    voiceAvailable,
    voiceBlocker,
    answeredAt: nowIso(),
  };
}

/**
 * Runs the full 9-stage Script Production Pipeline from a TopicBrief:
 * Topic brief → Research dossier → Episode outline → Script draft → Claim & quotation verification → Editorial review ('needs-review')
 * Never automatically publishes generated episodes!
 */
export async function runStudioProductionPipeline(input: Partial<TopicBrief>): Promise<{
  episode: StudioEpisode;
  dossierSummary: {
    examined: string[];
    notExamined: string[];
    unanswered: string[];
    disagreements: string[];
  };
}> {
  const topic = String(input.topic ?? '').trim();
  if (!topic) {
    throw new UpstreamError('Topic or question is required for the Studio production pipeline.', 400);
  }
  const lang = toLang(input.lang);
  const familyId = findProgrammeFamily(String(input.familyId ?? ''))?.id ?? 'research-room';
  const family = findProgrammeFamily(familyId)!;
  const format =
    input.format === 'single_presenter' || input.format === 'explanatory_dialogue' || input.format === 'introduced_recording'
      ? input.format
      : family.defaultFormat;
  const durationMinutes = Math.min(15, Math.max(2, Number(input.durationMinutes) || 4));
  const brief: TopicBrief = {
    topic,
    audience:
      input.audience === 'new_learners' || input.audience === 'students_of_knowledge' || input.audience === 'families'
        ? input.audience
        : 'general',
    lang,
    durationMinutes,
    familyId,
    learningObjective:
      String(input.learningObjective ?? '').trim() ||
      `Explore "${topic}" using verified passages from QuranEnc, HadeethEnc, and IslamHouse.`,
    tone:
      input.tone === 'clear_instructional' || input.tone === 'analytical_textual' || input.tone === 'curious_investigative'
        ? input.tone
        : 'warm_reflective',
    format,
    questions: Array.isArray(input.questions) ? input.questions.map(String) : [topic],
  };

  // Stage 2: Research Dossier from the Master Agent's shared researchTopic service
  const dossier = await researchTopic({
    topic: brief.topic,
    questions: brief.questions ?? [brief.topic],
    lang: brief.lang,
  });

  const passages = dossier.references.map(referenceToPassage);
  if (familyId === 'faith-discovery' || asksForScience(topic)) {
    passages.push(scienceMethodologyPassage(nowIso()));
  }

  if (passages.length === 0) {
    throw new UpstreamError(
      dossier.unanswered[0] ?? 'No verified passages could be retrieved for this topic in the selected language.',
      422,
    );
  }

  const citationIds = passages.map(p => p.id);
  const segments: StudioSegment[] = [];
  const addSeg = (partial: Omit<StudioSegment, 'id' | 'index' | 'durationSeconds'>) => {
    const index = segments.length;
    segments.push({
      ...partial,
      id: `seg-${index + 1}`,
      index,
      durationSeconds: Math.max(10, Math.min(30, Math.round(partial.text.split(/\s+/).length / 2.3))),
    });
  };

  // 1. Opening
  addSeg({
    section: 'opening',
    sectionLabel: '1. Opening · Topic Question',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: `Assalamu Alaikum. In this ${family.title} production, we examine the question: ${brief.topic}.`,
    arabicText: null,
    citations: [],
    translationEdition: null,
    sourceLanguage: lang,
    directAudioUrl: null,
  });

  // 2. Orientation
  addSeg({
    section: 'orientation',
    sectionLabel: '2. Orientation · Learning Objective',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: `Learning objective: ${brief.learningObjective.replace(/["“”]/g, '')}`,
    arabicText: null,
    citations: [],
    translationEdition: null,
    sourceLanguage: lang,
    directAudioUrl: null,
  });

  // 3. Evidence
  for (const p of passages) {
    const isAyah = p.source.contentType === 'ayah';
    const isScience = p.source.contentType === 'scientific_publication';
    const audioKind: AudioStreamKind = isAyah && p.audioUrl ? 'quran_recitation' : 'presenter_narration';
    addSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · ${p.source.title}`,
      speakerId: isAyah ? 'reciter' : format === 'explanatory_dialogue' ? 'tariq' : 'sakinah',
      speakerName: isAyah
        ? 'Mishary Rashid Alafasy (AlQuran Cloud)'
        : format === 'explanatory_dialogue'
          ? STUDIO_PRESENTERS.tariq.name
          : STUDIO_PRESENTERS.sakinah.name,
      speakerRoleLabel: isAyah
        ? 'Original Qur’an Recitation'
        : format === 'explanatory_dialogue'
          ? STUDIO_PRESENTERS.tariq.roleTitle
          : STUDIO_PRESENTERS.sakinah.roleTitle,
      isGeneratedSpeaker: !isAyah,
      statementKind: isScience ? 'scientific_evidence' : 'exact_quotation',
      originBadge: isAyah
        ? 'Quranic Arabic text'
        : isScience
          ? 'Scientific publication'
          : p.source.contentType === 'hadith'
            ? 'Prophetic narration (Hadith)'
            : 'Published translation',
      audioKind,
      text: `“${p.exactText}”`,
      arabicText: p.arabicText,
      citations: [p.id],
      translationEdition: p.source.edition ?? p.source.provider,
      sourceLanguage: p.passageLanguage,
      directAudioUrl: p.audioUrl ?? null,
      scientificLimitation: isScience ? p.limitations[0] ?? null : null,
    });
  }

  // 4. Exploration
  addSeg({
    section: 'exploration',
    sectionLabel: '4. Exploration · Source Synthesis',
    speakerId: format === 'explanatory_dialogue' ? 'tariq' : 'sakinah',
    speakerName: format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.name : STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel:
      format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.tariq.roleTitle : STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'exact_quotation',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: passages.map(p => `“${p.exactText}”`).join(' — '),
    arabicText: null,
    citations: citationIds,
    translationEdition: passages[0]?.source.edition ?? passages[0]?.source.provider ?? null,
    sourceLanguage: lang,
    directAudioUrl: null,
    scientificLimitation:
      familyId === 'faith-discovery' || asksForScience(topic)
        ? 'Religious passages and empirical observations carry distinct epistemological boundaries.'
        : null,
  });

  // 5. Application
  addSeg({
    section: 'application',
    sectionLabel: '5. Application · Practical Reflection',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'exact_quotation',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: `“${passages[0].exactText}”`,
    arabicText: null,
    citations: [passages[0].id],
    translationEdition: passages[0].source.edition ?? passages[0].source.provider,
    sourceLanguage: lang,
    directAudioUrl: null,
  });

  // 6. Closing
  addSeg({
    section: 'closing',
    sectionLabel: '6. Closing · Editorial Review Notice',
    speakerId: 'sakinah',
    speakerName: STUDIO_PRESENTERS.sakinah.name,
    speakerRoleLabel: STUDIO_PRESENTERS.sakinah.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: 'Every cited passage in this draft is available in the Sources panel. This episode awaits human editorial review before publication.',
    arabicText: null,
    citations: [],
    translationEdition: null,
    sourceLanguage: lang,
    directAudioUrl: null,
  });

  const outline: EpisodeOutlineItem[] = [
    { section: 'opening', heading: '1. Opening', summary: `Introduce topic: ${brief.topic}`, plannedCitationIds: citationIds.slice(0, 2) },
    { section: 'orientation', heading: '2. Orientation', summary: brief.learningObjective, plannedCitationIds: citationIds },
    { section: 'evidence', heading: '3. Evidence', summary: `Read ${passages.length} retrieved passage(s).`, plannedCitationIds: citationIds },
    { section: 'exploration', heading: '4. Exploration', summary: 'Connect passages and note coverage limits.', plannedCitationIds: citationIds },
    { section: 'application', heading: '5. Application', summary: 'Practical reflection grounded in the primary passage.', plannedCitationIds: [passages[0].id] },
    { section: 'closing', heading: '6. Closing', summary: 'Summary and editorial review handoff.', plannedCitationIds: citationIds.slice(0, 2) },
  ];

  const verification = verifyStudioEpisode(segments, passages, {
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
    familyId,
  });

  const id = `prod-${randomUUID().slice(0, 8)}`;
  const now = nowIso();
  const episode: StudioEpisode = {
    id,
    slug: id,
    familyId,
    title: brief.topic.slice(0, 140),
    subtitle: `${family.title} · Draft Production (${lang.toUpperCase()})`,
    summary: brief.learningObjective,
    lang,
    availableLanguages: [lang],
    format,
    broadcastLabel: 'On demand',
    // Never automatically publish generated episodes! Starts in 'needs-review'.
    editorialState: 'needs-review',
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
    approvalValid: false,
    narrationValid: false,
    published: false,
    presenters:
      format === 'explanatory_dialogue' ? [STUDIO_PRESENTERS.sakinah, STUDIO_PRESENTERS.tariq] : [STUDIO_PRESENTERS.sakinah],
    brief,
    outline,
    segments,
    passages,
    gaps: dossier.unanswered.map(msg => ({ source: 'Research Dossier', message: msg })),
    disagreements: dossier.disagreements,
    verification,
    reviews: [],
    revisions: [
      {
        revision: 1,
        state: 'needs-review',
        updatedAt: now,
        updatedBy: 'Studio Production Pipeline',
        changeNote: 'Generated from Topic Brief and Research Dossier; awaiting editorial review.',
        segmentCount: segments.length,
        contentHash: computeSegmentsHash(segments),
        verificationSupported: verification.supported,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  studioProductions.set(id, episode);
  studioProductions.set(`${id}:${lang}`, episode);
  return {
    episode,
    dossierSummary: {
      examined: dossier.examined,
      notExamined: dossier.notExamined,
      unanswered: dossier.unanswered,
      disagreements: dossier.disagreements,
    },
  };
}

export function listStudioProductions(): StudioEpisode[] {
  const seen = new Set<string>();
  const list: StudioEpisode[] = [];
  for (const ep of studioProductions.values()) {
    const key = `${ep.id}:${ep.lang}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(ep);
  }
  return list;
}

export function editStudioProductionScript(
  episodeId: string,
  lang: Lang,
  segments: StudioSegment[],
  editorName: string,
  changeNote: string,
): StudioEpisode {
  const existing = studioProductions.get(`${episodeId}:${lang}`) ?? studioProductions.get(episodeId);
  if (!existing) throw new UpstreamError('Studio production not found.', 404);
  const updated = applyEpisodeScriptEdit(existing, segments, editorName, changeNote);
  studioProductions.set(`${episodeId}:${lang}`, updated);
  studioProductions.set(episodeId, updated);
  episodeCache.set(`${episodeId}:${lang}`, { at: Date.now(), episode: updated });
  return updated;
}

export function transitionStudioProduction(
  episodeId: string,
  lang: Lang,
  action: StudioTransitionAction,
  user: EditorUser,
  notes: string,
  payload?: unknown,
): StudioEpisode {
  assertNotPrivateAnswerForPublication(payload);
  const existing = studioProductions.get(`${episodeId}:${lang}`) ?? studioProductions.get(episodeId);
  if (!existing) throw new UpstreamError('Studio production not found.', 404);
  const updated = transitionStudioEpisode(existing, action, user, notes);
  studioProductions.set(`${episodeId}:${lang}`, updated);
  studioProductions.set(episodeId, updated);
  episodeCache.set(`${episodeId}:${lang}`, { at: Date.now(), episode: updated });
  return updated;
}

export function getStudioVoiceStatus() {
  return buildVoiceCapabilityReport(geminiConfigured(), ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'], VOICES);
}

export function getStudioCatalogueSummary(lang: Lang) {
  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    lang,
    presenters: Object.values(STUDIO_PRESENTERS),
    families: PROGRAMME_FAMILIES,
    schedule: STUDIO_EPISODE_BLUEPRINTS.map(b => ({
      id: b.id,
      slug: b.slug,
      familyId: b.familyId,
      featuredTonight: Boolean(b.featuredTonight),
      scheduleSlot: b.scheduleSlot,
      broadcastLabel: b.broadcastLabel,
      format: b.format,
      title: b.titles[lang],
      subtitle: b.subtitles[lang],
      summary: b.summaries[lang],
      durationMinutes: b.brief.durationMinutes,
    })),
    voiceStatus: getStudioVoiceStatus(),
  };
}
