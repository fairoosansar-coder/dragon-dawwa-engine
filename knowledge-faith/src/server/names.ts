import { matchByArabicName } from '../shared/arabicName.ts';
import type { NameDetail, NameListEntry, NamesCatalogue } from '../shared/nameRecords.ts';
import type { AsmaName } from '../shared/types.ts';
import { parseTermArticle, parseTermCatalogue, parseTermHeading, type TermLink } from '../shared/terminology.ts';
import { UpstreamError } from './http.ts';
import { getAsma } from './asma.ts';
import { contentHash, createContentIndex } from './research/contentIndex.ts';

const HOST = 'terminologyenc.com';
const CATEGORY = 'https://terminologyenc.com/en/browse/category/758';
const TTL_MS = 6 * 60 * 60_000;
const index = createContentIndex();

const RIGHTS = {
  source: 'terminologyenc.com',
  conditions:
    'The terminology home page describes a free reference of translated Islamic terms for portals and apps. Passages are read from the public page on demand. A Dragon Dawwa translation is not added where the page has no published text.',
  generatedWork: false,
  checkedOn: '2026-10-21',
} as const;

interface CacheEntry {
  html: string;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

function allowed(url: URL): boolean {
  if (url.protocol !== 'https:' || url.hostname !== HOST) return false;
  return url.pathname === '/en/browse/category/758' || /^\/en\/browse\/term\/\d{1,12}\/?$/.test(url.pathname);
}

async function fetchPage(url: string): Promise<string> {
  const parsed = new URL(url);
  if (!allowed(parsed)) throw new UpstreamError('That terminology address is not used.', 400);
  const hit = cache.get(parsed.toString());
  if (hit && hit.expires > Date.now()) return hit.html;
  let response: Response;
  try {
    response = await fetch(parsed, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: 'text/html', 'User-Agent': 'DragonDawwa/1.0' },
    });
  } catch {
    throw new UpstreamError('TerminologyEnc took too long to respond.', 504);
  }
  const finalUrl = new URL(response.url);
  if (!allowed(finalUrl)) throw new UpstreamError('TerminologyEnc did not stay on the requested English page.', 502);
  if (response.status === 404) throw new UpstreamError('TerminologyEnc has no page at that address.', 404);
  if (!response.ok) throw new UpstreamError(`TerminologyEnc returned ${response.status}.`, 502);
  const html = await response.text();
  if (html.length > 1_500_000) throw new UpstreamError('The terminology page was larger than this reader accepts.', 502);
  cache.set(parsed.toString(), { html, expires: Date.now() + TTL_MS });
  return html;
}

function listEntry(term: TermLink, names: AsmaName[]): NameListEntry {
  const match = matchByArabicName(term.arabic, names);
  return {
    id: term.id,
    arabic: term.arabic,
    transliteration: term.transliteration,
    titleMeaning: term.meaningInTitle ? term.parenthetical : null,
    aladhanNumber: match?.number ?? null,
    aladhanMeaning: match?.meaning ?? null,
  };
}

export async function listNames(): Promise<NamesCatalogue> {
  let names: AsmaName[] = [];
  let aladhan: NamesCatalogue['aladhan'];
  try {
    const collection = await getAsma();
    names = collection.names;
    aladhan = { status: 'ok', count: names.length, unmatched: [] };
  } catch (err) {
    aladhan = { status: 'unavailable', message: err instanceof Error ? err.message : 'Aladhan did not respond.' };
  }
  try {
    const html = await fetchPage(CATEGORY);
    const terms = parseTermCatalogue(html).map(term => listEntry(term, names));
    if (aladhan.status === 'ok') {
      const matched = new Set(terms.map(term => term.aladhanNumber).filter((number): number is number => number !== null));
      aladhan = { ...aladhan, unmatched: names.filter(name => !matched.has(name.number)) };
    }
    return {
      terminology: { status: 'ok', count: terms.length, url: CATEGORY, terms },
      aladhan,
      languages: {
        en: 'The English category page lists these terms.',
        ta: 'A Tamil term URL returned 404 on 2026-10-21. Tamil text is not filled in.',
        si: 'The Sinhala category page returned no term links on 2026-10-21.',
      },
      note: 'Records are matched by Arabic name. The terminology count is not forced into 99, and the Aladhan count is not forced onto terminology.',
      rights: RIGHTS,
    };
  } catch (err) {
    return {
      terminology: { status: 'unavailable', message: err instanceof Error ? err.message : 'TerminologyEnc did not respond.' },
      aladhan,
      languages: {
        en: 'The English category page could not be read.',
        ta: 'Tamil was not requested after the English catalogue failed.',
        si: 'Sinhala was not requested after the English catalogue failed.',
      },
      note: 'TerminologyEnc could not be read. That is a source failure, not a statement that the names are unknown. Aladhan is shown only when it responded.',
      rights: RIGHTS,
    };
  }
}

export async function readName(id: string): Promise<NameDetail> {
  if (!/^\d{1,12}$/.test(id)) throw new UpstreamError('Unknown name', 404);
  const url = `https://terminologyenc.com/en/browse/term/${id}`;
  const html = await fetchPage(url);
  const article = parseTermArticle(id, html);
  const link = parseTermHeading(html, id);
  if (!link) throw new UpstreamError('The terminology page did not include this name’s Arabic title.', 502);
  let aladhan: NameDetail['aladhan'] = null;
  try {
    const match = matchByArabicName(link.arabic, (await getAsma()).names);
    if (match) aladhan = { number: match.number, transliteration: match.transliteration, meaning: match.meaning };
  } catch {
    aladhan = null;
  }
  const fingerprint = [link.arabic, ...article.brief.map(field => field.text), article.commentary?.text ?? '', article.evidence?.text ?? ''].join('\n');
  const hash = contentHash(fingerprint);
  const key = `terminology:${id}:en`;
  const status = index.status(key, hash, hash);
  const stored = index.put(key, hash, hash, fingerprint, new Date().toISOString());
  return {
    id,
    arabic: link.arabic,
    transliteration: link.transliteration,
    titleMeaning: link.meaningInTitle ? link.parenthetical : null,
    aladhan,
    transliterationsDiffer: Boolean(aladhan && aladhan.transliteration.toLocaleLowerCase('en') !== link.transliteration.toLocaleLowerCase('en')),
    article,
    canonicalUrl: url,
    retrievedAt: new Date().toISOString(),
    contentHash: hash,
    index: status === 'stale' || stored.replacedStale ? 'updated' : status === 'fresh' ? 'fresh' : 'new',
    rights: RIGHTS,
    commentaryNote: article.commentary
      ? 'The detailed commentary on this page is the Arabic text published there. It is not a Dragon Dawwa translation, and it is not labeled as Tamil or Sinhala.'
      : 'This page did not include a detailed commentary section.',
  };
}

export async function readAladhanName(number: number): Promise<{ name: AsmaName; terminologyMatch: string | null; note: string }> {
  if (!Number.isInteger(number) || number < 1 || number > 99) throw new UpstreamError('Unknown name', 404);
  const names = (await getAsma()).names;
  const name = names.find(item => item.number === number);
  if (!name) throw new UpstreamError('Aladhan did not include that number.', 404);
  let terminologyMatch: string | null = null;
  try {
    const terms = parseTermCatalogue(await fetchPage(CATEGORY));
    terminologyMatch = matchByArabicName(name.arabic, terms.map(term => ({ ...term })))?.id ?? null;
  } catch {
    terminologyMatch = null;
  }
  return {
    name,
    terminologyMatch,
    note: terminologyMatch
      ? 'This Aladhan record matches a terminology page by Arabic name. Open that page for the published explanation.'
      : 'No terminology record matched this Arabic name. The English meaning is the Aladhan field only. It is not a published Tamil or Sinhala translation.',
  };
}
