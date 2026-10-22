import { useState } from 'react';
import { useRemote } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import { TAFSIR_FOOTNOTES_NOTE, verseSpanLabel } from '../shared/quranenc.ts';
import type { Lang } from '../shared/sources.ts';
import type { CommentarySpan } from '../shared/quranenc.ts';
import { ErrorNote, Loading } from './ui.tsx';

interface Passage {
  surah: number;
  lang: Lang;
  key: string;
  listedInTafsir: boolean;
  listNote: string;
  version: null;
  versionNote: string;
  source: string;
  spans: CommentarySpan[];
}

/** Collapsed Al-Mukhtasar. The surah text is requested only after the reader opens it. */
export function Mukhtasar({ surah, ayah, lang }: { surah: number; ayah: number; lang: Lang }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const remote = useRemote<Passage>(open ? `/api/quran/tafsir?lang=${lang}&surah=${surah}` : null);
  const passage = remote.data && remote.data.surah === surah && remote.data.lang === lang ? remote.data : null;
  const span = passage?.spans.find(item => ayah >= item.fromAya && ayah <= item.toAya) ?? null;

  return (
    <details
      className="mt-6 rounded-2xl border border-pine/10 bg-parchment px-4 py-3"
      onToggle={event => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-pine [&::-webkit-details-marker]:hidden">
        {t.tafsirTitle}
      </summary>
      {open && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink">
          <p className="text-muted">{t.tafsirAudioNote}</p>
          {remote.loading && !passage && <Loading />}
          {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
          {passage && (
            <>
              <p className="text-muted">{passage.listNote}</p>
              <p className="text-muted">
                {passage.key}
                {passage.version ? ` · ${passage.version}` : ''}
              </p>
              <p className="text-muted">{passage.versionNote}</p>
              {span ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">{verseSpanLabel(span.fromAya, span.toAya)}</p>
                  <p lang={lang} className="whitespace-pre-wrap">
                    {span.text}
                  </p>
                  {span.footnotes ? (
                    <p lang={lang} className="whitespace-pre-wrap text-ink/80">
                      {span.footnotes}
                    </p>
                  ) : (
                    <p className="text-muted">{TAFSIR_FOOTNOTES_NOTE}</p>
                  )}
                </div>
              ) : (
                !remote.loading && <p className="text-muted">{t.tafsirMissingVerse}</p>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}
