import { useCallback, useEffect, useRef } from 'react';
import { useRemote } from './api.ts';
import { useApp, useStored } from './store.tsx';
import { DEFAULT_EDITION_KEY, immediateEditionKey, type QuranEncEdition } from '../shared/quranenc.ts';
import { stopForEditionChange, stopForLanguageChange, storedEditionMap } from './quranPlayback.ts';
import type { Lang } from '../shared/sources.ts';

export function useQuranEdition() {
  const { lang } = useApp();
  const [raw, setRaw] = useStored<unknown>('kf-quran-edition', {});
  const stored = storedEditionMap(raw);
  const catalog = useRemote<QuranEncEdition[]>(`/api/quran/editions?lang=${lang}`);
  const langRef = useRef(lang);

  useEffect(() => {
    if (langRef.current !== lang) {
      stopForLanguageChange(langRef.current, lang);
      langRef.current = lang;
    }
  }, [lang]);

  useEffect(() => {
    if (catalog.loading || !catalog.data) return;
    const map = storedEditionMap(raw);
    const rows = catalog.data.filter(item => item.languageIso === lang);
    const current = map[lang];
    if (current && rows.some(item => item.key === current)) return;
    const next = rows.find(item => item.key === DEFAULT_EDITION_KEY[lang]);
    if (!next || next.key === current) return;
    stopForEditionChange(current ?? '', next.key);
    setRaw({ ...map, [lang]: next.key });
  }, [catalog.data, catalog.loading, lang, raw, setRaw]);

  const choose = useCallback(
    (key: string) => {
      const rows = (catalog.data ?? []).filter(item => item.languageIso === lang);
      if (!rows.some(item => item.key === key)) return;
      stopForEditionChange(stored[lang] ?? '', key);
      setRaw({ ...stored, [lang]: key });
    },
    [catalog.data, lang, setRaw, stored],
  );

  const accept = useCallback(
    (target: Lang, key: string) => {
      if (!/^[a-z0-9_]+$/.test(key)) return;
      const map = storedEditionMap(raw);
      if (map[target] === key) return;
      if (target === lang) stopForEditionChange(map[lang] ?? '', key);
      setRaw({ ...map, [target]: key });
    },
    [lang, raw, setRaw],
  );

  const editions = !catalog.loading && catalog.data ? catalog.data.filter(item => item.languageIso === lang) : [];
  const editionKey = immediateEditionKey(lang, stored);
  const edition = editions.find(item => item.key === editionKey) ?? null;

  return { editions, edition, editionKey, error: catalog.error, loading: catalog.loading, reload: catalog.reload, choose, accept };
}
