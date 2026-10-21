export interface ReaderParagraph {
  id: string;
  text: string;
}

export interface ReaderSection {
  heading: string;
  paragraphs: ReaderParagraph[];
}

/** Visible text of a reader fragment. Tags are dropped. Whitespace is collapsed. */
export function visibleText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, value: string) => {
      const code = Number(value);
      return Number.isInteger(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Paragraphs under the first h2 whose visible text contains `headingIncludes`. */
export function passageUnderHeading(html: string, headingIncludes: string): ReaderSection | null {
  const needle = headingIncludes.trim();
  if (!needle) return null;
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const found = headings.find(match => visibleText(match[1] ?? '').includes(needle));
  if (!found || found.index === undefined) return null;
  const start = found.index + found[0].length;
  const rest = html.slice(start);
  const next = rest.search(/<h2\b/i);
  const block = next === -1 ? rest : rest.slice(0, next);
  const paragraphs = [...block.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)]
    .map(match => ({
      id: /\bid="([^"]+)"/i.exec(match[1] ?? '')?.[1] ?? '',
      text: visibleText(match[2] ?? ''),
    }))
    .filter(paragraph => paragraph.text && paragraph.id);
  if (!paragraphs.length) return null;
  return { heading: visibleText(found[1] ?? ''), paragraphs };
}

/** First numbered paragraph at least `min` characters long. */
export function firstLongParagraph(html: string, min = 40): ReaderParagraph | null {
  for (const match of html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const id = /\bid="([^"]+)"/i.exec(match[1] ?? '')?.[1] ?? '';
    const text = visibleText(match[2] ?? '');
    if (id && text.length >= min) return { id, text };
  }
  return null;
}

export function paragraphLocator(heading: string, paragraph: ReaderParagraph): string {
  return paragraph.id ? `Heading “${heading}”, paragraph ${paragraph.id}` : `Heading “${heading}”`;
}
