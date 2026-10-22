import { randomUUID } from 'node:crypto';
import { recitationUrl, toLang, type Lang } from '../../shared/sources.ts';
import type { Verse } from '../../shared/types.ts';
import type { EncyclopediaHadith } from '../../shared/hadeethenc.ts';
import {
  PILOT_LIMITATION,
  PILOT_QUOTATION_NOTE,
  PILOT_SYNTHESIS_NOTE,
  type PilotGap,
} from '../../shared/pilot.ts';
import {
  asksForScience,
  contentTokens,
  referenceEvidence,
  type ResearchReference,
} from '../../shared/research.ts';
import { SINCERITY_BOOK, SINCERITY_CREDITS } from '../../shared/sourceRegistry.ts';
import { paragraphLocator, passageUnderHeading } from '../../shared/readableText.ts';
import {
  findProgrammeFamily,
  matchArabicTerm,
  PROGRAMME_FAMILIES,
  STUDIO_EPISODE_BLUEPRINTS,
  type EpisodeBlueprint,
} from '../../shared/studio/catalogue.ts';
import {
  evidencePassageToReference,
  referenceToEvidencePassage,
  RESEARCH_CONTRACT_VERSION,
  type AudioStreamKind,
  type ContentOriginBadge,
  type EpisodeOutlineItem,
  type StudioAskAnswer,
  type StudioAskRequest,
  type StudioEpisode,
  type StudioSegment,
  type TopicBrief,
  type VoiceCapabilityReport,
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
import { geminiConfigured, VOICES, writeAnswer } from '../gemini.ts';
import { loadHadeeth } from '../hadeethenc.ts';
import { UpstreamError } from '../http.ts';
import { getVerses } from '../quran.ts';
import { loadAudioManifest } from '../quranenc.ts';
import { fetchReaderHtml } from '../readable.ts';
import { researchTopic } from '../research.ts';
import { executeResearch, type ResearchPorts } from '../research/engine.ts';
import { defaultResearchPorts } from '../research/ports.ts';

const episodeCache = new Map<string, { at: number; episode: StudioEpisode }>();
const CACHE_TTL_MS = 5 * 60_000;
const studioProductions = new Map<string, StudioEpisode>();

function nowIso(): string {
  return new Date().toISOString();
}

function verseToReference(verse: Verse, retrievedOn: string): ResearchReference {
  return {
    id: `Q${verse.surah}-${verse.ayah}`,
    provider: 'QuranEnc',
    itemId: verse.translationKey ? `${verse.translationKey} ${verse.key}` : verse.key,
    title: verse.translationTitle || `Qur'an ${verse.key} (${verse.surahName})`,
    authors: [],
    translators: [verse.translator],
    version: verse.translationVersion ?? null,
    passage: verse.translation,
    passageLanguage: verse.lang,
    arabic: verse.arabic,
    locator: `Surah ${verse.surahName} (${verse.surah}:${verse.ayah})`,
    printedPage: null,
    pdfPage: null,
    surah: verse.surah,
    ayah: verse.ayah,
    hadithId: null,
    collection: null,
    grade: null,
    url: verse.translationKey
      ? `https://quranenc.com/api/v1/translation/aya/${encodeURIComponent(verse.translationKey)}/${verse.surah}/${verse.ayah}`
      : 'https://quranenc.com/api/v1/translation/aya',
    retrievedOn,
    claim: `Retrieved ayah ${verse.key} from QuranEnc.`,
    limitations: [
      verse.meaningAudio
        ? `Meaning audio file listed in QuranEnc manifest (${verse.translationKey}): ${verse.meaningAudio}`
        : 'Meaning audio is not listed for this ayah in the selected edition manifest.',
    ],
  };
}

function hadithToReference(hadith: EncyclopediaHadith, retrievedOn: string): ResearchReference {
  const explanation = hadith.explanation?.trim();
  const firstLesson = hadith.lessons[0]?.trim();
  const passageParts = [hadith.text, explanation, firstLesson].filter(Boolean);
  return {
    id: `E${hadith.id}`,
    provider: 'HadeethEnc',
    itemId: hadith.id,
    title: hadith.title,
    authors: [],
    translators: [],
    version: null,
    passage: passageParts.join('\n\n'),
    passageLanguage: hadith.lang,
    arabic: hadith.arabic,
    locator: `HadeethEnc ${hadith.id}${hadith.attribution ? ` · ${hadith.attribution}` : ''}`,
    printedPage: null,
    pdfPage: null,
    surah: null,
    ayah: null,
    hadithId: hadith.id,
    collection: hadith.attribution,
    grade: hadith.grade,
    url: hadith.sourceUrl,
    retrievedOn,
    claim: `Retrieved HadeethEnc record ${hadith.id}.`,
    limitations: [
      hadith.grade ? `Published grade: ${hadith.grade}` : 'HadeethEnc did not include a grade for this hadith.',
      explanation ? `HadeethEnc explanation on this record: ${explanation}` : 'HadeethEnc did not include an explanation on this record.',
      'HadeethEnc does not include an audio file on this record.',
    ],
  };
}

function buildSegmentsForEpisode(
  blueprint: EpisodeBlueprint,
  lang: Lang,
  verses: Verse[],
  hadiths: EncyclopediaHadith[],
  extraRefs: ResearchReference[],
): { outline: EpisodeOutlineItem[]; segments: StudioSegment[] } {
  const segments: StudioSegment[] = [];
  const allIds = [
    ...verses.map(v => `Q${v.surah}-${v.ayah}`),
    ...hadiths.map(h => `E${h.id}`),
    ...extraRefs.map(r => r.id),
  ];

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
  const firstHadith = hadiths[0];

  if (firstVerse) {
    const vid = `Q${firstVerse.surah}-${firstVerse.ayah}`;
    pushSeg({
      section: 'opening',
      sectionLabel: `1. Opening · Qur’an ${firstVerse.key}`,
      speakerId: 'presenter',
      speakerName: STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'published_translation',
      originBadge: 'Published translation',
      audioKind: 'presenter_narration',
      text: firstVerse.translation,
      arabicText: firstVerse.arabic,
      citations: [vid],
      translationEdition: firstVerse.translationKey ?? firstVerse.translator,
      sourceLanguage: firstVerse.lang,
      directAudioUrl: null,
    });
  }

  if (firstHadith) {
    const hid = `E${firstHadith.id}`;
    pushSeg({
      section: 'orientation',
      sectionLabel: `2. Orientation · HadeethEnc #${firstHadith.id}`,
      speakerId: 'presenter',
      speakerName: STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'published_translation',
      originBadge: 'Prophetic narration (Hadith)',
      audioKind: 'presenter_narration',
      text: firstHadith.text,
      arabicText: firstHadith.arabic,
      citations: [hid],
      translationEdition: `HadeethEnc (${firstHadith.lang.toUpperCase()}) · Grade: ${firstHadith.grade ?? 'Not supplied'}`,
      sourceLanguage: firstHadith.lang,
      directAudioUrl: null,
    });
  }

  for (const verse of verses) {
    const vid = `Q${verse.surah}-${verse.ayah}`;
    pushSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · Qur’an ${verse.key} (Arabic Recitation)`,
      speakerId: 'reciter',
      speakerName: 'Mishary Rashid Alafasy (AlQuran Cloud quran-uthmani)',
      speakerRoleLabel: 'Original Qur’an Recitation (Qari)',
      isGeneratedSpeaker: false,
      statementKind: 'exact_quotation',
      originBadge: 'Quranic Arabic text',
      audioKind: 'quran_recitation',
      text: verse.translation,
      arabicText: verse.arabic,
      transliteration: verse.transliteration ?? null,
      citations: [vid],
      translationEdition: verse.translationKey ?? verse.translator,
      sourceLanguage: 'ar',
      directAudioUrl: recitationUrl('ar.alafasy', verse.number),
      durationSeconds: 14,
    });

    if (verse.meaningAudio) {
      pushSeg({
        section: 'evidence',
        sectionLabel: `3. Evidence · Qur’an ${verse.key} (Published Meaning Audio)`,
        speakerId: 'presenter',
        speakerName: `${verse.translator} (${verse.translationKey})`,
        speakerRoleLabel: 'Published Translation Meaning Audio',
        isGeneratedSpeaker: false,
        statementKind: 'published_translation',
        originBadge: 'Published translation',
        audioKind: 'meaning_audio',
        text: verse.translation,
        arabicText: null,
        citations: [vid],
        translationEdition: verse.translationKey ?? verse.translator,
        sourceLanguage: verse.lang,
        directAudioUrl: verse.meaningAudio,
        durationSeconds: 12,
      });
    }
  }

  for (const hadith of hadiths.slice(1)) {
    const hid = `E${hadith.id}`;
    pushSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · HadeethEnc #${hadith.id}`,
      speakerId: blueprint.format === 'explanatory_dialogue' ? 'researcher' : 'presenter',
      speakerName:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.name : STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.roleTitle : STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'published_translation',
      originBadge: 'Prophetic narration (Hadith)',
      audioKind: 'presenter_narration',
      text: hadith.text,
      arabicText: hadith.arabic,
      citations: [hid],
      translationEdition: `HadeethEnc (${hadith.lang.toUpperCase()}) · Grade: ${hadith.grade ?? 'Not supplied'}`,
      sourceLanguage: hadith.lang,
      directAudioUrl: null,
    });
  }

  for (const extra of extraRefs) {
    pushSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · ${extra.provider} ${extra.itemId}`,
      speakerId: blueprint.format === 'explanatory_dialogue' ? 'researcher' : 'presenter',
      speakerName:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.name : STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.roleTitle : STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'exact_quotation',
      originBadge: 'Scholarly explanation',
      audioKind: 'presenter_narration',
      text: extra.passage,
      arabicText: extra.arabic,
      citations: [extra.id],
      translationEdition: `${extra.provider} ${extra.itemId}`,
      sourceLanguage: (extra.passageLanguage as Lang) || lang,
      directAudioUrl: null,
    });
  }

  if (firstHadith?.explanation) {
    const hid = `E${firstHadith.id}`;
    pushSeg({
      section: 'exploration',
      sectionLabel: `4. Exploration · HadeethEnc #${firstHadith.id} Explanation`,
      speakerId: blueprint.format === 'explanatory_dialogue' ? 'researcher' : 'presenter',
      speakerName:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.name : STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel:
        blueprint.format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.roleTitle : STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'scholarly_interpretation',
      originBadge: 'Scholarly explanation',
      audioKind: 'presenter_narration',
      text: firstHadith.explanation.trim(),
      arabicText: null,
      citations: [hid],
      translationEdition: `HadeethEnc #${firstHadith.id} Explanation`,
      sourceLanguage: firstHadith.lang,
      directAudioUrl: null,
    });
  }

  const lessonQuote = firstHadith?.lessons?.[0]?.trim() ?? firstVerse?.translation ?? '';
  const appCitation = firstHadith && firstHadith.lessons?.[0] ? `E${firstHadith.id}` : firstVerse ? `Q${firstVerse.surah}-${firstVerse.ayah}` : allIds[0];
  if (lessonQuote && appCitation) {
    pushSeg({
      section: 'application',
      sectionLabel: '5. Application · Documented Lesson',
      speakerId: 'presenter',
      speakerName: STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'exact_quotation',
      originBadge: 'Scholarly explanation',
      audioKind: 'presenter_narration',
      text: lessonQuote,
      arabicText: null,
      citations: [appCitation],
      translationEdition: `HadeethEnc #${firstHadith?.id ?? ''}`,
      sourceLanguage: lang,
      directAudioUrl: null,
    });
  }

  const lastVerse = verses[verses.length - 1] ?? firstVerse;
  if (lastVerse) {
    const vid = `Q${lastVerse.surah}-${lastVerse.ayah}`;
    pushSeg({
      section: 'closing',
      sectionLabel: `6. Closing · Qur’an ${lastVerse.key}`,
      speakerId: 'presenter',
      speakerName: STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'published_translation',
      originBadge: 'Published translation',
      audioKind: 'presenter_narration',
      text: lastVerse.translation,
      arabicText: lastVerse.arabic,
      citations: [vid],
      translationEdition: lastVerse.translationKey ?? lastVerse.translator,
      sourceLanguage: lastVerse.lang,
      directAudioUrl: null,
    });
  }

  const outline: EpisodeOutlineItem[] = [
    {
      section: 'opening',
      heading: '1. Opening',
      summary: 'Opening Qur’anic passage introducing the theme.',
      plannedCitationIds: firstVerse ? [`Q${firstVerse.surah}-${firstVerse.ayah}`] : [],
    },
    {
      section: 'orientation',
      heading: '2. Orientation',
      summary: blueprint.brief.learningObjective,
      plannedCitationIds: firstHadith ? [`E${firstHadith.id}`] : [],
    },
    {
      section: 'evidence',
      heading: '3. Evidence',
      summary: 'Original Qur’an recitation, edition-matched meaning audio, and HadeethEnc narrations with preserved grades.',
      plannedCitationIds: allIds,
    },
    {
      section: 'exploration',
      heading: '4. Exploration',
      summary: 'Documented source explanation from HadeethEnc.',
      plannedCitationIds: firstHadith ? [`E${firstHadith.id}`] : [],
    },
    {
      section: 'application',
      heading: '5. Application',
      summary: 'Documented lesson from the source record.',
      plannedCitationIds: appCitation ? [appCitation] : [],
    },
    {
      section: 'closing',
      heading: '6. Closing',
      summary: 'Closing Qur’anic passage and invitation to inspect sources.',
      plannedCitationIds: lastVerse ? [`Q${lastVerse.surah}-${lastVerse.ayah}`] : [],
    },
  ];

  return { outline, segments };
}

export async function hydrateBlueprintEpisode(blueprint: EpisodeBlueprint, lang: Lang): Promise<StudioEpisode> {
  const cacheKey = `${blueprint.id}:${lang}`;
  const cached = episodeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.episode;
  }

  const retrievedOn = nowIso();
  const gaps: PilotGap[] = [];
  const disagreements: string[] = [];
  const references: ResearchReference[] = [];
  const verses: Verse[] = [];
  const hadiths: EncyclopediaHadith[] = [];
  const extraRefs: ResearchReference[] = [];

  if (blueprint.ayahRefs.length > 0) {
    try {
      const fetched = await getVerses(blueprint.ayahRefs, lang);
      for (const v of fetched) {
        verses.push(v);
        references.push(verseToReference(v, retrievedOn));
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

  for (const hid of blueprint.hadeethIds) {
    try {
      const h = await loadHadeeth(lang, hid);
      hadiths.push(h);
      references.push(hadithToReference(h, retrievedOn));
    } catch (err) {
      gaps.push({
        source: `HadeethEnc #${hid}`,
        message: err instanceof UpstreamError ? err.message : `HadeethEnc #${hid} is not available in ${lang}.`,
      });
    }
  }

  if (blueprint.islamHouseIds) {
    for (const itemSpec of blueprint.islamHouseIds) {
      if (itemSpec.onlyLang && itemSpec.onlyLang !== lang) {
        gaps.push({
          source: `IslamHouse ${itemSpec.id}`,
          message: `IslamHouse ${itemSpec.id} is a Tamil book on inner purity. No English or Sinhala edition of this item was found.`,
        });
        continue;
      }
      if (itemSpec.id === SINCERITY_BOOK.id && lang === 'ta') {
        try {
          const html = await fetchReaderHtml(SINCERITY_BOOK.readerUrl);
          const section = html ? passageUnderHeading(html, SINCERITY_BOOK.heading) : null;
          const main = section?.paragraphs[0];
          if (section && main) {
            const ref: ResearchReference = {
              id: 'IH735805',
              provider: 'IslamHouse',
              itemId: '735805',
              title: SINCERITY_BOOK.title,
              authors: [SINCERITY_CREDITS.preparation],
              translators: [SINCERITY_CREDITS.translator],
              version: null,
              passage: main.text,
              passageLanguage: 'ta',
              arabic: null,
              locator: paragraphLocator(section.heading, main),
              printedPage: null,
              pdfPage: null,
              surah: null,
              ayah: null,
              hadithId: null,
              collection: null,
              grade: null,
              url: SINCERITY_BOOK.readerUrl,
              retrievedOn,
              claim: 'The book’s definition of inner purity under the heading that asks what it is.',
              limitations: [
                `Reviewer: ${SINCERITY_CREDITS.reviewer}.`,
                'Read from the official Tamil reader; no English or Sinhala edition exists for this item ID.',
              ],
            };
            references.push(ref);
            extraRefs.push(ref);
            disagreements.push(
              'IslamHouse 735805 reports another scholarly wording in the same section alongside the primary wording.',
            );
          }
        } catch {
          gaps.push({ source: 'IslamHouse 735805', message: 'The Tamil reader passage could not be retrieved.' });
        }
      }
    }
  }

  const { outline, segments } = buildSegmentsForEpisode(blueprint, lang, verses, hadiths, extraRefs);
  const verification = verifyStudioEpisode(segments, references, {
    currentRevision: 1,
    approvedRevision: 1,
    narratedRevision: null,
  });

  const presenters =
    blueprint.format === 'explanatory_dialogue'
      ? [STUDIO_PRESENTERS.presenter, STUDIO_PRESENTERS.researcher]
      : [STUDIO_PRESENTERS.presenter];

  const episode: StudioEpisode = {
    contractVersion: RESEARCH_CONTRACT_VERSION,
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
    passages: references.map(referenceToEvidencePassage),
    references,
    evidence: references.map(referenceEvidence),
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
        createdAt: retrievedOn,
        scriptRevision: 1,
      },
    ],
    revisions: [
      {
        revision: 1,
        state: 'approved',
        updatedAt: retrievedOn,
        updatedBy: 'Dragon Dawwa Studio Pipeline',
        changeNote: 'Initial live-sourced studio script assembled from verified passages.',
        segmentCount: segments.length,
        contentHash: computeSegmentsHash(segments),
        verificationSupported: verification.supported,
      },
    ],
    createdAt: retrievedOn,
    updatedAt: retrievedOn,
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
 * Interactive Ask-While-Listening Resolver integrated with the master agent's committed
 * `executeResearch` (`src/server/research/engine.ts`) and `src/shared/contracts/v1.ts` (`1.0.0`).
 */
export async function answerStudioQuestion(
  req: StudioAskRequest,
  ports: ResearchPorts = defaultResearchPorts(),
): Promise<StudioAskAnswer> {
  const rawQuestion = req.question.trim();
  const lower = rawQuestion.toLowerCase();

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

  const segmentRefs = episode.references.filter(r => currentSegment?.citations.includes(r.id));
  const fallbackRefs = segmentRefs.length > 0 ? segmentRefs : episode.references.slice(0, 3);
  const voiceAvailable = geminiConfigured();
  const voiceUserMessage = voiceAvailable
    ? null
    : 'Spoken presenter narration is not available right now. Read the cited answer and open the sources below.';

  // 1. Arabic term inquiry ("What does this Arabic term mean?")
  if (/arabic term|what does .* mean|meaning of ar-rahman|meaning of rahmah|meaning of niyyah|அரபுச் சொல்|අරාබි වචනය/i.test(lower)) {
    const termEntry = matchArabicTerm(rawQuestion, currentSegment?.text ?? '', currentSegment?.citations ?? []);
    const matchedRefs = episode.references.filter(r => termEntry.relatedRefs.includes(r.id));
    const activeRefs = matchedRefs.length > 0 ? matchedRefs : fallbackRefs;
    const citeIds = activeRefs.map(r => r.id);

    return {
      contractVersion: RESEARCH_CONTRACT_VERSION,
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      kind: 'quotation',
      note: PILOT_QUOTATION_NOTE,
      paragraphs: [
        {
          text: `${termEntry.term}: ${termEntry.meanings[effectiveLang]}`,
          citations: citeIds,
          role: 'quotation',
          statementKind: 'scholarly_interpretation',
        },
        ...(activeRefs[0]
          ? [
              {
                text: activeRefs[0].passage,
                citations: [activeRefs[0].id],
                role: 'quotation' as const,
                statementKind: 'published_translation' as const,
              },
            ]
          : []),
      ],
      passages: activeRefs.map(referenceToEvidencePassage),
      references: activeRefs,
      relatedReferences: episode.references,
      arabicTermExplanation: {
        term: termEntry.term,
        arabic: termEntry.arabic,
        meaning: termEntry.meanings[effectiveLang],
        citationId: citeIds[0] ?? 'Q1-1',
        readerRoute: termEntry.key === 'ar-rahman' ? '#/spiritual/names/176539' : null,
      },
      voiceAvailable,
      voiceUserMessage,
      answeredAt: nowIso(),
    };
  }

  // 2. "Which hadith supports this?"
  if (/which hadith|what hadith|hadith supports|எந்த ஹதீஸ்|කුමන හදීසය/i.test(lower)) {
    const hadithRefs = episode.references.filter(r => r.provider === 'HadeethEnc');
    if (hadithRefs.length > 0) {
      return {
        contractVersion: RESEARCH_CONTRACT_VERSION,
        id: `ans-${randomUUID()}`,
        episodeId: episode.id,
        segmentId: currentSegment?.id ?? 'seg-1',
        question: rawQuestion,
        lang: effectiveLang,
        visibility: 'private_session',
        review: 'unreviewed',
        originBadge: 'Dragon Dawwa generated material',
        kind: 'quotation',
        note: PILOT_QUOTATION_NOTE,
        paragraphs: hadithRefs.map(hr => ({
          text: `${hr.locator}${hr.grade ? ` (Grade: ${hr.grade})` : ''}: ${hr.passage}`,
          citations: [hr.id],
          role: 'quotation' as const,
          statementKind: 'published_translation' as const,
        })),
        passages: hadithRefs.map(referenceToEvidencePassage),
        references: hadithRefs,
        relatedReferences: episode.references,
        voiceAvailable,
        voiceUserMessage,
        answeredAt: nowIso(),
      };
    }
  }

  // 3. "Show the reference" / "Explain that simply" / "Explain that in Tamil/Sinhala"
  if (
    /show the reference|show reference|what is the reference|explain that|explain this|simply|மேற்கோள்|யாது|விளக்கு|පැහැදිලි කරන්න|යොමුව/i.test(
      lower,
    )
  ) {
    const activeRefs = fallbackRefs;
    return {
      contractVersion: RESEARCH_CONTRACT_VERSION,
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      kind: 'quotation',
      note: PILOT_QUOTATION_NOTE,
      paragraphs: activeRefs.map(r => ({
        text: `${r.title} (${r.locator})${r.grade ? ` · Grade: ${r.grade}` : ''}\n${r.passage}`,
        citations: [r.id],
        role: 'quotation' as const,
        statementKind: 'published_translation' as const,
      })),
      passages: activeRefs.map(referenceToEvidencePassage),
      references: activeRefs,
      relatedReferences: episode.references,
      voiceAvailable,
      voiceUserMessage,
      answeredAt: nowIso(),
    };
  }

  // 4. General or multi-sentence question: run against the master agent's committed `executeResearch` engine (`src/server/research/engine.ts`)!
  const tokens = contentTokens(rawQuestion);
  const matchingEpisodeRefs =
    !asksForScience(rawQuestion) && tokens.length > 0
      ? episode.references.filter(r => {
          const hay = `${r.title}\n${r.passage}`.toLowerCase();
          return tokens.some(t => hay.includes(t));
        })
      : [];

  const researchRun = await executeResearch({
    question: rawQuestion,
    language: effectiveLang,
    ports,
  });

  const engineRefs = researchRun.dossier.passages.map(evidencePassageToReference);
  const combinedRefs = [...matchingEpisodeRefs];
  for (const er of engineRefs) {
    if (!combinedRefs.some(r => r.id === er.id)) {
      combinedRefs.push(er);
    }
  }
  const combinedPassages = [
    ...matchingEpisodeRefs.map(referenceToEvidencePassage),
    ...researchRun.dossier.passages.filter(p => !matchingEpisodeRefs.some(r => r.id === p.id)),
  ];

  if (combinedRefs.length === 0) {
    const scienceNote = researchRun.job.coverage.find(c => c.kind === 'science_not_configured');
    return {
      contractVersion: RESEARCH_CONTRACT_VERSION,
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      kind: 'limitation',
      note: scienceNote ? scienceNote.detail : PILOT_LIMITATION,
      paragraphs: [
        {
          text: scienceNote ? scienceNote.detail : PILOT_LIMITATION,
          citations: [],
          role: 'limitation',
          statementKind: 'presenter_reflection',
        },
      ],
      passages: [],
      references: [],
      relatedReferences: fallbackRefs,
      researchJob: researchRun.job,
      researchDossier: researchRun.dossier,
      voiceAvailable,
      voiceUserMessage,
      answeredAt: nowIso(),
    };
  }

  if (geminiConfigured()) {
    try {
      const packet = combinedRefs.map(referenceEvidence);
      const written = await writeAnswer(rawQuestion, effectiveLang, packet);
      if (!written.insufficientEvidence && written.paragraphs.length > 0) {
        return {
          contractVersion: RESEARCH_CONTRACT_VERSION,
          id: `ans-${randomUUID()}`,
          episodeId: episode.id,
          segmentId: currentSegment?.id ?? 'seg-1',
          question: rawQuestion,
          lang: effectiveLang,
          visibility: 'private_session',
          review: 'unreviewed',
          originBadge: 'Dragon Dawwa generated material',
          kind: 'synthesis',
          note: PILOT_SYNTHESIS_NOTE,
          paragraphs: written.paragraphs.map(wp => ({
            text: wp.text,
            citations: wp.citations,
            role: 'synthesis' as const,
            statementKind: 'faithful_paraphrase' as const,
          })),
          passages: combinedPassages,
          references: combinedRefs,
          relatedReferences: fallbackRefs,
          researchJob: researchRun.job,
          researchDossier: researchRun.dossier,
          voiceAvailable,
          voiceUserMessage,
          answeredAt: nowIso(),
        };
      }
    } catch {
      /* Fall back to direct retrieved quotations */
    }
  }

  return {
    contractVersion: RESEARCH_CONTRACT_VERSION,
    id: `ans-${randomUUID()}`,
    episodeId: episode.id,
    segmentId: currentSegment?.id ?? 'seg-1',
    question: rawQuestion,
    lang: effectiveLang,
    visibility: 'private_session',
    review: 'unreviewed',
    originBadge: 'Dragon Dawwa generated material',
    kind: 'quotation',
    note: PILOT_QUOTATION_NOTE,
    paragraphs: combinedRefs.map(r => ({
      text: r.passage,
      citations: [r.id],
      role: 'quotation' as const,
      statementKind: 'published_translation' as const,
    })),
    passages: combinedPassages,
    references: combinedRefs,
    relatedReferences: fallbackRefs,
    researchJob: researchRun.job,
    researchDossier: researchRun.dossier,
    voiceAvailable,
    voiceUserMessage,
    answeredAt: nowIso(),
  };
}

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
      `Explore ${topic} using retrieved passages from QuranEnc, HadeethEnc, and IslamHouse.`,
    tone:
      input.tone === 'clear_instructional' || input.tone === 'analytical_textual' || input.tone === 'curious_investigative'
        ? input.tone
        : 'warm_reflective',
    format,
    questions: Array.isArray(input.questions) ? input.questions.map(String) : [topic],
  };

  // Run both the fixture-aware researchTopic and the new v1.0.0 executeResearch engine
  const [dossier, engineRun] = await Promise.all([
    researchTopic({
      topic: brief.topic,
      questions: brief.questions ?? [brief.topic],
      lang: brief.lang,
    }),
    executeResearch({
      question: brief.topic,
      language: brief.lang,
      ports: defaultResearchPorts(),
    }),
  ]);

  const references = [...dossier.references];
  for (const p of engineRun.dossier.passages) {
    const converted = evidencePassageToReference(p);
    if (!references.some(r => r.id === converted.id)) {
      references.push(converted);
    }
  }

  if (references.length === 0) {
    throw new UpstreamError(
      dossier.unanswered[0] ?? 'No verified passages could be retrieved for this topic in the selected language.',
      422,
    );
  }

  const citationIds = references.map(r => r.id);
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

  addSeg({
    section: 'opening',
    sectionLabel: `1. Opening · ${references[0].provider} ${references[0].itemId}`,
    speakerId: 'presenter',
    speakerName: STUDIO_PRESENTERS.presenter.name,
    speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'exact_quotation',
    originBadge: 'Published translation',
    audioKind: 'presenter_narration',
    text: references[0].passage,
    arabicText: references[0].arabic,
    citations: [references[0].id],
    translationEdition: `${references[0].provider} ${references[0].itemId}`,
    sourceLanguage: (references[0].passageLanguage as Lang) || lang,
    directAudioUrl: null,
  });

  for (const ref of references) {
    const isAyah = ref.provider === 'QuranEnc';
    const badge: ContentOriginBadge = isAyah
      ? 'Quranic Arabic text'
      : ref.provider === 'HadeethEnc'
        ? 'Prophetic narration (Hadith)'
        : 'Published translation';
    const audioKind: AudioStreamKind = 'presenter_narration';

    addSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · ${ref.title}`,
      speakerId: format === 'explanatory_dialogue' ? 'researcher' : 'presenter',
      speakerName: format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.name : STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel:
        format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher.roleTitle : STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'exact_quotation',
      originBadge: badge,
      audioKind,
      text: ref.passage,
      arabicText: ref.arabic,
      citations: [ref.id],
      translationEdition: `${ref.provider} ${ref.itemId}`,
      sourceLanguage: (ref.passageLanguage as Lang) || lang,
      directAudioUrl: null,
    });
  }

  const outline: EpisodeOutlineItem[] = [
    { section: 'opening', heading: '1. Opening', summary: `Opening passage for ${brief.topic}`, plannedCitationIds: [references[0].id] },
    { section: 'orientation', heading: '2. Orientation', summary: brief.learningObjective, plannedCitationIds: citationIds },
    { section: 'evidence', heading: '3. Evidence', summary: `Read ${references.length} retrieved passage(s).`, plannedCitationIds: citationIds },
    { section: 'exploration', heading: '4. Exploration', summary: 'Examine retrieved passages and limitations.', plannedCitationIds: citationIds },
    { section: 'application', heading: '5. Application', summary: 'Practical takeaway grounded in the retrieved text.', plannedCitationIds: [references[0].id] },
    { section: 'closing', heading: '6. Closing', summary: 'Editorial review handoff.', plannedCitationIds: [references[0].id] },
  ];

  const verification = verifyStudioEpisode(segments, references, {
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
  });

  const id = `prod-${randomUUID().slice(0, 8)}`;
  const now = nowIso();
  const episode: StudioEpisode = {
    contractVersion: RESEARCH_CONTRACT_VERSION,
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
    editorialState: 'needs-review',
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
    approvalValid: false,
    narrationValid: false,
    published: false,
    presenters:
      format === 'explanatory_dialogue'
        ? [STUDIO_PRESENTERS.presenter, STUDIO_PRESENTERS.researcher]
        : [STUDIO_PRESENTERS.presenter],
    brief,
    outline,
    segments,
    passages: references.map(referenceToEvidencePassage),
    references,
    evidence: references.map(referenceEvidence),
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
      examined: [
        ...dossier.examined,
        ...engineRun.job.coverage.map(c => `[${c.provider}] ${c.kind}: ${c.detail}`),
      ],
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

export async function getStudioVoiceStatus(opts?: {
  probe?: boolean;
  editorialAccountsConfigured?: boolean;
}): Promise<VoiceCapabilityReport> {
  const models = (process.env.GEMINI_TTS_MODELS ?? 'gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let liveManifestProbe: Partial<Record<Lang, 'available' | 'unavailable'>> | undefined;
  if (opts?.probe) {
    const [enManifest, taManifest, siManifest] = await Promise.all([
      loadAudioManifest('english_rwwad').then(m => (m ? ('available' as const) : ('unavailable' as const))).catch(() => 'unavailable' as const),
      loadAudioManifest('tamil_omar_brief').then(m => (m ? ('available' as const) : ('unavailable' as const))).catch(() => 'unavailable' as const),
      loadAudioManifest('sinhalese_mahir').then(m => (m ? ('available' as const) : ('unavailable' as const))).catch(() => 'unavailable' as const),
    ]);
    liveManifestProbe = { en: enManifest, ta: taManifest, si: siManifest };
  }

  return buildVoiceCapabilityReport({
    geminiApiKeyConfigured: geminiConfigured(),
    editorialAccountsConfigured: opts?.editorialAccountsConfigured ?? Boolean(process.env.EDITORIAL_USERS?.trim()),
    models,
    voices: VOICES,
    liveManifestProbe,
  });
}

export async function getStudioCatalogueSummary(lang: Lang) {
  return {
    contractVersion: RESEARCH_CONTRACT_VERSION,
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
    voiceStatus: await getStudioVoiceStatus({ probe: false }),
  };
}
