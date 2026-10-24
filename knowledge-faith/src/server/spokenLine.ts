import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';

/** Speech instruction for the voice model. It is not part of the spoken transcript. */
export function narrationDirection(style: string, lang: Lang): string {
  const speak = lang === 'en' ? '' : `Speak in ${LANGUAGE_NAMES[lang].english}.`;
  return [style.trim(), speak].filter(Boolean).join(' ').slice(0, 240);
}

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
