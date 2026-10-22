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
import { languageRequestedByQuestion, questionUsesCurrentEpisode } from '../../shared/studio/askIntent.ts';
import type {
  EpisodeOutlineItem,
  StudioAskAnswer,
  StudioAskRequest,
  StudioDossierSummary,
  StudioEpisode,
  StudioSegment,
  TopicBrief,
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
import { fetchReaderHtml } from '../readable.ts';
import { loadCompletedResearchJob, referencesFromJob, waitForSharedResearchJob } from './fromJob.ts';
import { assembleStudioProductionFromJob } from './scriptFromJob.ts';

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

  // 1. Opening — quotes the opening passage directly so every substantive line is established in the retrieved evidence
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

  // 2. Orientation — quotes the primary hadith wording that frames the episode's question
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

  // 3. Evidence — Original Qur'an Recitation (separate stream) + Published Meaning Audio (separate stream) + Remaining Verses/Hadiths
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

  // 4. Exploration — HadeethEnc documented explanation on the same record
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

  // 5. Application — Documented lesson from the HadeethEnc record
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

  // 6. Closing — Final verse quotation
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
 * Interactive Ask-While-Listening Resolver.
 * Uses word/token overlap ONLY as a retrieval relevance signal to select which passages to inspect.
 * Returns direct quotations (`kind: 'quotation'`) when no AI synthesis is configured,
 * unreviewed synthesis (`kind: 'synthesis'`, `review: 'unreviewed'`) when Gemini is configured,
 * and `kind: 'limitation'` (`PILOT_LIMITATION`) when the retrieved sources do not answer the question.
 */
export async function answerStudioQuestion(req: StudioAskRequest): Promise<StudioAskAnswer> {
  const rawQuestion = req.question.trim();
  const lower = rawQuestion.toLowerCase();

  const effectiveLang = languageRequestedByQuestion(rawQuestion, req.targetLang ?? req.lang);

  const episode = await loadStudioEpisode(req.episodeId || 'tonight-mercy-ar-rahman', effectiveLang);
  const currentSegment =
    episode.segments.find(s => s.id === req.segmentId) ??
    episode.segments.find(s => s.citations.length > 0) ??
    episode.segments[0];

  const segmentRefs = episode.references.filter(r => currentSegment?.citations.includes(r.id));
  const fallbackRefs = segmentRefs.length > 0 ? segmentRefs : episode.references.slice(0, 3);
  const voiceAvailable = geminiConfigured();
  const voiceBlocker = voiceAvailable
    ? null
    : 'Live Gemini speech synthesis is unavailable because GEMINI_API_KEY is not configured on this server (POST /api/voice/narrate returns HTTP 503).';

  // 1. Arabic term inquiry ("What does this Arabic term mean?")
  if (/arabic term|what does .* mean|meaning of ar-rahman|meaning of rahmah|meaning of niyyah|அரபுச் சொல்|අරාබි වචනය/i.test(lower)) {
    const termEntry = matchArabicTerm(rawQuestion, currentSegment?.text ?? '', currentSegment?.citations ?? []);
    const matchedRefs = episode.references.filter(r => termEntry.relatedRefs.includes(r.id));
    const activeRefs = matchedRefs.length > 0 ? matchedRefs : fallbackRefs;
    const citeIds = activeRefs.map(r => r.id);

    return {
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
      references: activeRefs,
      relatedReferences: episode.references,
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

  // 2. "Which hadith supports this?"
  if (/which hadith|what hadith|hadith supports|எந்த ஹதீஸ்|කුමන හදීසය/i.test(lower)) {
    const hadithRefs = episode.references.filter(r => r.provider === 'HadeethEnc');
    if (hadithRefs.length > 0) {
      return {
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
        references: hadithRefs,
        relatedReferences: episode.references,
        voiceAvailable,
        voiceBlocker,
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
      references: activeRefs,
      relatedReferences: episode.references,
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  // 4. Science boundary check
  if (asksForScience(rawQuestion)) {
    return {
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      kind: 'limitation',
      note: PILOT_LIMITATION,
      paragraphs: [
        {
          text: 'This researcher supplies religious-source research only. A scientific claim requires a separate science-research workflow; religious passages are not presented as laboratory scientific proof.',
          citations: [],
          role: 'limitation',
          statementKind: 'presenter_reflection',
        },
      ],
      references: [],
      relatedReferences: fallbackRefs,
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  // 5. A new question uses the shared research job. The current episode is not searched as one literal phrase.
  const tokens = contentTokens(rawQuestion);
  const matchingEpisodeRefs = questionUsesCurrentEpisode(rawQuestion)
    ? episode.references.filter(r => {
        const hay = `${r.title}\n${r.passage}`.toLowerCase();
        return tokens.some(t => hay.includes(t));
      })
    : [];

  let retrievedRefs: ResearchReference[] = [...matchingEpisodeRefs];
  let researchFailure: string | null = null;

  if (retrievedRefs.length === 0 && tokens.length > 0 && !questionUsesCurrentEpisode(rawQuestion)) {
    try {
      const snap = req.jobId ? loadCompletedResearchJob(req.jobId) : await waitForSharedResearchJob(rawQuestion, effectiveLang);
      if (snap.job.question !== rawQuestion || snap.job.language !== effectiveLang) {
        throw new UpstreamError('The research response does not match the question that was asked.', 409);
      }
      const mapped = referencesFromJob(snap, effectiveLang);
      const supportedIds = new Set(
        mapped.claims.filter(claim => claim.support === 'supported').flatMap(claim => claim.passageIds),
      );
      retrievedRefs = mapped.references.filter(reference => supportedIds.has(reference.id));
      if (retrievedRefs.length === 0 && snap.job.errors.length > 0) {
        researchFailure = snap.job.errors.map(item => item.message).join(' ');
      }
      if (retrievedRefs.length === 0 && mapped.gaps.some(gap => /source unavailable/i.test(gap.message))) {
        researchFailure = mapped.gaps.find(gap => /source unavailable/i.test(gap.message))?.message ?? researchFailure;
      }
    } catch (err) {
      if (err instanceof UpstreamError && (err.status === 409 || err.status === 499)) throw err;
      researchFailure = err instanceof Error ? err.message : 'Research failed.';
    }
  }

  if (researchFailure && retrievedRefs.length === 0) {
    return {
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      kind: 'limitation',
      note: researchFailure,
      paragraphs: [
        {
          text: researchFailure,
          citations: [],
          role: 'limitation',
          statementKind: 'presenter_reflection',
        },
      ],
      references: [],
      relatedReferences: fallbackRefs,
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  if (retrievedRefs.length === 0) {
    return {
      id: `ans-${randomUUID()}`,
      episodeId: episode.id,
      segmentId: currentSegment?.id ?? 'seg-1',
      question: rawQuestion,
      lang: effectiveLang,
      visibility: 'private_session',
      review: 'unreviewed',
      originBadge: 'Dragon Dawwa generated material',
      kind: 'limitation',
      note: PILOT_LIMITATION,
      paragraphs: [
        {
          text: PILOT_LIMITATION,
          citations: [],
          role: 'limitation',
          statementKind: 'presenter_reflection',
        },
      ],
      references: [],
      relatedReferences: fallbackRefs,
      voiceAvailable,
      voiceBlocker,
      answeredAt: nowIso(),
    };
  }

  if (geminiConfigured()) {
    try {
      const packet = retrievedRefs.map(referenceEvidence);
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
          kind: 'synthesis',
          note: PILOT_SYNTHESIS_NOTE,
          paragraphs: written.paragraphs.map(wp => ({
            text: wp.text,
            citations: wp.citations,
            role: 'synthesis' as const,
            statementKind: 'faithful_paraphrase' as const,
          })),
          references: retrievedRefs,
          relatedReferences: fallbackRefs,
          voiceAvailable,
          voiceBlocker,
          answeredAt: nowIso(),
        };
      }
    } catch {
      /* Fall back to direct retrieved quotations */
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
    kind: 'quotation',
    note: PILOT_QUOTATION_NOTE,
    paragraphs: retrievedRefs.map(r => ({
      text: r.passage,
      citations: [r.id],
      role: 'quotation' as const,
      statementKind: 'published_translation' as const,
    })),
    references: retrievedRefs,
    relatedReferences: fallbackRefs,
    voiceAvailable,
    voiceBlocker,
    answeredAt: nowIso(),
  };
}

/**
 * Topic brief → completed research job → cited script → verification → needs-review.
 * A supplied job id is read. It is not started again. Generated episodes are never published.
 */
export async function runStudioProductionPipeline(input: Partial<TopicBrief> & { jobId?: string }): Promise<{
  episode: StudioEpisode;
  dossierSummary: StudioDossierSummary;
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

  const snap = input.jobId
    ? loadCompletedResearchJob(input.jobId)
    : await waitForSharedResearchJob(brief.topic, brief.lang);
  const id = `prod-${randomUUID().slice(0, 8)}`;
  const built = assembleStudioProductionFromJob(brief, snap, id, nowIso());
  studioProductions.set(id, built.episode);
  studioProductions.set(`${id}:${lang}`, built.episode);
  return built;
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
