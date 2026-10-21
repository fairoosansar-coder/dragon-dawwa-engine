/** Drop a delivery note if it was placed in front of the words that should be spoken. */
export function spokenTranscript(text: string, style = ''): string {
  let line = text.trim();
  const note = style.trim().replace(/[:.]+$/, '');
  if (!note) return line;
  const lead = line.replace(/[:.]+$/, '');
  if (lead === note) return '';
  if (line.toLowerCase().startsWith(note.toLowerCase())) {
    line = line.slice(note.length).replace(/^[\s:.\-–—]+/, '').trim();
  }
  return line;
}
