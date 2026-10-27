/** The desk submits the reader’s words as typed, spoken, or read from a page. */

export function readerQuestion(question: string): string {
  return question.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
