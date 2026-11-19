/**
 * Canonical 7-agent Gemini prebuilt voice map.
 * Used by roundtable / dossier TTS and Research Podcasts so every speaker
 * resolves to a distinct neural voice (never one shared default for all).
 */

export const GEMINI_PREBUILT_VOICES = [
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Zephyr',
  'Aoede',
  'Orus',
] as const;

export type GeminiPrebuiltVoiceName = (typeof GEMINI_PREBUILT_VOICES)[number];

/** Distinct voice per primary roundtable speaker. Yusuf must not share Fenrir with Tariq. */
export const SEVEN_AGENT_GEMINI_VOICES = {
  host: 'Puck',
  feroz: 'Puck',
  layla: 'Kore',
  tariq: 'Fenrir',
  imran: 'Orus',
  zainab: 'Zephyr',
  /** Charon — distinct from Tariq (Fenrir). Amina keeps Aoede. */
  yusuf: 'Charon',
  amina: 'Aoede',
  farhan: 'Charon',
} as const satisfies Record<string, GeminiPrebuiltVoiceName>;

export function isGeminiPrebuiltVoiceName(value: unknown): value is GeminiPrebuiltVoiceName {
  return typeof value === 'string' && (GEMINI_PREBUILT_VOICES as readonly string[]).includes(value);
}

/**
 * Map any speaker label / persona string to a Gemini prebuilt voice.
 * Unknown speakers fall back to Host (Puck), never a single shared Kore default
 * that would collapse all agents into one voice.
 */
export function geminiVoiceNameForSpeaker(speaker: string): GeminiPrebuiltVoiceName {
  if (!speaker || typeof speaker !== 'string') return SEVEN_AGENT_GEMINI_VOICES.host;

  const s = speaker.toLowerCase().trim();

  if (
    s.includes('layla') ||
    s.includes('qasimi') ||
    s.includes('agent 2') ||
    s.includes('isnad agent') ||
    s.includes('transmission specialist') ||
    s.includes('passage reader') ||
    /qur['’]?an specialist/.test(s)
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.layla;
  }

  if (
    s.includes('zainab') ||
    s.includes('mubarak') ||
    s.includes('agent 4') ||
    s.includes('shawahid') ||
    s.includes('defect') ||
    s.includes('matn agent') ||
    s.includes('distinction') ||
    s.includes('hadith & fiqh')
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.zainab;
  }

  if (
    s.includes('imran') ||
    s.includes('hasani') ||
    s.includes('agent 3') ||
    s.includes('rijal') ||
    s.includes('jarh')
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.imran;
  }

  if (
    s.includes('tariq') ||
    s.includes('mansoor') ||
    s.includes('agent 1') ||
    s.includes('takhrij') ||
    s.includes('source detective')
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.tariq;
  }

  if (
    s.includes('yusuf') ||
    s.includes('azhari') ||
    s.includes('agent 5') ||
    (s.includes('verdict') && !s.includes('executive')) ||
    s.includes('jurist')
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.yusuf;
  }

  if (
    s.includes('amina') ||
    s.includes('kindi') ||
    s.includes('agent 7') ||
    s.includes('source research') ||
    s.includes('hadeethenc') ||
    s.includes('deep research')
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.amina;
  }

  if (
    s.includes('farhan') ||
    s.includes('rashed') ||
    s.includes('fatwa') ||
    s.includes('field research') ||
    s.includes('research lead')
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.farhan;
  }

  if (
    s.includes('host') ||
    s.includes('feroz') ||
    s.includes('anchor') ||
    s.includes('moderator') ||
    s.includes('brother') ||
    s.includes('agent 6') ||
    s.includes('seeker guide')
  ) {
    return SEVEN_AGENT_GEMINI_VOICES.host;
  }

  return SEVEN_AGENT_GEMINI_VOICES.host;
}

/** Expected distinct cast for regression tests. */
export function expectedSevenAgentVoiceCast(): ReadonlyArray<{
  speaker: string;
  voice: GeminiPrebuiltVoiceName;
}> {
  return [
    { speaker: 'Brother Feroz (Host)', voice: 'Puck' },
    { speaker: 'Dr. Layla al-Qasimi', voice: 'Kore' },
    { speaker: 'Dr. Tariq al-Mansoor', voice: 'Fenrir' },
    { speaker: 'Sheikh Imran al-Hasani', voice: 'Orus' },
    { speaker: 'Dr. Zainab al-Mubarak', voice: 'Zephyr' },
    { speaker: 'Sheikh Yusuf al-Azhari', voice: 'Charon' },
    { speaker: 'Dr. Amina al-Kindi', voice: 'Aoede' },
  ];
}
