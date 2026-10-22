import { createHash } from 'node:crypto';

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export interface IndexedCopy {
  key: string;
  version: string;
  contentHash: string;
  text: string;
  storedAt: string;
}

export type IndexStatus = 'fresh' | 'stale' | 'miss';

/**
 * In-memory copies of retrieved text. A changed version or hash does not return the old text.
 * The map is bounded. It is not a crawl of a source.
 */
export function createContentIndex(maxEntries = 200) {
  const entries = new Map<string, IndexedCopy>();

  function dropOldest() {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (!oldest) break;
      entries.delete(oldest);
    }
  }

  return {
    status(key: string, version: string, hash: string): IndexStatus {
      const current = entries.get(key);
      if (!current) return 'miss';
      return current.version === version && current.contentHash === hash ? 'fresh' : 'stale';
    },
    read(key: string, version: string, hash: string): IndexedCopy | null {
      const current = entries.get(key);
      if (!current || current.version !== version || current.contentHash !== hash) return null;
      entries.delete(key);
      entries.set(key, current);
      return current;
    },
    put(key: string, version: string, hash: string, text: string, storedAt: string): { replacedStale: boolean } {
      const previous = entries.get(key);
      const replacedStale = Boolean(previous && (previous.version !== version || previous.contentHash !== hash));
      entries.set(key, { key, version, contentHash: hash, text, storedAt });
      dropOldest();
      return { replacedStale };
    },
    size(): number {
      return entries.size;
    },
  };
}

export type ContentIndex = ReturnType<typeof createContentIndex>;
