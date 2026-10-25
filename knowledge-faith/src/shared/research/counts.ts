/**
 * Separate a mention-count into word occurrences and named campaigns.
 * The totals are the sizes of these lists. Nothing here stores an answer.
 */

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g;
const ARABIC_CHAR = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF';

/** Words that name the idea of war, not a particular campaign. */
const GENERIC = new Set([
  'battle', 'battles', 'war', 'wars', 'campaign', 'campaigns', 'fighting', 'fight', 'fights',
  'forces', 'force', 'army', 'armies', 'the', 'and', 'day', 'for', 'from', 'with', 'when',
  'came', 'come', 'against', 'that', 'this', 'those', 'these', 'were', 'was', 'been', 'you',
  'your', 'they', 'them', 'their', 'his', 'her', 'our', 'not', 'but', 'had', 'has', 'have',
  'who', 'which', 'where', 'after', 'before', 'during', 'sent', 'are', 'allah', 'victory',
  'helped', 'given', 'many', 'into', 'over', 'upon', 'unto', 'than', 'then', 'also', 'all',
  'one', 'two', 'its', 'she', 'him', 'out', 'off', 'between', 'among', 'already', 'believers',
]);

export const OCCURRENCE_CAP = 250;

export interface WordingOccurrence {
  surah: number;
  ayah: number;
  wording: string;
  script: 'english' | 'arabic';
  text: string;
}

export interface CampaignGroup {
  label: string;
  verses: { surah: number; ayah: number }[];
}

function strip(text: string): string {
  return text.normalize('NFC').replace(ARABIC_DIACRITICS, '');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A wording counts only as a whole word. “war” does not count inside “warning”, and “battle” does not count inside “battles”. */
export function wordingInText(wording: string, text: string): boolean {
  const word = strip(wording).trim();
  const hay = strip(text);
  if (word.length < 2 || !hay) return false;
  if (/[\u0600-\u06FF]/.test(word)) {
    const body = escapeRegExp(word);
    // A preceding و ف ب ك ل or the written article (ال or لل) still counts as this wording.
    const re = new RegExp(
      `(?:^|[^${ARABIC_CHAR}])[\\u0648\\u0641\\u0628\\u0643\\u0644\\u0627]{0,4}${body}(?![${ARABIC_CHAR}])`,
      'u',
    );
    return re.test(hay);
  }
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(word)) return false;
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(hay);
}

/** Used only when a wording list was not returned. The subject’s own word, plus a simple plural or singular. */
export function fallbackWordings(subject: string): { english: string[]; arabic: string[] } {
  const english: string[] = [];
  const arabic: string[] = [];
  const pushEn = (token: string) => {
    const text = token.toLocaleLowerCase('en');
    if (text.length < 3 || text.length > 24 || !/^[a-z][a-z'-]*$/.test(text)) return;
    if (english.includes(text) || english.length >= 6) return;
    english.push(text);
  };
  const pushAr = (token: string) => {
    const text = strip(token);
    if (!/^[\u0600-\u06FF]{2,24}$/.test(text) || arabic.includes(text) || arabic.length >= 4) return;
    arabic.push(text);
  };
  for (const token of subject.split(/\s+/)) {
    if (!token) continue;
    if (/[\u0600-\u06FF]/.test(token)) {
      pushAr(token);
      continue;
    }
    pushEn(token);
    if (token.toLocaleLowerCase('en').endsWith('s') && !token.toLocaleLowerCase('en').endsWith('ss') && token.length > 3) {
      pushEn(token.slice(0, -1));
    } else if (!token.toLocaleLowerCase('en').endsWith('s')) {
      pushEn(`${token}s`);
    }
  }
  return { english, arabic };
}

/** Drop الحرب when حرب is already counted. The article is not a second wording. */
export function distinctWordings(english: readonly string[], arabic: readonly string[]): { english: string[]; arabic: string[] } {
  const cleaned = sanitizeWordings(english, arabic);
  const stems = cleaned.arabic.filter(word => {
    const stem = word.replace(/^(?:[\u0648\u0641])?(?:[\u0628\u0643\u0644])?(?:\u0627\u0644|\u0644)?/u, '');
    return stem === word || !cleaned.arabic.includes(stem);
  });
  return { english: cleaned.english, arabic: stems };
}

/** One word each. No verse numbers, no counts, no phrases. */
export function sanitizeWordings(english: readonly string[], arabic: readonly string[]): { english: string[]; arabic: string[] } {
  const en: string[] = [];
  const ar: string[] = [];
  for (const raw of english) {
    const text = strip(String(raw)).trim().toLocaleLowerCase('en');
    if (!/^[a-z][a-z'-]{2,23}$/.test(text) || /quran|mention/.test(text) || en.includes(text)) continue;
    en.push(text);
    if (en.length >= 8) break;
  }
  for (const raw of arabic) {
    const text = strip(String(raw)).trim();
    if (/\s|\d/.test(text) || !/^[\u0600-\u06FF]{2,24}$/.test(text) || ar.includes(text)) continue;
    ar.push(text);
    if (ar.length >= 6) break;
  }
  return { english: en, arabic: ar };
}

/**
 * A campaign name must be copied from the passage.
 * Generic war words and the counted wordings are not a campaign.
 */
/** "3:123|Badr" or "33:9|unnamed". The passage check still has to accept the name. */
export function campaignEventsFromLines(lines: readonly string[]): { id: string; campaign: string }[] {
  const events: { id: string; campaign: string }[] = [];
  for (const raw of lines) {
    const text = String(raw).replace(/\s+/g, ' ').trim();
    const match = text.match(/^(\d+:\d+)\s*[|:—–-]\s*(.+)$/);
    if (!match) continue;
    const campaign = match[2].trim();
    if (!campaign || campaign.length > 80) continue;
    events.push({ id: match[1], campaign });
    if (events.length >= 12) break;
  }
  return events;
}

export function acceptedCampaign(
  campaign: string,
  text: string,
  wordings: readonly string[],
): { key: string; label: string } | null {
  const name = campaign.replace(/\s+/g, ' ').trim();
  if (!name || name.length > 80 || /^unnamed$/i.test(name)) return null;
  const blocked = new Set(wordings.map(item => strip(item).toLocaleLowerCase('en')));
  const tokens = strip(name)
    .toLocaleLowerCase('en')
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(token => token.length >= 3 && !GENERIC.has(token) && !blocked.has(token));
  if (!tokens.length) return null;
  const visible = strip(text).replace(/\[[^\]]*\]/g, ' ');
  const visibleLower = visible.toLocaleLowerCase('en');
  if (!tokens.every(token => visibleLower.includes(token))) return null;
  const surfaces: string[] = [];
  for (const token of tokens) {
    const match = visible.match(new RegExp(escapeRegExp(token), 'i'));
    if (!match) return null;
    surfaces.push(match[0]);
  }
  return { key: [...tokens].sort().join(' '), label: surfaces.join(' ') };
}

export function dedupeOccurrences(items: readonly WordingOccurrence[]): WordingOccurrence[] {
  const seen = new Set<string>();
  const kept: WordingOccurrence[] = [];
  for (const item of items) {
    const wording = item.script === 'arabic' ? strip(item.wording) : item.wording.toLocaleLowerCase('en');
    const key = `${item.surah}:${item.ayah}|${item.script}|${wording}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...item, wording });
  }
  return kept.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.script.localeCompare(b.script) || a.wording.localeCompare(b.wording));
}

export function capOccurrences(items: readonly WordingOccurrence[]): { listed: WordingOccurrence[]; unlisted: number } {
  const all = dedupeOccurrences(items);
  return { listed: all.slice(0, OCCURRENCE_CAP), unlisted: Math.max(0, all.length - OCCURRENCE_CAP) };
}

export function groupCampaigns(
  items: readonly { key: string; label: string; surah: number; ayah: number }[],
): CampaignGroup[] {
  const groups = new Map<string, CampaignGroup>();
  for (const item of items) {
    const group = groups.get(item.key) ?? { label: item.label, verses: [] };
    if (item.label.length < group.label.length) group.label = item.label;
    if (!group.verses.some(verse => verse.surah === item.surah && verse.ayah === item.ayah)) {
      group.verses.push({ surah: item.surah, ayah: item.ayah });
    }
    groups.set(item.key, group);
  }
  return [...groups.values()]
    .map(group => ({
      ...group,
      verses: [...group.verses].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah),
    }))
    .sort((a, b) => a.verses[0].surah - b.verses[0].surah || a.verses[0].ayah - b.verses[0].ayah);
}

export function occurrenceContext(items: readonly { wording: string; script: 'english' | 'arabic' }[]): string {
  const parts = items.map(item => `${item.script === 'arabic' ? 'Arabic' : 'English'} “${item.wording}”`);
  return `Word occurrence: ${parts.join('; ')}.`;
}

export function corpusPassageContext(
  surah: number,
  ayah: number,
  split: { occurrences: readonly WordingOccurrence[]; campaigns: readonly CampaignGroup[]; unnamed: readonly { surah: number; ayah: number }[] },
): string {
  const words = split.occurrences.filter(item => item.surah === surah && item.ayah === ayah);
  const campaign = split.campaigns.find(group => group.verses.some(verse => verse.surah === surah && verse.ayah === ayah));
  const unnamed = split.unnamed.some(verse => verse.surah === surah && verse.ayah === ayah);
  const parts: string[] = [];
  if (words.length) parts.push(occurrenceContext(words));
  if (campaign) parts.push(`Historical event: ${campaign.label}.`);
  else if (unnamed) parts.push('This passage narrates a conflict and does not name the campaign.');
  if (!words.length) parts.push('This verse does not contain a counted wording.');
  return parts.join(' ');
}

function refLine(surah: number, ayah: number): string {
  return `Qur’an ${surah}:${ayah}`;
}

/** The two counts come first. The reference lists follow. The numbers are the lengths of the lists. */
export function formatCorpusCount(input: {
  english: readonly string[];
  arabic: readonly string[];
  occurrences: readonly WordingOccurrence[];
  campaigns: readonly CampaignGroup[];
  unnamed: readonly { surah: number; ayah: number }[];
  unlisted: number;
  truncated?: boolean;
}): { text: string; citations: string[] }[] {
  const occurrences = dedupeOccurrences(input.occurrences);
  const english = input.english.length ? input.english.join(', ') : 'none';
  const arabic = input.arabic.length ? input.arabic.join(', ') : 'none';
  const count = occurrences.length;
  const census =
    input.unlisted > 0 || input.truncated
      ? `${count} distinct ${count === 1 ? 'occurrence is' : 'occurrences are'} listed after the same wording in the same verse was counted once. ${
          input.unlisted > 0
            ? input.unlisted === 1
              ? `${input.unlisted} further distinct occurrence was retrieved and is not listed, so this is not a complete census.`
              : `${input.unlisted} further distinct occurrences were retrieved and are not listed, so this is not a complete census.`
            : 'The corpus search returned more matches than were read, so this is not a complete census.'
        }`
      : `${count} distinct ${count === 1 ? 'occurrence remains' : 'occurrences remain'} after the same wording in the same verse was counted once.`;
  const lines = occurrences.map(item => {
    const script = item.script === 'arabic' ? 'Arabic' : 'English';
    return `${refLine(item.surah, item.ayah)} — ${script} “${item.wording}”.`;
  });
  const occurrenceIds = [...new Set(occurrences.map(item => `Q${item.surah}-${item.ayah}`))];
  const unnamed = [...input.unnamed].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  const named = input.campaigns.length;
  const eventSummary = named || unnamed.length
    ? `Historical events. ${named} ${named === 1 ? 'campaign is' : 'campaigns are'} named in the retrieved passages. This count is not the word count.`
    : 'Historical events. No retrieved passage names a campaign, so this reading has no second count.';
  const summary = `Word occurrence. English wordings counted: ${english}. Arabic wordings counted: ${arabic}. ${census}\n${eventSummary}`;
  const eventLines = [
    ...input.campaigns.map(group => `${group.label} — ${group.verses.map(verse => refLine(verse.surah, verse.ayah)).join('; ')}.`),
    ...unnamed.map(verse => `${refLine(verse.surah, verse.ayah)} narrates a conflict and does not name the campaign.`),
  ];
  const eventIds = [
    ...input.campaigns.flatMap(group => group.verses.map(verse => `Q${verse.surah}-${verse.ayah}`)),
    ...unnamed.map(verse => `Q${verse.surah}-${verse.ayah}`),
  ];
  const sections = [
    eventLines.length ? `Campaigns\n${eventLines.join('\n')}` : '',
    lines.length ? `Word occurrences\n${lines.join('\n')}` : '',
  ].filter(Boolean);
  if (!sections.length) return [{ text: summary, citations: occurrenceIds }];
  return [
    { text: summary, citations: occurrenceIds },
    { text: sections.join('\n\n'), citations: [...new Set([...occurrenceIds, ...eventIds])] },
  ];
}
