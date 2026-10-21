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

/**
 * Re-export the actual committed shared contracts from `src/shared/research.ts`,
 * `src/shared/types.ts`, `src/shared/pilot.ts`, and `src/shared/spiritual/governance.ts`.
 * Do not recreate uncommitted contract schemas from transcript descriptions.
 */
export type {
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

export { referenceEvidence };

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

/**
 * Wraps the committed `ScriptVerification` from `src/shared/research.ts` (`verifyScript`)
 * with Studio metadata checks (edition language tags, grade preservation, narration revision match).
 * Word/token overlap is NEVER used as proof of claim support: any paraphrase that is not
 * established verbatim by the cited passage stays in `unverified` (`supported: false`).
 */
export interface StudioVerificationReport extends ScriptVerification {
  allCitationsResolve: boolean;
  quotationsMatchEdition: boolean;
  languagesIdentified: boolean;
  gradesPreserved: boolean;
  scientificLimitationsRepresented: boolean;
  narrationMatchesApprovedRevision: boolean;
  unresolvedCitationIds: string[];
}

/**
 * StudioEpisode consumes the committed `ResearchReference[]` and `Evidence[]` shapes directly.
 */
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
  /** Committed ResearchReference records from src/shared/research.ts */
  references: ResearchReference[];
  /** Committed Evidence records produced via referenceEvidence() from src/shared/research.ts */
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
  /** Supporting ResearchReference items from the committed contract */
  references: ResearchReference[];
  /** Related ResearchReference items from the current programme offered when a question is unsupported */
  relatedReferences: ResearchReference[];
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

/**
 * Factual Voice & Audio Capability Report based strictly on runtime checks in this environment.
 */
export interface VoiceCapabilityReport {
  checkedOn: string;
  provider: 'Google Gemini TTS (/api/voice/narrate)';
  configured: boolean;
  narrateHttpStatus: 200 | 503;
  blocker: string | null;
  envModelsConfigured: string[];
  envVoicesConfigured: readonly string[];
  languages: Record<Lang, {
    scriptAndSourcesVerified: boolean;
    quranMeaningAudioEdition: string;
    geminiTtsVerifiedInThisEnv: boolean;
    note: string;
  }>;
  streaming: {
    supported: false;
    mode: string;
  };
  interruptions: string;
  audioFormats: string[];
  separationPolicy: Record<AudioStreamKind, string>;
}

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
