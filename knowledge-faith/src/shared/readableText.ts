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

export interface ParagraphContext {
  heading: string;
  paragraph: ReaderParagraph;
  before: ReaderParagraph | null;
  after: ReaderParagraph | null;
}

/** All readable paragraphs, including ones the reader did not number. */
export function htmlParagraphs(html: string): ReaderParagraph[] {
  return [...html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)]
    .map((match, index) => ({
      id: /\bid="([^"]+)"/i.exec(match[1] ?? '')?.[1] || String(index + 1),
      text: visibleText(match[2] ?? ''),
    }))
    .filter(paragraph => paragraph.text);
}

/** The first paragraph whose own text matches, plus the paragraphs on either side. */
export function paragraphContext(html: string, matches: (text: string) => boolean): ParagraphContext | null {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const sections: { heading: string; html: string }[] = [];
  const firstHeading = headings[0]?.index ?? html.length;
  if (!headings.length || firstHeading > 0) sections.push({ heading: '', html: html.slice(0, firstHeading) });
  headings.forEach((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = index + 1 < headings.length ? (headings[index + 1].index ?? html.length) : html.length;
    sections.push({ heading: visibleText(heading[1] ?? ''), html: html.slice(start, end) });
  });
  for (const section of sections) {
    const paragraphs = htmlParagraphs(section.html);
    const index = paragraphs.findIndex(paragraph => matches(paragraph.text));
    if (index < 0) continue;
    return {
      heading: section.heading,
      paragraph: paragraphs[index],
      before: index > 0 ? paragraphs[index - 1] : null,
      after: index + 1 < paragraphs.length ? paragraphs[index + 1] : null,
    };
  }
  return null;
}
