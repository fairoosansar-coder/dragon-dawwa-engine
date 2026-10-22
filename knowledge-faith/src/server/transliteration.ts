/** Ayah text paired by `numberInSurah`. Transliteration is not stripped: the English edition does not prefix the basmala the way `quran-uthmani` does. */

export interface AyahText {
  numberInSurah: number;
  text: string;
}

export function cleanAyahText(text: string): string {
  return text.replace(/^\uFEFF/, '').trim();
}

/** Returns pronunciation text keyed by ayah, or null when the editions do not line up. */
export function pairTransliteration(arabic: AyahText[], transliteration: AyahText[]): Map<number, string> | null {
  if (arabic.length === 0 || arabic.length !== transliteration.length) return null;
  const byAyah = new Map<number, string>();
  for (const item of transliteration) {
    const text = cleanAyahText(item.text);
    if (!text || byAyah.has(item.numberInSurah)) return null;
    byAyah.set(item.numberInSurah, text);
  }
  for (const item of arabic) {
    if (!byAyah.has(item.numberInSurah)) return null;
  }
  return byAyah.size === arabic.length ? byAyah : null;
}
