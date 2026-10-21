/** Secular Tamil "hello". Roundtable speech must not use it. */
const VANAKKAM = /வணக்கம்/g;

export function withoutVanakkam(text: string): string {
  return text.replace(VANAKKAM, 'அஸ்ஸலாமு அலைக்கும்');
}

/** Replace வணக்கம் in every string of a dossier, including the podcast script. */
export function scrubVanakkam<T>(value: T): T {
  if (typeof value === 'string') return withoutVanakkam(value) as T;
  if (Array.isArray(value)) return value.map(item => scrubVanakkam(item)) as T;
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = scrubVanakkam(item);
    return copy as T;
  }
  return value;
}
