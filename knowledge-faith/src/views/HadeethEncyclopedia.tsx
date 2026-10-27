import { useEffect, useState, type ReactNode } from 'react';
import type { ViewProps } from '../App.tsx';
import { RecordShare } from '../components/RecordShare.tsx';
import { EmptyState } from '../components/shell/widgets.tsx';
import { Card, ErrorNote, Loading, SectionTitle } from '../components/ui.tsx';
import { useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp } from '../lib/store.tsx';
import type { Lang } from '../shared/sources.ts';
import { hadeethShareText, textBeyondIntro, type EncyclopediaHadith, type HadeethCategory, type HadeethListPage, type HadeethSearchHit } from '../shared/hadeethenc.ts';
import type { ShareVerse } from '../lib/verseShare.ts';

function useLocationHash(): string {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function DetailsBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-pine/10 bg-parchment px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-pine [&::-webkit-details-marker]:hidden">{title}</summary>
      <div className="mt-3 space-y-3 text-sm leading-relaxed">{children}</div>
    </details>
  );
}

function shareVerse(hadith: EncyclopediaHadith): ShareVerse {
  return {
    surah: 0,
    ayah: 0,
    arabic: [hadith.arabic, hadith.explanationArabic, hadith.lessonsArabic.join('\n')].filter(Boolean).join('\n\n'),
    translation: [textBeyondIntro(hadith.intro, hadith.text), hadith.text, hadith.explanation, hadith.lessons.join('\n')].filter(Boolean).join('\n\n'),
    surahName: hadith.title,
    reference: `HadeethEnc ${hadith.id}`,
    translationTitle: hadith.grade ? `Grade: ${hadith.grade}` : 'HadeethEnc did not include a grade for this hadith.',
    translationKey: hadith.lang,
    translationDescription: hadith.attribution ?? undefined,
    sourceLabel: 'HadeethEnc',
  };
}

function HadithReading({ id }: { id: string }) {
  const { t, lang, setLang } = useApp();
  const hash = useLocationHash();
  const requested = new URLSearchParams(hash.split('?')[1] ?? '').get('lang');
  useEffect(() => {
    if (requested === 'en' || requested === 'ta' || requested === 'si') setLang(requested);
  }, [id, requested, setLang]);
  const remote = useRemote<EncyclopediaHadith>(`/api/hadeeth/${id}?lang=${lang}`);
  const hadith = remote.data && remote.data.id === id && remote.data.lang === lang ? remote.data : null;

  return (
    <Card>
      {remote.loading && !hadith && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.error === t.hadeethUnavailable ? undefined : remote.reload} />}
      {hadith && (
        <article className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-pine" lang={hadith.lang}>
            {hadith.title}
          </h2>
          {hadith.arabic ? (
            <div lang="ar" dir="rtl" className="arabic space-y-2 text-2xl leading-loose text-ink">
              {textBeyondIntro(hadith.arabicIntro, hadith.arabic) && <p className="whitespace-pre-wrap">{hadith.arabicIntro}</p>}
              <p className="whitespace-pre-wrap">{hadith.arabic}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">{t.arabicMissing}</p>
          )}
          <div lang={hadith.lang} className="space-y-2 text-lg leading-relaxed text-ink">
            {textBeyondIntro(hadith.intro, hadith.text) && <p className="whitespace-pre-wrap">{hadith.intro}</p>}
            <p className="whitespace-pre-wrap">{hadith.text}</p>
          </div>
          <DetailsBlock title={t.explanation}>
            {hadith.explanation ? (
              <p lang={hadith.lang} className="whitespace-pre-wrap">
                {hadith.explanation}
              </p>
            ) : (
              <p className="text-muted">{t.explanationEmpty}</p>
            )}
            {hadith.explanationArabic && (
              <p lang="ar" dir="rtl" className="arabic whitespace-pre-wrap text-xl">
                {hadith.explanationArabic}
              </p>
            )}
          </DetailsBlock>
          <DetailsBlock title={t.lessons}>
            {hadith.lessons.length ? (
              <ul className="list-disc space-y-2 pl-5" lang={hadith.lang}>
                {hadith.lessons.map(lesson => (
                  <li key={lesson} className="whitespace-pre-wrap">
                    {lesson}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{t.lessonsEmpty}</p>
            )}
            {hadith.lessonsArabic.length > 0 && (
              <ul lang="ar" dir="rtl" className="arabic list-disc space-y-2 pr-5 text-xl">
                {hadith.lessonsArabic.map(lesson => (
                  <li key={lesson} className="whitespace-pre-wrap">
                    {lesson}
                  </li>
                ))}
              </ul>
            )}
          </DetailsBlock>
          <DetailsBlock title={t.sourcesSection}>
            <p>{hadith.grade ? `Grade: ${hadith.grade}` : t.gradeEmpty}</p>
            {hadith.gradeArabic && (
              <p lang="ar" dir="rtl" className="arabic text-xl">
                {hadith.gradeArabic}
              </p>
            )}
            {hadith.attribution && <p lang={hadith.lang}>{hadith.attribution}</p>}
            {hadith.attributionArabic && (
              <p lang="ar" dir="rtl" className="arabic text-xl">
                {hadith.attributionArabic}
              </p>
            )}
            <p>HadeethEnc {hadith.id}</p>
            {hadith.sourceVersion && <p>Source edition {hadith.sourceVersion}</p>}
            <p className="text-muted">{t.audioOmitted}</p>
            <p>
              <a className="text-pine underline" href={hadith.sourceUrl} target="_blank" rel="noreferrer">
                {t.sourcePage}
              </a>
            </p>
          </DetailsBlock>
          <RecordShare
            text={hadeethShareText(hadith)}
            hash={`#/hadith/${hadith.id}?lang=${hadith.lang}`}
            verse={shareVerse(hadith)}
            lang={hadith.lang}
            filename={`hadeeth-${hadith.id}.png`}
            title={hadith.title}
          />
        </article>
      )}
    </Card>
  );
}

function CategoryList({ categoryId }: { categoryId: string }) {
  const { t, lang } = useApp();
  const hash = useLocationHash();
  const page = Number(new URLSearchParams(hash.split('?')[1] ?? '').get('page')) || 1;
  const remote = useRemote<HadeethListPage>(`/api/hadeeth/list?lang=${lang}&category=${categoryId}&page=${page}`);
  const data = remote.data && remote.data.lang === lang && remote.data.categoryId === categoryId && remote.data.page === page ? remote.data : null;
  return (
    <Card>
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && data.items.length === 0 && <EmptyState>{t.libraryEmpty}</EmptyState>}
      <ul className="space-y-2">
        {data?.items.map(item => (
          <li key={item.id}>
            <a href={`#/hadith/${item.id}?lang=${lang}`} className="block min-h-11 rounded-2xl border border-pine/10 bg-white px-4 py-3 text-sm hover:border-pine/40" lang={lang}>
              {item.title}
            </a>
          </li>
        ))}
      </ul>
      {data && (
        <div className="mt-4 flex gap-4 text-sm">
          {page > 1 && (
            <a className="font-semibold text-pine underline" href={`#/hadith/category/${categoryId}?lang=${lang}&page=${page - 1}`}>
              {t.previous}
            </a>
          )}
          {page < data.pages && (
            <a className="font-semibold text-pine underline" href={`#/hadith/category/${categoryId}?lang=${lang}&page=${page + 1}`}>
              {t.next}
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

function SearchResults({ phrase }: { phrase: string }) {
  const { t, lang } = useApp();
  const remote = useRemote<{ lang: Lang; phrase: string; items: HadeethSearchHit[] }>(
    phrase.length >= 2 ? `/api/hadeeth/search?lang=${lang}&q=${encodeURIComponent(phrase)}` : null,
  );
  const data = remote.data && remote.data.lang === lang && remote.data.phrase === phrase ? remote.data : null;
  return (
    <Card>
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && data.items.length === 0 && <EmptyState>{t.hadeethEmpty}</EmptyState>}
      <ul className="space-y-2">
        {data?.items.map(item => (
          <li key={item.id}>
            <a href={`#/hadith/${item.id}?lang=${lang}`} className="block rounded-2xl border border-pine/10 bg-white px-4 py-3 text-sm hover:border-pine/40" lang={lang}>
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function HadeethEncyclopedia({ sub, segments = [] }: ViewProps) {
  const { t, lang } = useApp();
  const { query } = useShell();
  const [phrase, setPhrase] = useState('');
  useEffect(() => {
    const handle = window.setTimeout(() => setPhrase(query.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [query]);
  const id = sub && /^\d+$/.test(sub) ? sub : null;
  const categoryId = sub === 'category' && segments[1] && /^\d+$/.test(segments[1]) ? segments[1] : null;

  if (id) return <HadithReading id={id} />;

  return (
    <div className="space-y-4">
      <SectionTitle sub={t.hadeethNote}>{t.encyclopedia}</SectionTitle>
      {phrase.length >= 2 ? (
        <SearchResults phrase={phrase} />
      ) : categoryId ? (
        <>
          <ChildCategories categoryId={categoryId} />
          <CategoryList categoryId={categoryId} />
        </>
      ) : (
        <Categories />
      )}
      {categoryId && phrase.length < 2 && (
        <p className="text-sm">
          <a className="text-pine underline" href={`#/hadith?lang=${lang}`}>
            {t.back}
          </a>
        </p>
      )}
    </div>
  );
}

function ChildCategories({ categoryId }: { categoryId: string }) {
  const { t, lang } = useApp();
  const remote = useRemote<{ lang: Lang; parentId: string | null; categories: HadeethCategory[] }>(
    `/api/hadeeth/categories?lang=${lang}&parent=${categoryId}`,
  );
  const data = remote.data && remote.data.lang === lang && remote.data.parentId === categoryId ? remote.data : null;
  if (!data?.categories.length) return null;
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-pine">{t.childCategories}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {data.categories.map(category => (
          <li key={category.id}>
            <a href={`#/hadith/category/${category.id}?lang=${lang}`} className="block min-h-11 rounded-2xl border border-pine/10 bg-white px-4 py-3 hover:border-pine/40">
              <span className="block font-medium text-pine" lang={lang}>
                {category.title}
              </span>
              <span className="text-xs text-muted">{category.count}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Categories() {
  const { lang } = useApp();
  const remote = useRemote<{ lang: Lang; categories: HadeethCategory[] }>(`/api/hadeeth/categories?lang=${lang}`);
  const data = remote.data && remote.data.lang === lang ? remote.data : null;
  return (
    <Card>
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      <ul className="grid gap-2 sm:grid-cols-2">
        {data?.categories.map(category => (
          <li key={category.id}>
            <a href={`#/hadith/category/${category.id}?lang=${lang}`} className="block rounded-2xl border border-pine/10 bg-white px-4 py-3 hover:border-pine/40">
              <span className="block font-medium text-pine" lang={lang}>
                {category.title}
              </span>
              <span className="text-xs text-muted">{category.count}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
