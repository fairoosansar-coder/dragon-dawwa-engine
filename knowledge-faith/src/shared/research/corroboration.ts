import type { EvidencePassage } from '../contracts/v1.ts';

export interface SharedSource {
  key: string;
  passageIds: string[];
  note: string;
}

/** Two agents citing the same page are one source. The page is kept once. */
export function dedupePassages(passages: readonly EvidencePassage[]): { passages: EvidencePassage[]; shared: SharedSource[] } {
  const groups = new Map<string, EvidencePassage[]>();
  for (const passage of passages) {
    const key = `${passage.source.provider}:${passage.source.canonicalUrl || passage.source.id}`;
    const group = groups.get(key) ?? [];
    group.push(passage);
    groups.set(key, group);
  }
  const kept: EvidencePassage[] = [];
  const shared: SharedSource[] = [];
  for (const [key, group] of groups) {
    kept.push(group[0]);
    if (group.length > 1) {
      shared.push({
        key,
        passageIds: group.map(passage => passage.id),
        note: `${group[0].source.provider} ${group[0].locator} is cited ${group.length} times. That is one source, not independent corroboration.`,
      });
    }
  }
  return { passages: kept, shared };
}
