import type { Lang } from '../sources.ts';
import type { ResearchReference } from '../research.ts';
import { STUDIO_PRESENTERS } from './presenter.ts';
import type { StudioEpisode, StudioSegment } from './contracts.ts';
import { verifyStudioEpisode } from './verification.ts';

/**
 * Generated roundtable seats. Names are roles, never scholarly titles.
 * The earlier radio method is the conversation, not invented credentials.
 */
export const ROUNDTABLE_HOST = {
  id: 'presenter' as const,
  name: 'The Host',
  role: 'Generated host · not a scholar',
};
export const ROUNDTABLE_COMPANION = {
  id: 'researcher' as const,
  name: 'The Companion',
  role: 'Generated companion · not a scholar',
};

const SCHOLARLY_TITLE = /\b(ustadh|sheikh|shaykh|mufti|imam|dr\.?|doctor|professor)\b/i;

export type PlayPhase = 'idle' | 'preparing' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface RoundtableCopy {
  benefit: string;
  disclosure: string;
  welcome: (topic: string) => string;
  question: string;
  handover: string;
  afterRecitation: string;
  afterMeaning: string;
  afterTalk: string;
  example: string;
  closing: string;
  science: string;
  askPlaceholder: string;
  play: string;
  pause: string;
  retry: string;
  preparing: string;
  buffering: string;
  playing: string;
  paused: string;
  ended: string;
}

const COPY: Record<Lang, RoundtableCopy> = {
  en: {
    benefit: 'Hear the retrieved passage, then one everyday example marked as an example.',
    disclosure: 'Generated conversation. The host and companion are not scholars and hold no scholarly title.',
    welcome: topic => `Welcome. We are sitting with this question: ${topic}.`,
    question: 'What do the words that were retrieved actually say?',
    handover: 'I will let the source speak before we add anything of our own.',
    afterRecitation: 'That was the original recitation. Our voices did not replace it.',
    afterMeaning: 'That was the published meaning audio for this edition. It is not our paraphrase.',
    afterTalk: 'That was the original talk. It is not a generated voice.',
    example:
      'Here is an example, not the source. Someone who hears this might choose a gentler reply in an ordinary conversation. The passage does not describe that scene.',
    closing: 'Take the wording you heard back into the rest of the day. This conversation is a study aid, not a ruling.',
    science: 'No scientific study was retrieved for this question. These religious passages are not a scientific result.',
    askPlaceholder: 'Ask about the passage that is playing',
    play: 'Play',
    pause: 'Pause',
    retry: 'Retry',
    preparing: 'Preparing',
    buffering: 'Buffering',
    playing: 'Playing',
    paused: 'Paused',
    ended: 'Ended',
  },
  ta: {
    benefit: 'பெறப்பட்ட வாசகத்தைக் கேளுங்கள்; பின்னர் எடுத்துக்காட்டு என்று குறிக்கப்பட்ட ஒரு அன்றாட உதாரணம்.',
    disclosure: 'உருவாக்கப்பட்ட உரையாடல். தொகுப்பாளரும் துணையும் அறிஞர் அல்ல; அவர்களுக்கு அறிஞர் பட்டம் இல்லை.',
    welcome: topic => `வரவேற்கிறோம். இந்தக் கேள்வியுடன் அமர்கிறோம்: ${topic}.`,
    question: 'பெறப்பட்ட சொற்கள் உண்மையில் என்ன சொல்கின்றன?',
    handover: 'நாம் சேர்ப்பதற்கு முன் மூலமே பேசட்டும்.',
    afterRecitation: 'அது அசல் ஓதுதல். நம் குரல்கள் அதை மாற்றவில்லை.',
    afterMeaning: 'அது இந்தப் பதிப்பின் வெளியிடப்பட்ட பொருள் ஒலி. அது நம் சுருக்கம் அல்ல.',
    afterTalk: 'அது அசல் உரை. அது உருவாக்கப்பட்ட குரல் அல்ல.',
    example:
      'இது ஒரு எடுத்துக்காட்டு, மூலம் அல்ல. இதைக் கேட்பவர் சாதாரண உரையாடலில் மென்மையான பதிலைத் தேர்ந்தெடுக்கலாம். அந்தக் காட்சியை வாசகம் சொல்லவில்லை.',
    closing: 'கேட்ட சொற்களை இன்றைய நாளில் கொண்டு செல்லுங்கள். இந்த உரையாடல் ஒரு படிப்பு உதவி, தீர்ப்பு அல்ல.',
    science: 'இந்தக் கேள்விக்கு அறிவியல் ஆய்வு எதுவும் பெறப்படவில்லை. இந்தச் சமய வாசகங்கள் அறிவியல் முடிவு அல்ல.',
    askPlaceholder: 'ஒலிக்கும் வாசகத்தைப் பற்றி கேளுங்கள்',
    play: 'Play',
    pause: 'Pause',
    retry: 'Retry',
    preparing: 'Preparing',
    buffering: 'Buffering',
    playing: 'Playing',
    paused: 'Paused',
    ended: 'Ended',
  },
  si: {
    benefit: 'ලබාගත් ඡේදය අසන්න; පසුව උදාහරණයක් ලෙස සලකුණු කළ එදිනෙදා උදාහරණයක්.',
    disclosure: 'ජනනය කළ සංවාදයකි. සත්කාරකයා සහ සහකරු විද්වතුන් නොවේ. ඔවුන්ට විද්වත් තනතුරක් නැත.',
    welcome: topic => `සාදරයෙන් පිළිගනිමු. අපි මේ ප්‍රශ්නය සමඟ වාඩි වෙමු: ${topic}.`,
    question: 'ලබාගත් වචන ඇත්තටම කියන්නේ කුමක්ද?',
    handover: 'අපි යමක් එකතු කිරීමට පෙර මූලාශ්‍රයට කතා කිරීමට ඉඩ දෙමු.',
    afterRecitation: 'ඒ මුල් කියවීමයි. අපේ හඬ එය ප්‍රතිස්ථාපනය කළේ නැත.',
    afterMeaning: 'ඒ මේ සංස්කරණයේ ප්‍රකාශිත අර්ථ ශබ්දයයි. ඒ අපේ පරිවර්තනය නොවේ.',
    afterTalk: 'ඒ මුල් කතාවයි. ඒ ජනනය කළ හඬක් නොවේ.',
    example:
      'මෙය උදාහරණයකි, මූලාශ්‍රය නොවේ. මෙය අසන කෙනෙකුට සාමාන්‍ය කතාබහකදී මෘදු පිළිතුරක් තෝරාගත හැක. ඡේදය එම දර්ශනය විස්තර නොකරයි.',
    closing: 'ඔබ අසා ඇති වචන දවසේ ඉතිරියට ගෙන යන්න. මේ සංවාදය අධ්‍යයන ආධාරයකි, තීන්දුවක් නොවේ.',
    science: 'මේ ප්‍රශ්නය සඳහා විද්‍යාත්මක අධ්‍යයනයක් ලැබුණේ නැත. මේ ආගමික ඡේද විද්‍යාත්මක ප්‍රතිඵලයක් නොවේ.',
    askPlaceholder: 'වාදනය වන ඡේදය ගැන අසන්න',
    play: 'Play',
    pause: 'Pause',
    retry: 'Retry',
    preparing: 'Preparing',
    buffering: 'Buffering',
    playing: 'Playing',
    paused: 'Paused',
    ended: 'Ended',
  },
};

function spokenTopic(topic: string): string {
  const clean = topic.trim().replace(/[.?!]+$/u, '');
  return clean || topic.trim();
}

export function roundtableCopy(lang: Lang): RoundtableCopy {
  const copy = COPY[lang];
  return {
    ...copy,
    welcome: topic => copy.welcome(spokenTopic(topic)),
  };
}

export function asksForScience(topic: string): boolean {
  return /\b(science|scientific|study|studies|medicine|medical|clinical|physics|biology|chemistry)\b/i.test(topic);
}

export function hasScholarlyTitle(name: string): boolean {
  return SCHOLARLY_TITLE.test(name);
}

/** The one control: play, pause, or retry. It never invents a second resume button. */
export function playbackAction(phase: PlayPhase): 'play' | 'pause' | 'retry' {
  if (phase === 'error') return 'retry';
  if (phase === 'playing' || phase === 'preparing' || phase === 'buffering') return 'pause';
  return 'play';
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${remain.toString().padStart(2, '0')}`;
}

const DIRECT_AUDIO = new Set(['quran_recitation', 'meaning_audio', 'original_recording']);

function generated(
  lang: Lang,
  speaker: typeof ROUNDTABLE_HOST | typeof ROUNDTABLE_COMPANION,
  section: StudioSegment['section'],
  sectionLabel: string,
  text: string,
  citation: string,
  extra: Partial<StudioSegment> = {},
): Omit<StudioSegment, 'id' | 'index' | 'durationSeconds'> {
  return {
    section,
    sectionLabel,
    speakerId: speaker.id,
    speakerName: speaker.name,
    speakerRoleLabel: speaker.role,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text,
    arabicText: null,
    citations: [citation],
    translationEdition: null,
    sourceLanguage: lang,
    directAudioUrl: null,
    ...extra,
  };
}

function withTiming(partial: Omit<StudioSegment, 'id' | 'index' | 'durationSeconds'>, index: number, duration?: number): StudioSegment {
  const words = partial.text.split(/\s+/).filter(Boolean).length;
  return {
    ...partial,
    id: `rt-${index + 1}`,
    index,
    durationSeconds: duration ?? Math.max(6, Math.min(45, Math.round(words / 2.4))),
  };
}

function clipKind(segment: StudioSegment): 'recitation' | 'meaning' | 'talk' | null {
  if (!segment.directAudioUrl || !DIRECT_AUDIO.has(segment.audioKind)) return null;
  if (segment.audioKind === 'quran_recitation') return 'recitation';
  if (segment.audioKind === 'meaning_audio') return 'meaning';
  return 'talk';
}

/**
 * Turns a sourced episode into a short roundtable.
 * Direct recitation, meaning audio and original talks stay their own audio.
 * Generated lines stay reflections. Exact retrieved wording is copied, not paraphrased into proof.
 */
export function toRoundtableEpisode(source: StudioEpisode): StudioEpisode {
  const lang = source.lang;
  const copy = roundtableCopy(lang);
  const topic = source.title || source.brief?.topic;
  const firstRef = source.references[0];
  const citation = firstRef?.id ?? source.segments.find(segment => segment.citations[0])?.citations[0] ?? 'source';
  const pieces: Omit<StudioSegment, 'id' | 'index' | 'durationSeconds'>[] = [
    generated(lang, ROUNDTABLE_HOST, 'opening', 'Opening', copy.welcome(topic), citation),
    generated(lang, ROUNDTABLE_HOST, 'orientation', 'Question', copy.question, citation),
    generated(lang, ROUNDTABLE_COMPANION, 'orientation', 'Handover', copy.handover, citation),
  ];

  const clips = source.segments.filter(segment => clipKind(segment));
  const primaryCite = clips[0]?.citations[0];
  const primaryClips = primaryCite ? clips.filter(segment => segment.citations.includes(primaryCite)) : [];
  const usedText = new Set<string>();
  for (const clip of primaryClips) {
    const kindLabel = clip.audioKind === 'quran_recitation' ? 'Original recitation' : clip.audioKind === 'meaning_audio' ? 'Published meaning' : 'Original talk';
    pieces.push({
      ...clip,
      sectionLabel: kindLabel,
      speakerName: clip.audioKind === 'meaning_audio' ? 'Published meaning audio' : clip.audioKind === 'original_recording' ? 'Original talk' : clip.speakerName,
      translationEdition: clip.audioKind === 'meaning_audio' ? 'Published meaning audio' : clip.translationEdition,
    });
    usedText.add(clip.text);
    const kind = clipKind(clip);
    const note = kind === 'recitation' ? copy.afterRecitation : kind === 'meaning' ? copy.afterMeaning : copy.afterTalk;
    pieces.push(generated(lang, ROUNDTABLE_COMPANION, 'exploration', 'After the source', note, clip.citations[0] ?? citation));
  }

  const spokenPassage = source.references.find(ref => ref.passage && !usedText.has(ref.passage));
  if (spokenPassage) {
    pieces.push({
      section: 'evidence',
      sectionLabel: 'Retrieved passage',
      speakerId: ROUNDTABLE_COMPANION.id,
      speakerName: ROUNDTABLE_COMPANION.name,
      speakerRoleLabel: ROUNDTABLE_COMPANION.role,
      isGeneratedSpeaker: true,
      statementKind: 'exact_quotation',
      originBadge: spokenPassage.provider === 'QuranEnc' ? 'Quranic Arabic text' : spokenPassage.provider === 'HadeethEnc' ? 'Prophetic narration (Hadith)' : 'Published translation',
      audioKind: 'presenter_narration',
      text: spokenPassage.passage,
      arabicText: spokenPassage.arabic,
      citations: [spokenPassage.id],
      translationEdition: spokenPassage.locator,
      sourceLanguage: lang,
      directAudioUrl: null,
    });
  } else if (!primaryClips.length && firstRef) {
    pieces.push({
      section: 'evidence',
      sectionLabel: 'Retrieved passage',
      speakerId: ROUNDTABLE_COMPANION.id,
      speakerName: ROUNDTABLE_COMPANION.name,
      speakerRoleLabel: ROUNDTABLE_COMPANION.role,
      isGeneratedSpeaker: true,
      statementKind: 'exact_quotation',
      originBadge: 'Published translation',
      audioKind: 'presenter_narration',
      text: firstRef.passage,
      arabicText: firstRef.arabic,
      citations: [firstRef.id],
      translationEdition: firstRef.locator,
      sourceLanguage: lang,
      directAudioUrl: null,
    });
  }

  pieces.push(
    generated(lang, ROUNDTABLE_HOST, 'application', 'Example', copy.example, citation, { hypotheticalExample: true }),
  );
  if (asksForScience(topic)) {
    pieces.push(
      generated(lang, ROUNDTABLE_COMPANION, 'exploration', 'Scientific limit', copy.science, citation, {
        scientificLimitation: copy.science,
      }),
    );
  }
  pieces.push(generated(lang, ROUNDTABLE_COMPANION, 'closing', 'Closing', copy.closing, citation));

  const segments = pieces.map((piece, index) => withTiming(piece, index, (piece as StudioSegment).durationSeconds));
  const verification = verifyStudioEpisode(segments, source.references, {
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
  });
  return {
    ...source,
    id: source.id.startsWith('roundtable-') ? source.id : `roundtable-${source.id}`,
    format: 'explanatory_dialogue',
    summary: copy.benefit,
    editorialState: 'needs-review',
    published: false,
    approvalValid: false,
    narrationValid: false,
    approvedRevision: null,
    narratedRevision: null,
    presenters: [STUDIO_PRESENTERS.presenter, STUDIO_PRESENTERS.researcher],
    segments,
    verification,
  };
}

export function passagesForRoundtable(references: ResearchReference[]): ResearchReference[] {
  return references.filter(ref => ref.passage.trim().length > 0).slice(0, 2);
}

export function roundtableSegmentsFromPassages(topic: string, lang: Lang, references: ResearchReference[]): StudioSegment[] {
  const shell: StudioEpisode = {
    id: 'draft',
    slug: 'draft',
    familyId: 'research-room',
    title: topic,
    subtitle: '',
    summary: '',
    lang,
    availableLanguages: [lang],
    format: 'explanatory_dialogue',
    broadcastLabel: 'On demand',
    editorialState: 'draft',
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
    approvalValid: false,
    narrationValid: false,
    published: false,
    presenters: [],
    brief: {
      topic,
      audience: 'general',
      lang,
      durationMinutes: 4,
      familyId: 'research-room',
      learningObjective: topic,
      tone: 'warm_reflective',
      format: 'explanatory_dialogue',
    },
    outline: [],
    segments: [],
    references,
    evidence: [],
    gaps: [],
    disagreements: [],
    verification: {
      supported: false,
      missingCitations: [],
      unfaithful: [],
      unverified: [],
      review: 'editorial',
      allCitationsResolve: true,
      quotationsMatchEdition: true,
      languagesIdentified: true,
      gradesPreserved: true,
      scientificLimitationsRepresented: true,
      narrationMatchesApprovedRevision: false,
      unresolvedCitationIds: [],
      note: 'Generated roundtable lines stay unverified until a human editor reviews them.',
    },
    reviews: [],
    revisions: [],
    createdAt: '',
    updatedAt: '',
  };
  return toRoundtableEpisode(shell).segments;
}

export function activeSeat(segment: StudioSegment | null): 'host' | 'companion' | 'recitation' | 'meaning' | 'talk' {
  if (!segment) return 'host';
  if (segment.audioKind === 'quran_recitation') return 'recitation';
  if (segment.audioKind === 'meaning_audio') return 'meaning';
  if (segment.audioKind === 'original_recording') return 'talk';
  return segment.speakerId === 'researcher' ? 'companion' : 'host';
}
