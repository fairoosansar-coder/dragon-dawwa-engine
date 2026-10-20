export interface EpisodeLine {
  speaker: 'Host' | 'Guest';
  text: string;
}

export interface EpisodeChunk {
  speaker: 'Host' | 'Guest';
  text: string;
  /** Indexes into the original script lines, used to highlight what is playing. */
  lineIndexes: number[];
}

const MAX_LINES = 3;
const MAX_SENTENCES = 3;

/** Split on sentence endings without dropping the punctuation. */
export function splitSentences(text: string): string[] {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];
  return trimmed
    .split(/(?<=[.!?؟۔])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}

/**
 * First chunk is only the opening speaker's first few lines (at most three
 * sentences). Later chunks stay that small so the next speaker can load
 * while the current one is still playing.
 */
export function chunkEpisodeLines(lines: EpisodeLine[]): EpisodeChunk[] {
  const chunks: EpisodeChunk[] = [];
  let speaker: EpisodeLine['speaker'] | null = null;
  let texts: string[] = [];
  let indexes: number[] = [];
  let sentences = 0;

  const flush = () => {
    if (!texts.length || !speaker) return;
    chunks.push({ speaker, text: texts.join(' '), lineIndexes: indexes });
    speaker = null;
    texts = [];
    indexes = [];
    sentences = 0;
  };

  lines.forEach((line, index) => {
    const parts = splitSentences(line.text);
    if (!parts.length) return;
    if (parts.length > MAX_SENTENCES) {
      flush();
      for (let start = 0; start < parts.length; start += MAX_SENTENCES) {
        chunks.push({
          speaker: line.speaker,
          text: parts.slice(start, start + MAX_SENTENCES).join(' '),
          lineIndexes: [index],
        });
      }
      return;
    }
    const sameSpeaker = speaker === line.speaker;
    if (!sameSpeaker || indexes.length >= MAX_LINES || sentences + parts.length > MAX_SENTENCES) flush();
    speaker = line.speaker;
    texts.push(parts.join(' '));
    indexes.push(index);
    sentences += parts.length;
  });
  flush();
  return chunks;
}
