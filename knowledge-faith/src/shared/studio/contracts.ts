import type { Lang } from '../sources.ts';
import type { Evidence, PodcastLine } from '../types.ts';
import {
  referenceEvidence,
  type ResearchDossier,
  type ResearchReference,
  type ScriptVerification,
} from '../research.ts';
import type {
  PilotAnswer,
  PilotChapter,
  PilotClaim,
  PilotEpisode,
  PilotGap,
  PilotParagraph,
} from '../pilot.ts';
import type { EditorUser, Role } from '../spiritual/governance.ts';
import {
  RESEARCH_CONTRACT_VERSION,
  type ClaimEvidence,
  type ClaimSupport,
  type ContentKind,
  type ContentLanguage,
  type ContractVersion,
  type CoverageKind,
  type CoverageNote,
  type EvidencePassage,
  type PassageRole,
  type QuestionDomain,
  type ResearchDossierView,
  type ResearchJobResponse,
  type ResearchJobView,
  type ResearchProgress,
  type ResearchStatus,
  type ResearchSubquestion,
  type ResearchTimings,
  type RightsMetadata,
  type SourceCredit,
  type SourceRecord,
} from '../contracts/v1.ts';

/**
 * Re-export the master agent's actual committed shared contract v1 (`src/shared/contracts/v1.ts`)
 * alongside the committed research/pilot/governance types.
 */
export {
  RESEARCH_CONTRACT_VERSION,
  referenceEvidence,
};

export type {
  ContractVersion,
  ContentLanguage,
  ContentKind,
  PassageRole,
  ResearchStatus,
  QuestionDomain,
  CoverageKind,
  ClaimSupport,
  RightsMetadata,
  SourceCredit,
  SourceRecord,
  EvidencePassage,
  ResearchSubquestion,
  CoverageNote,
  ResearchProgress,
  ResearchTimings,
  ResearchJobView,
  ClaimEvidence,
  ResearchDossierView,
  ResearchJobResponse,
  Evidence,
  PodcastLine,
  ResearchDossier,
  ResearchReference,
  ScriptVerification,
  PilotClaim,
  PilotChapter,
  PilotGap,
  PilotEpisode,
  PilotParagraph,
  PilotAnswer,
  EditorUser,
  Role,
};

/* ---------- Studio Audio & Statement Taxonomy ---------- */

export type AudioStreamKind =
  | 'quran_recitation'
  | 'meaning_audio'
  | 'original_recording'
  | 'presenter_narration';

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
  id: 'presenter' | 'researcher';
  name: string;
  roleTitle: string;
  voiceName: 'Kore' | 'Charon';
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
  status: 'active_release_slice' | 'in_preparation';
}

export interface StudioSegment {
  id: string;
  index: number;
  section: ScriptSectionKind;
  sectionLabel: string;
  speakerId: 'presenter' | 'researcher' | 'reciter' | 'original_speaker';
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
  directAudioUrl: string | null;
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

export interface StudioVerificationReport extends ScriptVerification {
  allCitationsResolve: boolean;
  quotationsMatchEdition: boolean;
  languagesIdentified: boolean;
  gradesPreserved: boolean;
  scientificLimitationsRepresented: boolean;
  narrationMatchesApprovedRevision: boolean;
  unresolvedCitationIds: string[];
}

export interface StudioEpisode {
  contractVersion: ContractVersion;
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
  /** Passages formatted as the committed v1.0.0 EvidencePassage contract */
  passages: EvidencePassage[];
  /** Committed ResearchReference records from src/shared/research.ts */
  references: ResearchReference[];
  /** Committed Evidence records produced via referenceEvidence() */
  evidence: Evidence[];
  gaps: PilotGap[];
  disagreements: string[];
  verification: StudioVerificationReport;
  reviews: StudioReviewEntry[];
  revisions: StudioRevisionSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export type StudioAnswerOutcome =
  | 'quotation'
  | 'synthesis'
  | 'limitation';

export interface StudioAskRequest {
  episodeId: string;
  segmentId: string;
  question: string;
  lang: Lang;
  targetLang?: Lang;
}

export interface StudioAskAnswer {
  contractVersion: ContractVersion;
  id: string;
  episodeId: string;
  segmentId: string;
  question: string;
  lang: Lang;
  visibility: 'private_session';
  review: 'unreviewed';
  originBadge: 'Dragon Dawwa generated material';
  kind: StudioAnswerOutcome;
  note: string;
  paragraphs: {
    text: string;
    citations: string[];
    role: 'quotation' | 'synthesis' | 'limitation';
    statementKind: StatementKind;
  }[];
  /** Passages in the committed v1.0.0 EvidencePassage format */
  passages: EvidencePassage[];
  /** Supporting ResearchReference items */
  references: ResearchReference[];
  /** Related ResearchReference items from the current programme offered when a question is unsupported */
  relatedReferences: ResearchReference[];
  /** Populated when the question was resolved via the shared v1.0.0 executeResearch engine */
  researchJob?: ResearchJobView | null;
  researchDossier?: ResearchDossierView | null;
  arabicTermExplanation?: {
    term: string;
    arabic: string;
    meaning: string;
    citationId: string;
    readerRoute?: string | null;
  } | null;
  voiceAvailable: boolean;
  voiceUserMessage: string | null;
  answeredAt: string;
}

/**
 * VoiceCapabilityReport strictly separates:
 * 1. `userMessage`: Simple, non-technical user-facing message for the Studio UI.
 * 2. `configuration`: Static configuration present in code/environment (never claims live verification).
 * 3. `recordedTestEvidence`: Historical notes recorded during past test runs (explicitly non-live).
 * 4. `liveCapability`: Runtime state from actual live checks (`unprobed` unless probed at runtime; never hard-coded `true`).
 * 5. `diagnostics`: Technical HTTP status codes and environment-variable names for operators.
 */
export interface VoiceCapabilityReport {
  userMessage: string;
  configuration: {
    provider: 'Google Gemini TTS';
    geminiApiKeyConfigured: boolean;
    configuredTtsModels: string[];
    configuredVoices: readonly string[];
    meaningAudioEditionKeys: Record<Lang, string>;
    streamingImplemented: false;
  };
  recordedTestEvidence: {
    recordedOn: string;
    note: string;
    observations: string[];
  };
  liveCapability: {
    checkedAt: string;
    probedUpstream: boolean;
    presenterNarration: 'available' | 'unavailable' | 'configured_unprobed';
    quranRecitationStream: 'external_cdn_configured' | 'available' | 'unavailable';
    meaningAudioManifests: Record<Lang, 'unprobed' | 'available' | 'unavailable'>;
  };
  diagnostics: {
    envVars: {
      GEMINI_API_KEY: 'present' | 'missing';
      GEMINI_TTS_MODELS: string;
      EDITORIAL_USERS: 'present' | 'missing';
    };
    endpoints: {
      '/api/health': { httpStatus: 200; ai: boolean };
      '/api/voice/narrate': { httpStatus: 200 | 503; detail: string };
    };
  };
  separationPolicy: Record<AudioStreamKind, string>;
}

export function internalReaderRouteForReference(ref: ResearchReference): string {
  if (ref.provider === 'QuranEnc' && ref.surah && ref.ayah) {
    return `#/quran/${ref.surah}?ayah=${ref.ayah}`;
  }
  if (ref.provider === 'HadeethEnc' && ref.hadithId) {
    return `#/hadith/${ref.hadithId}?lang=${ref.passageLanguage}`;
  }
  if (ref.provider === 'IslamHouse' && ref.itemId) {
    return `#/spiritual/library/prayer?lang=${ref.passageLanguage}&item=${ref.itemId}`;
  }
  return '#/hub';
}

export function referenceToEvidencePassage(ref: ResearchReference): EvidencePassage {
  const contentType: ContentKind =
    ref.provider === 'QuranEnc'
      ? 'quran'
      : ref.provider === 'HadeethEnc'
        ? 'hadith'
        : 'book';
  const role: PassageRole =
    ref.provider === 'QuranEnc' ? 'translation' : 'source_text';

  return {
    contractVersion: RESEARCH_CONTRACT_VERSION,
    id: ref.id,
    source: {
      contractVersion: RESEARCH_CONTRACT_VERSION,
      id: ref.itemId,
      provider: ref.provider,
      language: ref.passageLanguage,
      edition: ref.provider === 'QuranEnc' ? ref.itemId.split(' ')[0] ?? null : null,
      version: ref.version,
      title: ref.title,
      credits: [
        ...ref.authors.map(name => ({ role: 'author', name })),
        ...ref.translators.map(name => ({ role: 'translator', name })),
      ],
      canonicalUrl: ref.url,
      contentType,
      rights: {
        source: ref.provider,
        conditions: 'Preserve the published text, grade, and source. A Dragon Dawwa summary is separate work.',
        generatedWork: false,
        checkedOn: '2026-10-21',
      },
      retrievedAt: ref.retrievedOn,
      contentHash: null,
    },
    text: ref.passage,
    originalLanguage: ref.passageLanguage,
    arabic: ref.arabic,
    locator: ref.locator,
    context: ref.limitations.join(' ') || null,
    readerRoute: internalReaderRouteForReference(ref),
    role,
    publishedGrade: ref.grade,
  };
}

export function evidencePassageToReference(passage: EvidencePassage): ResearchReference {
  const provider: ResearchReference['provider'] =
    passage.source.provider === 'QuranEnc'
      ? 'QuranEnc'
      : passage.source.provider === 'HadeethEnc'
        ? 'HadeethEnc'
        : 'IslamHouse';
  const surahMatch = passage.source.id.match(/^(\d+):(\d+)$/);
  const surah = surahMatch ? Number(surahMatch[1]) : null;
  const ayah = surahMatch ? Number(surahMatch[2]) : null;
  const hadithId = provider === 'HadeethEnc' ? passage.source.id : null;

  return {
    id: passage.id,
    provider,
    itemId: passage.source.id,
    title: passage.source.title,
    authors: passage.source.credits.filter(c => c.role === 'author' && c.name).map(c => c.name!),
    translators: passage.source.credits.filter(c => c.role === 'translator' && c.name).map(c => c.name!),
    version: passage.source.version,
    passage: passage.text,
    passageLanguage: passage.originalLanguage,
    arabic: passage.arabic,
    locator: passage.locator,
    printedPage: null,
    pdfPage: null,
    surah,
    ayah,
    hadithId,
    collection: passage.locator,
    grade: passage.publishedGrade,
    url: passage.source.canonicalUrl,
    retrievedOn: passage.source.retrievedAt,
    claim: `Retrieved via shared research contract ${passage.contractVersion}.`,
    limitations: [
      ...(passage.context ? [passage.context] : []),
      ...(passage.publishedGrade ? [`Published grade: ${passage.publishedGrade}`] : []),
    ],
  };
}
