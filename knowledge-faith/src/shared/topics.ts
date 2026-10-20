import type { Lang } from './sources.ts';

export interface Topic {
  id: string;
  title: Record<Lang, string>;
  /** Verse references only; verse text is always fetched from the named translation. */
  refs: string[];
}

export const TOPICS: Topic[] = [
  {
    id: 'patience',
    title: { en: 'Patience', ta: 'பொறுமை', si: 'ඉවසීම' },
    refs: ['2:153', '2:155-157', '39:10', '103:1-3'],
  },
  {
    id: 'prayer',
    title: { en: 'Prayer', ta: 'தொழுகை', si: 'සලාතය' },
    refs: ['2:45', '2:238', '20:14', '29:45'],
  },
  {
    id: 'knowledge',
    title: { en: 'Seeking knowledge', ta: 'அறிவைத் தேடுதல்', si: 'දැනුම සෙවීම' },
    refs: ['96:1-5', '20:114', '39:9', '58:11'],
  },
  {
    id: 'mercy',
    title: { en: 'Mercy & forgiveness', ta: 'கருணையும் மன்னிப்பும்', si: 'කරුණාව හා සමාව' },
    refs: ['7:156', '21:107', '39:53'],
  },
  {
    id: 'gratitude',
    title: { en: 'Gratitude', ta: 'நன்றியுணர்வு', si: 'කෘතඥතාව' },
    refs: ['2:152', '14:7', '31:12'],
  },
  {
    id: 'parents',
    title: { en: 'Parents & family', ta: 'பெற்றோரும் குடும்பமும்', si: 'දෙමාපියන් හා පවුල' },
    refs: ['17:23-24', '31:14', '46:15'],
  },
  {
    id: 'charity',
    title: { en: 'Charity', ta: 'தர்மம்', si: 'දානය' },
    refs: ['2:261', '2:267', '2:274'],
  },
  {
    id: 'faith',
    title: { en: 'Faith', ta: 'ஈமான்', si: 'ඊමාන්' },
    refs: ['2:177', '2:285', '49:15'],
  },
];

/** A deterministic verse for each calendar day, drawn from the curated theme references. */
export function verseOfTheDay(date: Date): string {
  const all = TOPICS.flatMap(t => t.refs.map(r => r.split('-')[0]));
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return all[day % all.length];
}
