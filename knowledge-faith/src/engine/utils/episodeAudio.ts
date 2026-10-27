const DB_NAME = 'dragon-dawwa';
const STORE = 'episode-audio';

export function episodeAudioKey(language: string, revision: string, question: string): string {
  return `${language}:${revision}:${question.trim().slice(0, 180)}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function loadEpisodeClips(key: string): Promise<Record<string, string>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => {
      const value = request.result as { clips?: Record<string, string> } | undefined;
      resolve(value?.clips ?? {});
    };
    request.onerror = () => resolve({});
  });
}

export async function saveEpisodeClip(key: string, index: number, audio: string): Promise<void> {
  const db = await openDb();
  if (!db || !audio) return;
  const clips = await loadEpisodeClips(key);
  clips[String(index)] = audio;
  await new Promise<void>(resolve => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ clips }, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
