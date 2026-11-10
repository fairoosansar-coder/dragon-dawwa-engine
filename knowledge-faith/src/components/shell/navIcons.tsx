import knowledge from './icons/knowledge.svg?raw';
import quran from './icons/quran.svg?raw';
import hadith from './icons/hadith.svg?raw';
import books from './icons/books.svg?raw';
import worship from './icons/worship.svg?raw';
import podcast from './icons/podcast.svg?raw';
import saved from './icons/saved.svg?raw';
import question from './icons/prepare-question.svg?raw';

/** Supplied sidebar marks. Artwork stays in the SVG files; this only maps names. */
export type NavIconName = 'knowledge' | 'quran' | 'hadith' | 'books' | 'worship' | 'podcast' | 'saved' | 'question' | 'wall' | 'profile';

const wallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <rect class="dd-primary-stroke" x="5" y="6" width="22" height="20" rx="3.5" stroke="#F5F1E7"/>
  <path class="dd-primary-stroke" d="M10 12.5H22M10 17H18" stroke="#F5F1E7"/>
  <path class="dd-accent-fill" fill="#C9A660" d="M21.5 16L23.5 18L21.5 20L19.5 18Z"/>
</svg>`;

const profileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <circle class="dd-primary-stroke" cx="16" cy="11.5" r="4.5" stroke="#F5F1E7"/>
  <path class="dd-primary-stroke" d="M7.5 25.5C8.8 21.2 12 19 16 19C20 19 23.2 21.2 24.5 25.5" stroke="#F5F1E7"/>
  <circle class="dd-accent-fill" cx="22.5" cy="9" r="2" fill="#C9A660"/>
</svg>`;

const MARKS: Record<NavIconName, string> = {
  knowledge,
  quran,
  hadith,
  books,
  worship,
  podcast,
  saved,
  question,
  wall: wallSvg,
  profile: profileSvg,
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
