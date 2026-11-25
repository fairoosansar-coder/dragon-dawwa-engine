import type { Lang } from './sources.ts';
import type { Hadith } from './types.ts';

/** Reviewed edition-specific correspondence, not a conversion between number systems. */
export function tamilMuslimReference(id: string, lang: Lang) {
  return id === '8953' && lang === 'ta' ? 1258 : null;
}

export function matchingTamilPassage(record: Hadith | null, number: number | null) {
  if (!number || record?.collection !== 'muslim' || record.number !== number ||
      record.lang !== 'ta' || record.machineTranslation !== false) return null;
  // The encyclopedia quotes the last part of Umar's Friday sermon, not the entire report.
  const start = record.text.lastIndexOf('மக்களே!');
  if (start < 0) return null;
  const passage = record.text.slice(start).split(/\s+-\s+மேற்கண்ட ஹதீஸ்/)[0].trim();
  return passage.includes('வெங்காய') && passage.includes('பூண்டு') && passage.includes('சமைத்து') ? passage : null;
}
