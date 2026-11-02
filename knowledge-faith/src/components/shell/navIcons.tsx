import knowledge from './icons/knowledge.svg?raw';
import quran from './icons/quran.svg?raw';
import hadith from './icons/hadith.svg?raw';
import books from './icons/books.svg?raw';
import worship from './icons/worship.svg?raw';
import podcast from './icons/podcast.svg?raw';
import saved from './icons/saved.svg?raw';
import question from './icons/prepare-question.svg?raw';

/** Supplied sidebar marks. Artwork stays in the SVG files; this only maps names. */
export type NavIconName = 'knowledge' | 'quran' | 'hadith' | 'books' | 'worship' | 'podcast' | 'saved' | 'question';

const MARKS: Record<NavIconName, string> = {
  knowledge,
  quran,
  hadith,
  books,
  worship,
  podcast,
  saved,
  question,
};

/** The visible label names the destination, so the icon is decorative. Drop titles so the dock and sidebar do not share ids. */
function decorative(svg: string): string {
  return svg
    .replace(/\s*<title\b[^>]*>[\s\S]*?<\/title>/, '')
    .replace(/\srole="img"/, '')
    .replace(/\saria-labelledby="[^"]*"/, '')
    .replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
}

export function NavGlyph({ name }: { name: NavIconName }) {
  return <span className="kf-nav-icon" data-nav-mark={name} dangerouslySetInnerHTML={{ __html: decorative(MARKS[name]) }} />;
}
