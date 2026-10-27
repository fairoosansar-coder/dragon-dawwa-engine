import { useRemote } from '../../lib/api.ts';
import { useApp, useStored } from '../../lib/store.tsx';
import type { Lang } from '../../shared/sources.ts';
import type { McpEdition, McpMorphology, McpTafsirResult } from '../../shared/quranMcp.ts';
import type { SurahInfo, Verse } from '../../shared/types.ts';
import { ErrorNote, Loading } from '../ui.tsx';

function storedEdition(value: unknown, editions: McpEdition[]): string {
  if (typeof value !== 'string' || !editions.length) return '';
  return editions.some(item => item.editionId === value) ? value : '';
}

function editionLabel(edition: McpEdition): string {
  return edition.author ? `${edition.name} — ${edition.author}` : edition.name;
}

export function AyahStudyPanel({
  info,
  verse,
  ayah,
  lang,
  onAyah,
}: {
  info: SurahInfo;
  verse: Verse | null;
  ayah: number;
  lang: Lang;
  onAyah: (ayah: number) => void;
}) {
  const { t } = useApp();
  const [storedTafsir, setStoredTafsir] = useStored<unknown>('kf-mcp-tafsir', '');
  const editions = useRemote<McpEdition[]>('/api/quran/mcp/editions?type=tafsir');
  const catalogue = editions.data ?? [];
  const editionId = storedEdition(storedTafsir, catalogue);
  const selected = catalogue.find(item => item.editionId === editionId) ?? null;
  const ayahKey = info.number >= 1 && ayah >= 1 ? `${info.number}:${ayah}` : null;
  const tafsir = useRemote<McpTafsirResult>(ayahKey && editionId ? `/api/quran/mcp/tafsir?ayah=${ayahKey}&edition=${encodeURIComponent(editionId)}` : null);
  const words = useRemote<McpMorphology>(ayahKey ? `/api/quran/mcp/morphology?ayah=${ayahKey}` : null);
  const passage = tafsir.data && tafsir.data.ayah === ayahKey && tafsir.data.editionId === editionId ? tafsir.data : null;
  const wordList = words.data && words.data.ayah === ayahKey ? words.data : null;
  const gap = lang === 'ta' ? t.tafsirGapTamil : lang === 'si' ? t.tafsirGapSinhala : null;
  const ordered = [...catalogue].sort((a, b) => {
    const rank = (code: string) => (code === 'en' ? 0 : code === 'ar' ? 1 : 2);
    return rank(a.lang) - rank(b.lang) || a.name.localeCompare(b.name);
  });

  return (
    <section className="mx-auto w-full max-w-[42rem] space-y-8" data-ayah-study>
      <header className="space-y-2">
        <p className="text-sm text-muted">
          {info.englishName} · {ayah}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <button type="button" className="font-medium text-pine disabled:opacity-40" disabled={ayah <= 1} onClick={() => onAyah(ayah - 1)}>
            {t.previousAyah}
          </button>
          <button type="button" className="font-medium text-pine disabled:opacity-40" disabled={ayah >= info.numberOfAyahs} onClick={() => onAyah(ayah + 1)}>
            {t.nextAyah}
          </button>
        </div>
      </header>

      {verse && (
        <div className="space-y-6">
          <p lang="ar" dir="rtl" className="quran-face text-3xl text-ink sm:text-4xl">
            {verse.arabic}
          </p>
          <p data-study-translation lang={lang} className="quran-prose text-xl">
            {verse.translation.trim() ? verse.translation : t.verseTranslationUnavailable}
            <span className="mx-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#1c3d66]/25 px-1 align-middle text-[11px] text-[#1c3d66]">
              {verse.ayah}
            </span>
          </p>
          {verse.footnotes?.trim() ? (
            <p lang={lang} className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {verse.footnotes}
            </p>
          ) : null}
        </div>
      )}

      <div className="space-y-4">
        {gap && (
          <p data-tafsir-notice className="text-sm leading-relaxed text-pine">
            {gap}
          </p>
        )}
        <label className="flex max-w-xl flex-col gap-1 text-xs font-medium text-muted">
          {t.tafsirEdition}
          {editions.loading && !catalogue.length ? (
            <Loading />
          ) : editions.error ? (
            <ErrorNote message={t.tafsirFailed} onRetry={editions.reload} />
          ) : (
            <select
              id="kf-tafsir-edition"
              value={editionId}
              onChange={event => setStoredTafsir(event.target.value)}
              className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink"
            >
              <option value="">{t.tafsirChoose}</option>
              {ordered.map(item => (
                <option key={item.editionId} value={item.editionId}>
                  {editionLabel(item)}
                </option>
              ))}
            </select>
          )}
        </label>

        {!editionId && !editions.loading && !editions.error && <p className="text-sm text-muted">{t.tafsirEmpty}</p>}
        {editionId && tafsir.loading && !passage && <Loading />}
        {editionId && tafsir.error && <ErrorNote message={t.tafsirFailed} onRetry={tafsir.reload} />}
        {passage && passage.passages.length === 0 && !tafsir.loading && <p className="text-sm text-muted">{t.tafsirEmpty}</p>}
        {passage?.passages.map(item => (
          <article key={`${item.range}:${item.citationUrl}`} data-tafsir-passage data-tafsir-ayah={passage.ayah} className="quran-sheet px-5 py-6 sm:px-8">
            {selected && (
              <p data-tafsir-edition className="text-sm font-medium text-[#1c3d66]">
                {editionLabel(selected)}
              </p>
            )}
            <p className="mt-1 text-sm">
              <a data-tafsir-citation href={item.citationUrl} className="text-[#1c3d66] underline">
                {t.quranCom}
              </a>
            </p>
            <div data-tafsir-text lang={selected?.lang === 'ar' ? 'ar' : 'en'} dir={selected?.lang === 'ar' ? 'rtl' : 'ltr'} className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-[#1a1a1a]">
              {item.text}
            </div>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-xl font-bold text-pine">{t.wordsTitle}</h3>
        {words.loading && !wordList && <Loading />}
        {words.error && <ErrorNote message={t.wordsFailed} onRetry={words.reload} />}
        {wordList && wordList.words.length === 0 && !words.loading && <p className="text-sm text-muted">{t.wordsEmpty}</p>}
        {wordList && wordList.words.length > 0 && (
          <>
            <ol className="space-y-4" data-words-ayah={wordList.ayah}>
              {wordList.words.map(word => (
                <li key={word.position} className="border-b border-pine/10 pb-3">
                  <p lang="ar" dir="rtl" className="quran-face text-2xl text-ink">
                    {word.text}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">
                    {word.transliteration ? <span>{word.transliteration}</span> : null}
                    {word.translation ? <span>{word.transliteration ? ' · ' : ''}{word.translation}</span> : null}
                    {word.root ? (
                      <span>
                        {' '}
                        · {t.rootLabel} {word.root}
                      </span>
                    ) : null}
                  </p>
                  {word.description ? <p className="mt-1 text-sm leading-relaxed text-muted">{word.description}</p> : null}
                </li>
              ))}
            </ol>
            {wordList.citationUrl && (
              <p className="text-sm">
                <a data-words-citation href={wordList.citationUrl} className="text-pine underline">
                  {t.quranCom}
                </a>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
