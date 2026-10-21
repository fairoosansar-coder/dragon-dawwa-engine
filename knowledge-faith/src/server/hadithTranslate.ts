import { Type, type Schema } from '@google/genai';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import type { Hadith } from '../shared/types.ts';
import { withoutVanakkam } from '../engine/utils/tamilGreeting.ts';
import { completeJson, geminiConfigured } from './gemini.ts';

const translationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    translations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['translations'],
};

export interface RenderedText {
  text: string;
  machineTranslation: boolean;
}

export type TextTranslator = (texts: string[], lang: Lang) => Promise<string[] | null>;

const cache = new Map<string, string>();

export function clearHadithTranslationCache(): void {
  cache.clear();
}

function cacheKey(lang: Lang, text: string): string {
  return `${lang}\0${text}`;
}

/** Keep the English source when the model does not return one string per input. */
export function applyMachineTranslation(texts: string[], translations: string[] | null | undefined, lang: Lang): RenderedText[] {
  if (lang === 'en' || !translations || translations.length !== texts.length) {
    return texts.map(text => ({ text, machineTranslation: false }));
  }
  return texts.map((original, i) => {
    const next = String(translations[i] ?? '').trim();
    if (!next) return { text: original, machineTranslation: false };
    return { text: lang === 'ta' ? withoutVanakkam(next) : next, machineTranslation: true };
  });
}

function batchEnd(items: { text: string }[], start: number): number {
  let chars = 0;
  let end = start;
  while (end < items.length && end - start < 40) {
    const next = items[end].text.length;
    if (end > start && chars + next > 7000) break;
    chars += next;
    end += 1;
  }
  return end;
}

export async function translateStudyTexts(texts: string[], lang: Lang, translate: TextTranslator = geminiStudyTranslator): Promise<RenderedText[]> {
  if (lang === 'en' || texts.length === 0) return texts.map(text => ({ text, machineTranslation: false }));
  const result: RenderedText[] = texts.map(text => ({ text, machineTranslation: false }));
  const missing: { index: number; text: string }[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i].trim()) continue;
    const hit = cache.get(cacheKey(lang, texts[i]));
    if (hit) result[i] = { text: hit, machineTranslation: true };
    else missing.push({ index: i, text: texts[i] });
  }
  for (let start = 0; start < missing.length; ) {
    const end = batchEnd(missing, start);
    const batch = missing.slice(start, end);
    start = end;
    let translated: string[] | null = null;
    try {
      translated = await translate(batch.map(item => item.text), lang);
    } catch (err) {
      console.error('Hadith study rendering failed:', (err as Error)?.message);
    }
    const applied = applyMachineTranslation(
      batch.map(item => item.text),
      translated,
      lang,
    );
    applied.forEach((item, j) => {
      result[batch[j].index] = item;
      if (item.machineTranslation) cache.set(cacheKey(lang, batch[j].text), item.text);
    });
  }
  return result;
}

/** Render English hadith text into Tamil or Sinhala. Arabic, grades, and published editions stay as fetched. */
export async function localizeHadith(
  hadiths: Hadith[],
  requested: Lang,
  sourceLang: Lang,
  translate: TextTranslator = geminiStudyTranslator,
): Promise<Hadith[]> {
  if (requested === 'en' || sourceLang !== 'en') {
    return hadiths.map(h => ({ ...h, machineTranslation: false }));
  }
  const bodies = await translateStudyTexts(
    hadiths.map(h => h.text),
    requested,
    translate,
  );
  const titles = [...new Set(hadiths.map(h => h.section).filter((title): title is string => Boolean(title)))];
  const renderedTitles = await translateStudyTexts(titles, requested, translate);
  const titleMap = new Map(titles.map((title, i) => [title, renderedTitles[i]]));
  return hadiths.map((h, i) => {
    const body = bodies[i];
    const section = h.section ? titleMap.get(h.section) : undefined;
    if (!body?.machineTranslation) return { ...h, machineTranslation: false };
    return {
      ...h,
      text: body.text,
      lang: requested,
      section: section?.machineTranslation ? section.text : h.section,
      machineTranslation: true,
    };
  });
}

async function geminiStudyTranslator(texts: string[], lang: Lang): Promise<string[] | null> {
  if (!geminiConfigured() || (lang !== 'ta' && lang !== 'si')) return null;
  const language = LANGUAGE_NAMES[lang].english;
  const greeting =
    lang === 'ta'
      ? ' Never write the Tamil word வணக்கம். If a greeting is required, write அஸ்ஸலாமு அலைக்கும்.'
      : '';
  const value = await completeJson<{ translations: string[] }>(
    `Translate each string into ${language}. These are book titles or hadith narrations taken from a published English edition. Preserve the meaning, personal names, and Islamic terms. Do not add commentary, grades, Arabic, or extra items. Return exactly ${texts.length} strings in the same order.${greeting}\n\nSTRINGS:\n${JSON.stringify(texts)}`,
    translationSchema,
  );
  return Array.isArray(value.translations) ? value.translations : null;
}
