import type { Lang } from '../sources.ts';
import type { Evidence } from '../types.ts';
import type { ResearchDossier, ResearchReference, ScriptVerification } from '../research.ts';
import type { Role } from '../spiritual/governance.ts';

/**
 * Shared Contract Version between Dragon Dawwa Studio and the Master Knowledge/Research Engine.
 * Kept in `src/shared/studio/contracts.ts` to preserve clean file ownership boundaries.
 */
export const SHARED_CONTRACT_VERSION = 'dragon-dawwa-shared-contracts/v1' as const;

export type SourceProviderId = 'QuranEnc' | 'HadeethEnc' | 'IslamHouse' | 'AlQuranCloud' | 'Aladhan' | 'HadithApi' | 'SciencePrimary';

export type SourceContentType = 'ayah' | 'hadith' | 'book_section' | 'article_passage' | 'audio_recording' | 'name_of_allah' | 'scientific_publication';

export interface SourceCredit {
  role: 'author' | 'translator' | 'reviewer' | 'reciter' | 'speaker' | 'publisher' | 'collector';
  name: string;
}

export interface SourceRightsMetadata {
  tier: 'open_api_display' | 'in_app_attributed' | 'source_link_only';
  attributionRequired: boolean;
  redistributionAllowed: boolean;
  modificationAllowed: boolean;
  licenseNote: string;
}

/**
 * Shared Contract: SourceRecord
 * Identity, provider, language, edition/version, title, credits, canonical URL, content type, rights metadata, retrieval time.
 */
export interface SourceRecord {
  contractVersion: typeof SHARED_CONTRACT_VERSION;
  id: string;
  provider: SourceProviderId;
  itemId: string;
  language: Lang | 'ar';
  edition: string | null;
  version: string | null;
  title: string;
  credits: SourceCredit[];
  canonicalUrl: string | null;
  contentType: SourceContentType;
  rights: SourceRightsMetadata;
  retrievedAt: string;
}

/**
 * Shared Contract: EvidencePassage
 * Source identity, exact text, original language, locator such as ayah/hadith/page/section, surrounding context, internal reader route.
 */
export interface EvidencePassage {
  contractVersion: typeof SHARED_CONTRACT_VERSION;
  id: string;
  sourceId: string;
  source: SourceRecord;
  exactText: string;
  passageLanguage: Lang | 'ar';
  arabicText: string | null;
  originalLanguage: 'ar' | Lang;
  locator: string;
  surah: number | null;
  ayah: number | null;
  hadithId: string | null;
  collection: string | null;
  grade: string | null;
   grader: string | null;
  surroundingContext: string[];
  limitations: string[];
  internalReaderRoute: string;
  audioUrl?: string | null;
  audioKind?: AudioStreamKind | null;
}

export type ResearchOutcomeKind =
  | 'evidence_found'
  | 'no_relevant_evidence'
  | 'source_unavailable'
  | 'language_unavailable'
  | 'budget_exhausted'
  | 'conflicting_evidence'
  | 'scholarly_review_required';

/**
 * Shared Contract: ResearchJob
 * Question, language, subquestions, status, progress, cancellation, coverage and errors.
 */
export interface ResearchJobContract {
  contractVersion: typeof SHARED_CONTRACT_VERSION;
  id: string;
  question: string;
  lang: Lang;
  subquestions: string[];
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'error';
  progress: {
    step: 'decomposing' | 'retrieving_quran' | 'retrieving_hadith' | 'retrieving_library' | 'verifying' | 'complete';
    completedSteps: number;
    totalSteps: number;
    message: string;
  };
  cancellable: boolean;
  cancelledAt: string | null;
  coverage: {
    examined: string[];
    notExamined: string[];
  };
  errors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClaimEvidenceMapping {
  claimId: string;
  claimText: string;
  statementKind: StatementKind;
  citationIds: string[];
  status: 'supported' | 'unverified' | 'unfaithful' | 'missing_citation';
  note: string;
}

/**
 * Shared Contract: ResearchDossier
 * Passages, claim-evidence mappings, unresolved questions, disagreements and verification status.
 */
export interface ResearchDossierContract {
  contractVersion: typeof SHARED_CONTRACT_VERSION;
  topic: string;
  questions: string[];
  lang: Lang;
  outcome: ResearchOutcomeKind;
  passages: EvidencePassage[];
  claimMappings: ClaimEvidenceMapping[];
  unresolvedQuestions: string[];
  disagreements: string[];
  examined: string[];
  notExamined: string[];
  verification: ScriptVerification;
  retrievedAt: string;
}

/* ---------- Studio Audio & Statement Taxonomy ---------- */

/**
 * Four strictly separated audio stream kinds:
 * 1. quran_recitation — Original Qur'an recitation by a named qari (never synthesized by presenter TTS)
 * 2. meaning_audio — Published translation meaning audio matching the exact translation edition
 * 3. original_recording — Original scholar's lecture/bayan recording from the source archive
 * 4. presenter_narration — Generated Dragon Dawwa Studio presenter narration via approved Gemini TTS
 */
export type AudioStreamKind =
  | 'quran_recitation'
  | 'meaning_audio'
  | 'original_recording'
  | 'presenter_narration';

/**
 * Six distinct statement classifications required by Creativity with Faithfulness:
 * 1. exact_quotation
 * 2. published_translation
 * 3. faithful_paraphrase
 * 4. scholarly_interpretation
 * 5. presenter_reflection
 * 6. scientific_evidence
 */
export type StatementKind =
  | 'exact_quotation'
  | 'published_translation'
  | 'faithful_paraphrase'
  | 'scholarly_interpretation'
  | 'presenter_reflection'
  | 'scientific_evidence';

export type ContentOriginBadge =
  | 'Quranic Arabic text'
  | 'Published translation'
  | 'Prophetic narration (Hadith)'
  | 'Scholarly explanation'
  | 'Original scholar recording'
  | 'Dragon Dawwa generated material'
  | 'Scientific publication';

/* ---------- Programme Families & Episode Contracts ---------- */

export type ProgrammeFamilyId =
  | 'daily-reflection'
  | 'bayan-lessons'
  | 'hadith-lens'
  | 'purity-worship'
  | 'research-room'
  | 'faith-discovery'
  | 'knowing-allah';

export type PresentationFormat =
  | 'single_presenter'
  | 'explanatory_dialogue'
  | 'introduced_recording';

export type ScriptSectionKind =
  | 'opening'
  | 'orientation'
  | 'evidence'
  | 'exploration'
  | 'application'
  | 'closing';

export type StudioEditorialState =
  | 'draft'
  | 'researching'
  | 'scripted'
  | 'needs-review'
  | 'approved'
  | 'narrated'
  | 'published'
  | 'withdrawn';

export interface PresenterIdentity {
  id: 'sakinah' | 'tariq';
  name: string;
  roleTitle: string;
  voiceName: 'Kore' | 'Charon' | 'Aoede' | 'Puck' | 'Orus';
  isGenerated: true;
  disclosure: string;
  traits: string[];
  speakingStyle: string;
}

export interface ProgrammeFamily {
  id: ProgrammeFamilyId;
  channelNumber: string;
  dialFrequency: string;
  title: string;
  subtitle: string;
  description: string;
  defaultFormat: PresentationFormat;
  cadenceLabel: string;
  ornamentTheme: 'emerald' | 'gold' | 'lapis' | 'ivory';
  editorialPolicy: string;
}

export interface StudioSegment {
  id: string;
  index: number;
  section: ScriptSectionKind;
  sectionLabel: string;
  speakerId: 'sakinah' | 'tariq' | 'reciter' | 'original_speaker';
  speakerName: string;
  speakerRoleLabel: string;
  isGeneratedSpeaker: boolean;
  statementKind: StatementKind;
  originBadge: ContentOriginBadge;
  audioKind: AudioStreamKind;
  text: string;
  arabicText: string | null;
  transliteration?: string | null;
  citations: string[];
  translationEdition: string | null;
  sourceLanguage: Lang | 'ar';
  /** Direct media URL for quran_recitation, meaning_audio, or original_recording. */
  directAudioUrl: string | null;
  /** Estimated duration in seconds for timeline & seek bar. */
  durationSeconds: number;
  hypotheticalExample?: boolean;
  scientificLimitation?: string | null;
}

export interface TopicBrief {
  topic: string;
  audience: 'general' | 'new_learners' | 'students_of_knowledge' | 'families';
  lang: Lang;
  durationMinutes: number;
  familyId: ProgrammeFamilyId;
  learningObjective: string;
  tone: 'warm_reflective' | 'clear_instructional' | 'analytical_textual' | 'curious_investigative';
  format: PresentationFormat;
  questions?: string[];
}

export interface EpisodeOutlineItem {
  section: ScriptSectionKind;
  heading: string;
  summary: string;
  plannedCitationIds: string[];
}

export interface StudioReviewEntry {
  id: string;
  reviewerId: string;
  reviewerName: string;
  role: Role;
  decision: 'approved' | 'changes-requested';
  notes: string;
  createdAt: string;
  scriptRevision: number;
}

export interface StudioRevisionSnapshot {
  revision: number;
  state: StudioEditorialState;
  updatedAt: string;
  updatedBy: string;
  changeNote: string;
  segmentCount: number;
  contentHash: string;
  verificationSupported: boolean;
}

export interface StudioVerificationReport {
  supported: boolean;
  allCitationsResolve: boolean;
  quotationsMatchEdition: boolean;
  claimsSupported: boolean;
  languagesIdentified: boolean;
  gradesPreserved: boolean;
  scientificLimitationsRepresented: boolean;
  narrationMatchesApprovedRevision: boolean;
  missingCitations: string[];
  unfaithfulQuotations: string[];
  unsupportedClaims: string[];
  unresolvedCitationIds: string[];
  review: 'editorial';
  note: string;
}

export interface StudioEpisode {
  id: string;
  slug: string;
  familyId: ProgrammeFamilyId;
  title: string;
  subtitle: string;
  summary: string;
  lang: Lang;
  availableLanguages: Lang[];
  format: PresentationFormat;
  broadcastLabel: 'Recorded programme' | 'On demand';
  editorialState: StudioEditorialState;
  currentRevision: number;
  approvedRevision: number | null;
  narratedRevision: number | null;
  approvalValid: boolean;
  narrationValid: boolean;
  published: boolean;
  featuredTonight?: boolean;
  presenters: PresenterIdentity[];
  brief: TopicBrief;
  outline: EpisodeOutlineItem[];
  segments: StudioSegment[];
  passages: EvidencePassage[];
  gaps: { source: string; message: string }[];
  disagreements: string[];
  verification: StudioVerificationReport;
  reviews: StudioReviewEntry[];
  revisions: StudioRevisionSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioAskRequest {
  episodeId: string;
  segmentId: string;
  question: string;
  lang: Lang;
  targetLang?: Lang;
}

export interface StudioAskAnswer {
  id: string;
  episodeId: string;
  segmentId: string;
  question: string;
  lang: Lang;
  visibility: 'private_session';
  review: 'unreviewed';
  originBadge: 'Dragon Dawwa generated material';
  outcome: ResearchOutcomeKind;
  statusNote: string;
  paragraphs: {
    text: string;
    citations: string[];
    statementKind: StatementKind;
  }[];
  passages: EvidencePassage[];
  relatedSuggestedPassages: EvidencePassage[];
  arabicTermExplanation?: {
    term: string;
    arabic: string;
    meaning: string;
    citationId: string;
  } | null;
  voiceAvailable: boolean;
  voiceBlocker: string | null;
  answeredAt: string;
}

export interface VoiceCapabilityReport {
  provider: 'Google Gemini Neural TTS';
  configured: boolean;
  blocker: string | null;
  models: string[];
  voices: readonly string[];
  languages: Record<Lang, {
    supported: boolean;
    directionMode: string;
    note: string;
  }>;
  streaming: {
    supported: boolean;
    mode: string;
  };
  voiceConsistency: string;
  interruptions: string;
  audioFormats: string[];
  separationPolicy: Record<AudioStreamKind, string>;
}

/* ---------- Conversion Helpers from Shared Research Engine ---------- */

export function internalReaderRouteForReference(ref: ResearchReference): string {
  if (ref.provider === 'QuranEnc' && ref.surah && ref.ayah) {
    return `#/quran?surah=${ref.surah}&ayah=${ref.ayah}&lang=${ref.passageLanguage}`;
  }
  if (ref.provider === 'HadeethEnc' && ref.hadithId) {
    return `#/hadith/${ref.hadithId}?lang=${ref.passageLanguage}`;
  }
  if (ref.provider === 'IslamHouse' && ref.itemId) {
    return `#/spiritual/library/prayer?lang=${ref.passageLanguage}&item=${ref.itemId}`;
  }
  return '#/hub';
}

export function referenceToPassage(ref: ResearchReference): EvidencePassage {
  const lang = (ref.passageLanguage === 'ta' || ref.passageLanguage === 'si' ? ref.passageLanguage : 'en') as Lang;
  const credits: SourceCredit[] = [
    ...ref.authors.map(name => ({ role: 'author' as const, name })),
    ...ref.translators.map(name => ({ role: 'translator' as const, name })),
  ];
  const contentType: SourceContentType =
    ref.provider === 'QuranEnc'
      ? 'ayah'
      : ref.provider === 'HadeethEnc'
        ? 'hadith'
        : 'article_passage';

  const source: SourceRecord = {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: `src-${ref.id}`,
    provider: ref.provider,
    itemId: ref.itemId,
    language: lang,
    edition: ref.provider === 'QuranEnc' ? ref.itemId.split(' ')[0] ?? null : null,
    version: ref.version,
    title: ref.title,
    credits,
    canonicalUrl: ref.url || null,
    contentType,
    rights: {
      tier: ref.provider === 'IslamHouse' ? 'in_app_attributed' : 'open_api_display',
      attributionRequired: true,
      redistributionAllowed: ref.provider !== 'IslamHouse',
      modificationAllowed: false,
      licenseNote:
        ref.provider === 'IslamHouse'
          ? 'Read on demand with author, translator, and reviewer attribution preserved.'
          : `${ref.provider} public API passage with edition and version preserved unchanged.`,
    },
    retrievedAt: ref.retrievedOn,
  };

  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: ref.id,
    sourceId: source.id,
    source,
    exactText: ref.passage,
    passageLanguage: lang,
    arabicText: ref.arabic,
    originalLanguage: ref.arabic ? 'ar' : lang,
    locator: ref.locator,
    surah: ref.surah,
    ayah: ref.ayah,
    hadithId: ref.hadithId,
    collection: ref.collection,
    grade: ref.grade,
    grader: ref.grade ? ref.provider : null,
    surroundingContext: ref.limitations.filter(l => l.startsWith('Surrounding') || l.startsWith('Following')),
    limitations: ref.limitations,
    internalReaderRoute: internalReaderRouteForReference(ref),
  };
}

export function evidenceToPassage(ev: Evidence, defaultLang: Lang = 'en'): EvidencePassage {
  const lang = (ev.passageLanguage === 'ta' || ev.passageLanguage === 'si' ? ev.passageLanguage : defaultLang) as Lang;
  const surahMatch = ev.label.match(/(\d+):(\d+)/);
  const surah = surahMatch ? Number(surahMatch[1]) : null;
  const ayah = surahMatch ? Number(surahMatch[2]) : null;
  const hadithMatch = ev.label.match(/HadeethEnc\s+(\d+)/i);
  const hadithId = hadithMatch ? hadithMatch[1] : ev.kind === 'hadith' ? ev.itemId ?? null : null;
  const provider: SourceProviderId =
    ev.kind === 'quran'
      ? 'QuranEnc'
      : ev.label.includes('HadeethEnc')
        ? 'HadeethEnc'
        : ev.kind === 'hadith'
          ? 'HadithApi'
          : 'IslamHouse';

  const internalReaderRoute =
    surah && ayah
      ? `#/quran?surah=${surah}&ayah=${ayah}&lang=${lang}`
      : hadithId
        ? `#/hadith/${hadithId}?lang=${lang}`
        : ev.itemId
          ? `#/spiritual/library/prayer?lang=${lang}&item=${ev.itemId}`
          : '#/hub';

  const source: SourceRecord = {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: `src-${ev.id}`,
    provider,
    itemId: ev.itemId ?? ev.id,
    language: lang,
    edition: null,
    version: null,
    title: ev.label,
    credits: [{ role: 'publisher', name: ev.attribution }],
    canonicalUrl: ev.sourceUrl ?? null,
    contentType: ev.kind === 'quran' ? 'ayah' : ev.kind === 'hadith' ? 'hadith' : 'article_passage',
    rights: {
      tier: 'open_api_display',
      attributionRequired: true,
      redistributionAllowed: true,
      modificationAllowed: false,
      licenseNote: ev.attribution,
    },
    retrievedAt: ev.retrievedOn ?? new Date().toISOString(),
  };

  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    id: ev.id,
    sourceId: source.id,
    source,
    exactText: ev.text,
    passageLanguage: lang,
    arabicText: ev.arabic,
    originalLanguage: ev.arabic ? 'ar' : lang,
    locator: ev.locator ?? ev.label,
    surah,
    ayah,
    hadithId,
    collection: ev.kind === 'hadith' ? ev.label : null,
    grade: ev.grades[0]?.grade ?? null,
    grader: ev.grades[0]?.name ?? null,
    surroundingContext: [],
    limitations: ev.limitations ?? [],
    internalReaderRoute,
  };
}

export function passageToEvidence(p: EvidencePassage): Evidence {
  return {
    id: p.id,
    kind: p.source.contentType === 'ayah' ? 'quran' : p.source.contentType === 'hadith' ? 'hadith' : 'guide',
    label: p.source.title,
    arabic: p.arabicText,
    text: p.exactText,
    attribution: [
      p.source.title,
      ...p.source.credits.map(c => `${c.role}: ${c.name}`),
      p.locator,
      p.grade ? `Grade: ${p.grade}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    grades: p.grade ? [{ name: p.grader ?? p.source.provider, grade: p.grade }] : [],
    locator: p.locator,
    sourceUrl: p.source.canonicalUrl,
    passageLanguage: p.passageLanguage,
    retrievedOn: p.source.retrievedAt,
    itemId: p.source.itemId,
    limitations: p.limitations,
  };
}

export function dossierToContract(dossier: ResearchDossier, verification: ScriptVerification): ResearchDossierContract {
  const passages = dossier.references.map(referenceToPassage);
  const outcome: ResearchOutcomeKind =
    passages.length > 0
      ? dossier.disagreements.length > 0
        ? 'conflicting_evidence'
        : 'evidence_found'
      : dossier.unanswered.some(u => /not available in|no .* edition/i.test(u))
        ? 'language_unavailable'
        : dossier.unanswered.some(u => /did not respond|could not be read|did not return/i.test(u))
          ? 'source_unavailable'
          : 'no_relevant_evidence';

  return {
    contractVersion: SHARED_CONTRACT_VERSION,
    topic: dossier.topic,
    questions: dossier.questions,
    lang: dossier.lang,
    outcome,
    passages,
    claimMappings: passages.map(p => ({
      claimId: `claim-${p.id}`,
      claimText: p.exactText,
      statementKind: p.source.contentType === 'ayah' || p.source.contentType === 'hadith' ? 'published_translation' : 'exact_quotation',
      citationIds: [p.id],
      status: 'supported',
      note: `Verified against ${p.source.provider} (${p.locator}).`,
    })),
    unresolvedQuestions: dossier.unanswered,
    disagreements: dossier.disagreements,
    examined: dossier.examined,
    notExamined: dossier.notExamined,
    verification,
    retrievedAt: dossier.references[0]?.retrievedOn ?? new Date().toISOString(),
  };
}
