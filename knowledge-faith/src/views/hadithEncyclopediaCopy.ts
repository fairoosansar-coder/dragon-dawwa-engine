import type { Lang } from '../shared/sources.ts';

/** HadeethEnc 66520: “loves for his brother…”, narrator Anas ibn Mālik, grade Authentic. */
export const FEATURED_HADEETH_ID = '66520';

export interface KutubBook {
  id: string;
  name: string;
  tamil: string;
}

/** The six books already indexed by the study collection. Tamil names are the labels used in the app. */
export const KUTUB_AL_SITTAH: KutubBook[] = [
  { id: 'bukhari', name: 'Sahih al-Bukhari', tamil: 'ஸஹீஹ் அல்-புகாரி' },
  { id: 'muslim', name: 'Sahih Muslim', tamil: 'ஸஹீஹ் முஸ்லிம்' },
  { id: 'abudawud', name: 'Sunan Abi Dawud', tamil: 'சுனன் அபூ தாவூத்' },
  { id: 'tirmidhi', name: "Jami' at-Tirmidhi", tamil: 'ஜாமிஉ அத்-திர்மிதி' },
  { id: 'nasai', name: "Sunan an-Nasa'i", tamil: 'சுனன் அன்-நஸாஈ' },
  { id: 'ibnmajah', name: 'Sunan Ibn Majah', tamil: 'சுனன் இப்னு மாஜா' },
];

export interface EncyclopediaDomain {
  id: string;
  english: string;
  tamil: string;
  description: string;
}

/**
 * The seven HadeethEnc root categories. Titles are the Tamil names returned by that list.
 * Counts are not stored here.
 */
export const ENCYCLOPEDIA_DOMAINS: EncyclopediaDomain[] = [
  {
    id: '1',
    english: "Qur'an sciences",
    tamil: 'அல்குர்ஆனும் அதன் கலைகளும்',
    description: 'அல்குர்ஆன், அதன் விளக்கம், ஓதல், மற்றும் வசனங்கள் சார்ந்த பதிவுகள்.',
  },
  {
    id: '2',
    english: 'Hadith sciences',
    tamil: 'ஹதீஸ், ஹதீஸ் கலைகள்',
    description: 'அறிவிப்பாளர், இஸ்னாத், மற்றும் ஹதீஸ் முறைமை பற்றிய பதிவுகள்.',
  },
  {
    id: '3',
    english: 'Aqeedah',
    tamil: 'இஸ்லாமிய அடிப்படைக் கொள்கை',
    description: 'ஈமான், தவ்ஹீத், மற்றும் நம்பிக்கையின் அடிப்படைகள்.',
  },
  {
    id: '4',
    english: 'Fiqh',
    tamil: 'பிக்ஹும் அதன் அடிப்படைகளும்',
    description: 'வழிபாடு, குடும்பம், மற்றும் அன்றாட சட்ட விளக்கங்கள்.',
  },
  {
    id: '5',
    english: 'Adab',
    tamil: 'சிறப்புக்களும் ஒழுக்கங்களும்',
    description: 'நற்குணம், உறவுகள், மற்றும் நடத்தை பற்றிய பதிவுகள்.',
  },
  {
    id: '6',
    english: "Da'wah",
    tamil: 'அழைப்புப் பணி',
    description: 'அழைப்பு, நல்லுபதேசம், மற்றும் சமூகப் பொறுப்பு.',
  },
  {
    id: '7',
    english: 'Seerah',
    tamil: 'நபியவர்களின் வாழ்க்கையும் வரலாறும்',
    description: 'நபியவர்களின் வாழ்க்கை, அழைப்பு, மற்றும் வரலாறு.',
  },
];

export interface TopicChip {
  id: string;
  label: string;
  sahih?: boolean;
  categoryId?: string;
  query?: Record<Lang, string>;
}

export const TOPIC_CHIPS: TopicChip[] = [
  { id: 'sahih', label: 'Sahih Only', sahih: true },
  { id: 'love', label: 'அன்பும் இரக்கமும்', query: { en: 'loves for his brother', ta: 'சகோதரன்', si: 'සහෝදරයා' } },
  { id: 'prayer', label: 'தொழுகை', categoryId: '134' },
  { id: 'family', label: 'குடும்ப உறவுகள்', categoryId: '124' },
  { id: 'character', label: 'நற்குணம்', categoryId: '282' },
];

const SAHIH_GRADE = /authentic|sahih|ṣaḥīḥ|sahīh|صحيح|சரியான|සහී|සහිහ්/i;

/** The published grade, only when that text itself says the hadith is authentic. */
export function sahihBadge(grade: string | null | undefined): string | null {
  const clean = grade?.trim() ?? '';
  if (!clean || !SAHIH_GRADE.test(clean)) return null;
  return clean;
}

export function narratorFromRecord(parts: { arabic?: string | null; text?: string | null; intro?: string | null }): string | null {
  const blob = [parts.intro, parts.text, parts.arabic].filter(Boolean).join('\n');
  const malik = blob.match(/Anas ibn M[āa]lik|அனஸ் இப்னு மாலிக்|அனஸ் பின் மாலிக்|أَنَسِ بْنِ مَالِكٍ|انس بن مالك|අනස් ඉබ්න් මාලික්/i);
  if (malik) return malik[0];
  const anas = blob.match(/\bAnas\b|அனஸ்|أَنَسٍ|අනස්/);
  return anas ? anas[0] : null;
}

export function isBrotherhoodRecord(parts: { arabic?: string | null; text?: string | null; title?: string | null }): boolean {
  const blob = [parts.arabic, parts.text, parts.title].filter(Boolean).join('\n');
  return /يُحِبَّ لِأَخِيهِ|يحب لأخيه|loves for his brother|சகோதரனுக்கு|සහෝදරයා/i.test(blob);
}

/** Last numbered hadith from the study index. Absent when the index did not confirm one. */
export function confirmedIndexLabel(last: unknown): string | null {
  const n = typeof last === 'number' ? last : typeof last === 'string' && last.trim() ? Number(last) : NaN;
  if (!Number.isInteger(n) || n <= 0) return null;
  return `1–${n.toLocaleString('en-US')}`;
}

export function confirmedCount(count: unknown): number | null {
  const n = typeof count === 'number' ? count : typeof count === 'string' && count.trim() ? Number(count) : NaN;
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function researchStudioHref(text: string): string {
  const q = text.replace(/\s+/g, ' ').trim().slice(0, 500);
  return `#/hadith/research?q=${encodeURIComponent(q)}`;
}
