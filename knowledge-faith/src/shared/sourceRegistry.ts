import type { Lang } from './sources.ts';

/** Day these destinations were requested. A later edit must not reuse this date for new checks. */
export const SOURCE_CHECK_DATE = '2026-10-21';

export interface KnowledgePath {
  id: 'discover' | 'deepen' | 'prophet';
  title: string;
  /** IslamHouse’s own category title. The path title above is the shelf name. */
  sourceTitle: string;
  categoryId: number;
}

/**
 * Category pages requested on 2026-10-21.
 * The `/en/` segment is the site language. `showall` is the content-language slot.
 * Item language was taken from API `source_language`, not from the English page chrome.
 * Only page 1 (8 items) was opened for each language, plus English page 2 of category 768.
 */
export const KNOWLEDGE_PATHS: KnowledgePath[] = [
  { id: 'discover', title: 'Discover Islam', sourceTitle: 'Introducing Islam to non-Muslims', categoryId: 768 },
  { id: 'deepen', title: 'Deepen Your Understanding', sourceTitle: 'Introducing Islam to Muslims', categoryId: 769 },
  { id: 'prophet', title: 'Life of the Prophet', sourceTitle: 'The Prophetic Biography', categoryId: 795 },
];

export function knowledgePath(id: string): KnowledgePath | null {
  return KNOWLEDGE_PATHS.find(path => path.id === id) ?? null;
}

export interface ReadableItem {
  id: number;
  /** Language of the publication that was actually read. */
  lang: Lang;
  title: string;
  readerUrl: string;
  /** get-item with this site language returns the record. Site language `en` returned no data. */
  apiSiteLang: Lang;
  /** True when get-item `full_description` contains the same text as the reader. */
  fullTextInApi: boolean;
}

/** Tamil article. Locales on the item are ta and ar. Arabic is a catalogue description; the text is Tamil. */
export const PRAYER_ARTICLE: ReadableItem = {
  id: 475013,
  lang: 'ta',
  title: 'தொழுகையின் முக்கியத்துவம்',
  readerUrl: 'https://islamhouse.com/read/ta/தொழுகையின்-முக்கியத்துவம்-475013',
  apiSiteLang: 'ta',
  fullTextInApi: true,
};

/** Names read from the Tamil reader and the item API on 2026-10-21. */
export const SINCERITY_CREDITS = {
  preparation: 'மதாருல் வதன் அச்சகத்தின் கல்விப் பிரிவு',
  translator: 'மௌலவி: அப்துல் சத்தார் மதனி',
  reviewer: 'முஹம்மத் அமீன்',
} as const;

export const PRAYER_CREDITS = {
  author: 'முஹம்மத் இம்தியாஸ்',
  readerByline: 'M.S.M.இம்தியாஸ் யூசுப் ஸலபி',
  reviewer: 'முஹம்மத் அமீன்',
} as const;

/** Tamil book on sincerity. English and Sinhala get-item returned no data. The reader index for en and si did not list this id. */
export const SINCERITY_BOOK: ReadableItem & { heading: string } = {
  id: 735805,
  lang: 'ta',
  title: 'உளத்தூய்மை அதன் யதார்த்தம், மகிமை, பலாபலன்கள், அதை தேடும் வழிகள்',
  readerUrl: 'https://islamhouse.com/read/ta/உளத்தூய்மை-அதன்-யதார்த்தம்-மகிமை-பலாபலன்கள்-அதை-தேடும்-வழிகள்-735805',
  apiSiteLang: 'ta',
  fullTextInApi: false,
  heading: 'உளத்தூய்மை என்றால் என்ன?',
};

export const SINCERITY_QURAN_HEADING = 'உளத்தூய்மை குறித்த அல் குர்ஆன் வசனங்கள்';

/**
 * What was checked, and what was not.
 * Approved research hosts are IslamHouse, QuranEnc and HadeethEnc.
 * Other catalogue destinations stay here until an API and a content licence are both verified.
 */
export const SOURCE_FINDINGS = {
  catalogue: {
    url: 'https://s.islamhouse.com/api/v1/services',
    checked: '2026-10-21',
    note: 'Directory of 1307 services. It is not the text of those services. English entries use lang_code En. Tamil has five social and developer links, none of them terminology, names, Qur’an, hadith or Saadi.',
  },
  names: {
    englishLinks: 98,
    englishTermChecked: 'https://terminologyenc.com/en/browse/term/176418',
    tamilStatus: 404,
    sinhalaTermLinks: 0,
    api: 'No API link was found on the English terminology home page.',
    reuse: 'The English about page describes a free reference for portals and apps. The entries were not copied. This page keeps the Aladhan collection of 99 names.',
  },
  saadi: {
    english: 'https://saadi.islamenc.com/en/browse/tafsir/saadi/ resolved to /ar/en/... and returned 404.',
    tamil: 'The /ta/ path likewise resolved under /ar/ and returned 404.',
    sinhala: 'Catalogue entry 1303 links to the Arabic tafsir page, which returned 200 in Arabic.',
    api: 'No Saadi API was found.',
  },
  reuse: 'IslamHouse.com’s GitHub account describes the project as a free reference. The privacy policy at d1.islamhouse.com/html/policy.htm covers visitor data. Guessed licence URLs (/en/about, /en/copyright, /en/terms) returned 404. Passages are read on demand from the public item API or the official reader and are not stored in this repository. Attachment files on d1.islamhouse.com were not downloaded.',
} as const;
