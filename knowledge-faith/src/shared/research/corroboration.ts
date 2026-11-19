import type { EvidencePassage } from '../contracts/v1.ts';

export interface SharedSource {
  key: string;
  passageIds: string[];
  note: string;
}

export interface DedupeResult {
  passages: EvidencePassage[];
  shared: SharedSource[];
  /** A dropped duplicate quotation id points at the passage that was kept. */
  citationAliases: Record<string, string>;
}

function sameQuotation(left: EvidencePassage, right: EvidencePassage): boolean {
  return left.text.trim() === right.text.trim();
}

/**
 * Two agents citing the same page are one source.
 * The same quotation is kept once. Distinct passages from that page are all kept.
 */
export function dedupePassages(passages: readonly EvidencePassage[]): DedupeResult {
  const groups = new Map<string, EvidencePassage[]>();
  for (const passage of passages) {
    const key = `${passage.source.provider}:${passage.source.canonicalUrl || passage.source.id}`;
    const group = groups.get(key) ?? [];
    group.push(passage);
    groups.set(key, group);
  }
  const kept: EvidencePassage[] = [];
  const shared: SharedSource[] = [];
  const citationAliases: Record<string, string> = {};
  for (const [key, group] of groups) {
    const unique: EvidencePassage[] = [];
    for (const passage of group) {
      const twin = unique.find(item => sameQuotation(item, passage));
      if (twin) {
        citationAliases[passage.id] = twin.id;
        continue;
      }
      unique.push(passage);
    }
    kept.push(...unique);
    if (group.length > 1) {
      const provider = group[0].source.provider;
      const locator = group[0].locator;
      const note = unique.length === 1
        ? `${provider} ${locator} is cited ${group.length} times. That is one source, not independent corroboration.`
        : `${provider} ${locator} contains ${unique.length} distinct passages. They count as one source, not independent corroboration.`;
      shared.push({ key, passageIds: group.map(passage => passage.id), note });
    }
  }
  return { passages: kept, shared, citationAliases };
}
