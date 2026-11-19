import type { ResearchDeskName } from '../lib/route.ts';

export interface ResearchStarter {
  id: string;
  title: string;
  detail: string;
  question: string;
}

/** One click fills the question and starts research. Hadith keeps its own benchmark dossiers. */
export const RESEARCH_STARTERS: Partial<Record<ResearchDeskName, readonly ResearchStarter[]>> = {
  quran: [
    {
      id: 'hardship',
      title: 'Facing hardship and feeling lost',
      detail: 'Surah 2:216',
      question: 'Facing hardship and feeling lost (Surah 2:216)',
    },
    {
      id: 'remembrance',
      title: 'Finding tranquility in remembrance',
      detail: 'Surah 13:28',
      question: 'Finding tranquility in remembrance (Surah 13:28)',
    },
    {
      id: 'balance',
      title: 'The cosmic balance of creation',
      detail: 'Surah 55:7-9',
      question: 'The cosmic balance of creation (Surah 55:7-9)',
    },
  ],
  fiqh: [
    {
      id: 'travel-worship',
      title: 'Principles of ease in travel worship',
      detail: 'Prayer and fasting on a journey',
      question: 'Principles of ease in travel worship',
    },
    {
      id: 'digital-commerce',
      title: 'Ethical parameters of modern digital commerce',
      detail: 'Contracts, trade, and online exchange',
      question: 'Ethical parameters of modern digital commerce',
    },
  ],
  seerah: [
    {
      id: 'hudaybiyyah',
      title: 'Leadership and diplomacy during the Treaty of Hudaybiyyah',
      detail: 'The treaty at al-Hudaybiyyah',
      question: 'Leadership and diplomacy during the Treaty of Hudaybiyyah',
    },
    {
      id: 'makkah',
      title: 'Empathy towards adversaries in Makkah',
      detail: 'The years before the Hijrah',
      question: 'Empathy towards adversaries in Makkah',
    },
  ],
  books: [
    {
      id: 'tawhid',
      title: 'The foundations of tawhid for a new reader',
      detail: 'What the books teach about the oneness of Allah',
      question: 'What do the books teach about the foundations of tawhid for a new reader?',
    },
    {
      id: 'mercy',
      title: 'Mercy in the character of the Prophet',
      detail: 'How the books describe his conduct',
      question: 'What do the books say about mercy in the character of the Prophet?',
    },
    {
      id: 'prayer',
      title: 'The inner life of prayer and remembrance',
      detail: 'Khushu and dhikr in the opened books',
      question: 'How do the books describe the inner life of prayer and remembrance?',
    },
    {
      id: 'adab',
      title: 'The adab of seeking knowledge',
      detail: 'How a student approaches the sources',
      question: 'What do the books say about the adab of seeking knowledge?',
    },
  ],
};
