/** One research job, one question. A glued second question is not part of the title. */

const QUESTION_WORD = /^(?:how|what|why|when|where|who|which|can|could|do|does|did|is|are|should)\b/i;

function tidy(text: string): string {
  const body = text.replace(/^[“”"'‘’\s]+|[“”"'‘’\s]+$/g, '').replace(/\s+/g, ' ').trim();
  if (body.length < 3) return '';
  return /[?؟.]$/.test(body) ? body : `${body}?`;
}

function canonical(text: string): string {
  return text
    .toLocaleLowerCase('en')
    .replace(/[?؟.!“”"'‘’]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split questions that were typed together.
 * A curly quote glued to a second question word is a join, not one title.
 */
export function separateQuestions(raw: string): string[] {
  const normalized = raw.replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  const chunks = normalized
    .split(/\n+/)
    .flatMap(chunk => chunk.split(/(?<=\S)[“”"«»„]\s*(?=(?:how|what|why|when|where|who|which)\b)/i))
    .flatMap(chunk => chunk.split(/(?<=[?؟])\s+(?=\S)/));
  const questions: string[] = [];
  for (const chunk of chunks) {
    const text = tidy(chunk);
    if (!text) continue;
    if (questions.some(item => canonical(item) === canonical(text))) continue;
    questions.push(text);
  }
  return questions;
}

/**
 * The question to research now.
 * A field that still begins with the loaded question does not submit both as one string.
 * Clarifying replaces the question; it does not glue the previous wording on.
 */
export function questionsToResearch(field: string, loadedQuestion: string | null, clarifying: boolean): string[] {
  if (clarifying) {
    const text = field.replace(/\s+/g, ' ').trim();
    return text.length >= 3 ? [text] : [];
  }
  let pieces = separateQuestions(field);
  const loaded = loadedQuestion?.trim() ?? '';
  if (loaded && pieces.length === 1 && canonical(pieces[0]) !== canonical(loaded) && canonical(pieces[0]).startsWith(canonical(loaded))) {
    const original = pieces[0].replace(/[?؟.]$/, '');
    const loadedRaw = loaded.replace(/[?؟.]$/, '').trim();
    if (original.toLocaleLowerCase('en').startsWith(loadedRaw.toLocaleLowerCase('en'))) {
      const rest = tidy(original.slice(loadedRaw.length));
      if (rest && QUESTION_WORD.test(rest.replace(/[?؟.]$/, ''))) pieces = separateQuestions(rest);
    }
  }
  if (!loaded) return pieces;
  const fresh = pieces.filter(piece => canonical(piece) !== canonical(loaded));
  return fresh.length ? fresh : pieces;
}
