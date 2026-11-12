import { Type, type Schema } from '@google/genai';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { deduplicateHonorifics } from '../shared/hadithSegmentation.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import type { Hadith } from '../shared/types.ts';
import { withoutVanakkam } from '../engine/utils/tamilGreeting.ts';
import { translateBatchToLanguage, translateTextToLanguage } from './ayahStudyService.ts';
import { completeJson, geminiConfigured } from './gemini.ts';
import { persistRoot } from './persist.ts';

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
  return `v3:${lang}\0${text}`;
}

function diskHadithTranslationPath(lang: Lang, text: string): string {
  const dir = path.join(persistRoot(), 'hadith-translation-cache');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  const hash = createHash('sha256').update(`v3|${lang}|${text}`).digest('hex').slice(0, 32);
  return path.join(dir, `${hash}.txt`);
}

function readCachedTranslation(lang: Lang, text: string): string | null {
  const mem = cache.get(cacheKey(lang, text));
  if (mem) return mem;
  try {
    const file = diskHadithTranslationPath(lang, text);
    if (existsSync(file)) {
      const val = readFileSync(file, 'utf8').trim();
      if (val) {
        cache.set(cacheKey(lang, text), val);
        return val;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedTranslation(lang: Lang, text: string, translated: string): void {
  cache.set(cacheKey(lang, text), translated);
  try {
    writeFileSync(diskHadithTranslationPath(lang, text), translated, 'utf8');
  } catch {
    /* ignore */
  }
}

/** Keep the English source when the model does not return one string per input. */
export function applyMachineTranslation(texts: string[], translations: string[] | null | undefined, lang: Lang): RenderedText[] {
  if (lang === 'en' || !translations || translations.length !== texts.length) {
    return texts.map(text => ({ text, machineTranslation: false }));
  }
  return texts.map((original, i) => {
    const rawNext = String(translations[i] ?? '').trim();
    if (!rawNext) return { text: original, machineTranslation: false };
    const cleaned = deduplicateHonorifics(lang === 'ta' ? withoutVanakkam(rawNext) : rawNext);
    return { text: cleaned, machineTranslation: true };
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

export async function translateStudyTexts(
  texts: string[],
  lang: Lang,
  translate: TextTranslator = fastStudyTranslator,
): Promise<RenderedText[]> {
  if (lang === 'en' || texts.length === 0) return texts.map(text => ({ text, machineTranslation: false }));
  const isCustomTranslator = translate !== fastStudyTranslator;
  const result: RenderedText[] = texts.map(text => ({ text, machineTranslation: false }));
  const missing: { index: number; text: string }[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i].trim()) continue;
    const hit = isCustomTranslator
      ? cache.get(cacheKey(lang, texts[i])) ?? null
      : readCachedTranslation(lang, texts[i]);
    if (hit) result[i] = { text: hit, machineTranslation: true };
    else missing.push({ index: i, text: texts[i] });
  }
  if (missing.length === 0) return result;

  // Translate up to 16 items immediately in parallel within a 4500ms budget, and warm any remaining items in background!
  const syncLimit = isCustomTranslator ? missing.length : Math.min(missing.length, 16);
  const immediateSlice = missing.slice(0, syncLimit);
  const backgroundSlice = missing.slice(syncLimit);

  if (backgroundSlice.length > 0 && !isCustomTranslator) {
    setImmediate(() => {
      void (async () => {
        for (let start = 0; start < backgroundSlice.length; ) {
          const end = batchEnd(backgroundSlice, start);
          const batch = backgroundSlice.slice(start, end);
          start = end;
          try {
            const tr = await translate(batch.map(item => item.text), lang);
            const app = applyMachineTranslation(batch.map(item => item.text), tr, lang);
            app.forEach((item, j) => {
              if (item.machineTranslation) writeCachedTranslation(lang, batch[j].text, item.text);
            });
          } catch {
            /* ignore background warm error */
          }
        }
      })();
    });
  }

  for (let start = 0; start < immediateSlice.length; ) {
    const end = batchEnd(immediateSlice, start);
    const batch = immediateSlice.slice(start, end);
    start = end;
    let translated: string[] | null = null;
    try {
      translated = isCustomTranslator
        ? await translate(batch.map(item => item.text), lang)
        : await Promise.race([
            translate(batch.map(item => item.text), lang),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 4500)),
          ]);
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
      if (item.machineTranslation) {
        if (isCustomTranslator) cache.set(cacheKey(lang, batch[j].text), item.text);
        else writeCachedTranslation(lang, batch[j].text, item.text);
      }
    });
  }
  return result;
}

/** Render English hadith text into Tamil or Sinhala. Arabic, grades, and published editions stay as fetched. */
export async function localizeHadith(
  hadiths: Hadith[],
  requested: Lang,
  sourceLang: Lang,
  translate: TextTranslator = fastStudyTranslator,
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

function refineIslamicTerminology(text: string, lang: Lang): string {
  let out = deduplicateHonorifics(text);
  if (lang === 'ta') {
    out = out
      .replace(/அல்லாஹ்வின் தூதர்\s*(?!\(ஸல்\))/gu, 'அல்லாஹ்வின் தூதர் (ஸல்) ')
      .replace(/நபி\s*\(\s*ஸல்\s*\)\s*\(\s*ஸல்\s*\)/gu, 'நபி (ஸல்)')
      .replace(/அல்லாஹ்வின் தூதர்\s*\(ஸல்\)\s*\(ஸல்\)/gu, 'அல்லாஹ்வின் தூதர் (ஸல்)')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return deduplicateHonorifics(out);
}

async function fastStudyTranslator(texts: string[], lang: Lang): Promise<string[] | null> {
  if (lang !== 'ta' && lang !== 'si') return null;
  try {
    // Translate all items concurrently in parallel (each individual request is < 1800 chars so it completes in ~350–600ms)
    const parallelResults = await Promise.all(
      texts.map(async item => {
        if (!item.trim()) return '';
        const tr = await translateTextToLanguage(item, lang, 'en');
        return refineIslamicTerminology(lang === 'ta' ? withoutVanakkam(tr) : tr, lang);
      }),
    );
    if (parallelResults.length === texts.length && parallelResults.some((t, i) => t !== texts[i])) {
      return parallelResults;
    }
  } catch {
    /* fall through to batch/Gemini */
  }
  try {
    const fast = await translateBatchToLanguage(texts, lang);
    if (Array.isArray(fast) && fast.length === texts.length && fast.some((t, i) => t !== texts[i])) {
      return fast.map(t => refineIslamicTerminology(lang === 'ta' ? withoutVanakkam(t) : t, lang));
    }
  } catch {
    /* fall through to Gemini */
  }
  return geminiStudyTranslator(texts, lang);
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
