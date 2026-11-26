import { useEffect, useState, type ReactNode } from 'react';
import { Pause, Volume2 } from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { HadithVoiceBar, type ActiveHadithSpeechPart } from '../components/HadithVoiceBar.tsx';
import { AudioLoadingSpinner, loadingAudioLabel } from '../components/AudioLoadingSpinner.tsx';
import { RecordShare } from '../components/RecordShare.tsx';
import { splitTextIntoSpeechLines, useLineByLineTts } from '../lib/lineByLineTts.ts';
import { researchStudioHref } from './hadithEncyclopediaCopy.ts';
import { EmptyState } from '../components/shell/widgets.tsx';
import { Card, ErrorNote, Loading, SectionTitle, SelectionWash } from '../components/ui.tsx';
import { useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp } from '../lib/store.tsx';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import { hadeethShareText, textBeyondIntro, type EncyclopediaHadith, type HadeethCategory, type HadeethListPage, type HadeethSearchHit } from '../shared/hadeethenc.ts';
import type {readEncyclopediaEdition} from '../server/hadeethenc.ts';
import type { Hadith } from '../shared/types.ts';
import { matchingTamilPassage, tamilMuslimReference } from '../shared/hadithReadingAlternative.ts';
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

function DetailsBlock({
  title,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-2xl border border-pine/10 bg-parchment px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-pine [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        {action && (
          <span onClick={e => e.stopPropagation()} className="shrink-0">
            {action}
          </span>
        )}
      </summary>
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

function MissingEdition({id,lang,arabic}:{id:string;lang:Lang;arabic:Extract<Awaited<ReturnType<typeof readEncyclopediaEdition>>,{kind:'original'}>['original']}) {
  const ta = lang === 'ta', si = lang === 'si';
  const ref = tamilMuslimReference(id,lang);
  const alt = useRemote<Hadith>(ref ? `/api/hadith/muslim/${ref}?lang=ta` : null);
  const passage = matchingTamilPassage(alt.data,ref);
  const alternatives=(['en','ta','si'] as const).filter(x=>x!==lang);
  const a=useRemote<EncyclopediaHadith>(`/api/hadeeth/${id}?lang=${alternatives[0]}`);
  const b=useRemote<EncyclopediaHadith>(`/api/hadeeth/${id}?lang=${alternatives[1]}`);
  return <section className="space-y-3" lang={lang} data-testid="hadith-missing-edition">
    <p>{ta ? `ஹதீஸ் எண் ${id}க்கான தமிழ் மொழிபெயர்ப்பு HadeethEnc இல் கிடைக்கவில்லை.` :
      si ? `HadeethEnc හි ${id} හදීසය සඳහා සිංහල පරිවර්තනයක් නොමැත.` :
      `HadeethEnc does not provide an English edition of hadith ${id} here.`}</p>
    {ref && <div className="space-y-2 rounded-2xl border border-pine/15 p-4" lang="ta">
      <h2 className="font-semibold">ஸஹீஹ் முஸ்லிம் · தமிழ் பதிப்பு</h2>
      {alt.loading ? <Loading/> : passage ?
        <><p className="text-sm">உமர் (ரலி) அவர்களின் வெள்ளிக்கிழமை உரையில் இடம்பெறும் தொடர்புடைய பகுதி:</p>
        <blockquote className="leading-relaxed">{passage}</blockquote>
        <a className="underline" href={`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/tam-muslim/${ref}.min.json`} target="_blank" rel="noreferrer">ஆதாரம்: தமிழ் பதிப்பு, பதிவு {ref}</a></> :
        <a className="underline" href="https://islamkalvi.com/?p=1355" target="_blank" rel="noreferrer">இதே அறிவிப்பை இஸ்லாம்கல்வியில் தமிழில் படிக்கவும்</a>}
    </div>}
    {arabic && <div className="space-y-2 rounded-2xl border border-pine/15 p-4" data-testid="hadith-original">
      <h2 className="font-semibold">{ta?'அரபு மூல உரை':si?'මුල් අරාබි පාඨය':'Original Arabic text'}</h2>
      <blockquote dir="rtl" lang="ar" className="whitespace-pre-line text-right leading-loose">{arabic.text}</blockquote>
      <a href={arabic.sourceUrl} target="_blank" rel="noreferrer" className="text-sm underline">HadeethEnc · {id}</a>
    </div>}
    <div className="flex flex-wrap gap-3">{[a.data,b.data].map((item,i)=>item?.id===id && item.lang===alternatives[i]?
      <a key={item.lang} href={`#/hadith/${id}?lang=${item.lang}`} className="rounded-xl border px-3 py-2 underline" lang={item.lang}>
        {item.lang==='en'?'Read in English':item.lang==='ta'?'தமிழில் படிக்கவும்':'සිංහලෙන් කියවන්න'}
      </a>:null)}</div>
  </section>;
}

function HadithReading({ id }: { id: string }) {
  const { t, lang } = useApp();
  const [activeSpeechPart, setActiveSpeechPart] = useState<ActiveHadithSpeechPart>(null);
  const remote = useRemote<Awaited<ReturnType<typeof readEncyclopediaEdition>>>(`/api/hadeeth/${id}/reader?lang=${lang}`);
  const result = remote.data?.id===id && remote.data.requested===lang ? remote.data : null;
  const hadith = result?.kind==='edition' ? result.record : null;

  const hadithVoiceKey = hadith ? `hadeeth-${hadith.id}-${hadith.lang}` : `hadeeth-${id}`;
  const sessionPrefix = `hadith-v4:${hadithVoiceKey}:`;
  const exSessionId = `${sessionPrefix}explanation`;
  const lsSessionId = `${sessionPrefix}lessons`;
  const lineTts = useLineByLineTts(sessionPrefix);
  const langLabel = LANGUAGE_NAMES[lang]?.native ?? 'English';

  const explanationLines = hadith?.explanation ? splitTextIntoSpeechLines(hadith.explanation) : [];
  const lessonsLines = hadith?.lessons ?? [];

  const toggleSectionTts = (targetSessionId: string, lines: string[]) => {
    if (!lines.length) return;
    if (lineTts.sessionId === targetSessionId && lineTts.status === 'playing') {
      lineTts.pause();
      return;
    }
    void lineTts.start({
      sessionId: targetSessionId,
      lines,
      lang: hadith?.lang ?? lang,
    });
  };

  return (
    <Card>
      {remote.loading && !hadith && <Loading />}
      {result?.kind==='original' && <MissingEdition key={`${id}:${lang}`} id={id} lang={lang} arabic={result.original}/>}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {hadith && (
        <article className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a href={researchStudioHref(hadith.text)} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#0E382B] px-4 text-sm font-semibold text-white">
              Explore Isnad
            </a>
            <a href={researchStudioHref(hadith.text)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0E382B]/20 px-4 text-sm font-semibold text-[#0E382B]">
              Generate Podcast Episode
            </a>
          </div>
          <h2 className="font-display text-2xl font-bold text-pine" lang={hadith.lang}>
            {hadith.title}
          </h2>
          <HadithVoiceBar
            hadithKey={hadithVoiceKey}
            arabicText={[textBeyondIntro(hadith.arabicIntro, hadith.arabic) ? hadith.arabicIntro : '', hadith.arabic].filter(Boolean).join('\n')}
            translationText={[textBeyondIntro(hadith.intro, hadith.text) ? hadith.intro : '', hadith.text].filter(Boolean).join('\n')}
            explanationText={hadith.explanation}
            lessonsList={hadith.lessons}
            lang={hadith.lang}
            variant="light"
            onActivePartChange={setActiveSpeechPart}
          />
          {hadith.arabic ? (
            <div
              lang="ar"
              dir="rtl"
              data-active-speech={activeSpeechPart === 'arabic' ? 'true' : undefined}
              className={`arabic space-y-2 rounded-2xl p-2 text-2xl leading-loose text-ink transition ${
                activeSpeechPart === 'arabic' ? 'bg-amber-50/90 ring-1 ring-amber-400' : ''
              }`}
            >
              {textBeyondIntro(hadith.arabicIntro, hadith.arabic) && <p className="whitespace-pre-wrap">{hadith.arabicIntro}</p>}
              <p className="whitespace-pre-wrap">{hadith.arabic}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">{t.arabicMissing}</p>
          )}
          <div
            lang={hadith.lang}
            data-active-speech={activeSpeechPart === 'translation' ? 'true' : undefined}
            className={`space-y-2 rounded-2xl p-2 text-lg leading-relaxed text-ink transition ${
              activeSpeechPart === 'translation' ? 'bg-emerald-50/80 ring-1 ring-emerald-500/40' : ''
            }`}
          >
            {textBeyondIntro(hadith.intro, hadith.text) && <p className="whitespace-pre-wrap">{hadith.intro}</p>}
            <p className="whitespace-pre-wrap">{hadith.text}</p>
          </div>
          <DetailsBlock
            title={t.explanation}
            defaultOpen
            action={
              explanationLines.length > 0 ? (
                <button
                  type="button"
                  data-testid="section-listen-explanation-btn"
                  onClick={() => toggleSectionTts(exSessionId, explanationLines)}
                  style={{
                    backgroundColor:
                      lineTts.isPlayingSession(exSessionId) || lineTts.isLoadingSession(exSessionId)
                        ? '#D4AF37'
                        : '#073C30',
                    color:
                      lineTts.isPlayingSession(exSessionId) || lineTts.isLoadingSession(exSessionId)
                        ? '#041B14'
                        : '#FFFFFF',
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-2xs cursor-pointer"
                >
                  {lineTts.isLoadingSession(exSessionId) ? (
                    <AudioLoadingSpinner size={13} />
                  ) : lineTts.isPlayingSession(exSessionId) ? (
                    <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span>
                    {lineTts.isLoadingSession(exSessionId)
                      ? loadingAudioLabel(lang)
                      : lineTts.isPlayingSession(exSessionId)
                        ? 'Pause'
                        : `Listen (${langLabel})`}
                  </span>
                </button>
              ) : null
            }
          >
            {explanationLines.length > 0 ? (
              <div lang={hadith.lang} className="space-y-2">
                {explanationLines.map((line, idx) => {
                  const isLineActive =
                    lineTts.sessionId === exSessionId &&
                    lineTts.status !== 'idle' &&
                    lineTts.currentSourceIndex === idx;
                  return (
                    <p
                      key={idx}
                      data-tts-line-index={idx}
                      data-tts-line-active={isLineActive ? 'true' : undefined}
                      onClick={() => {
                        void lineTts.start({
                          sessionId: exSessionId,
                          lines: explanationLines,
                          startIndex: idx,
                          lang: hadith.lang,
                        });
                      }}
                      className={`cursor-pointer rounded-xl px-3 py-1.5 transition ${
                        isLineActive
                          ? 'border-l-4 border-[#D4AF37] bg-amber-50/90 font-medium text-stone-950 shadow-2xs'
                          : 'hover:bg-white/70'
                      }`}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted">{t.explanationEmpty}</p>
            )}
            {hadith.explanationArabic && (
              <details className="mt-2 rounded-xl border border-stone-200 bg-white/80 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-emerald-900">
                  Show Arabic Commentary Reference (الشرح بالعربية)
                </summary>
                <p lang="ar" dir="rtl" className="arabic mt-2 whitespace-pre-wrap text-xl">
                  {hadith.explanationArabic}
                </p>
              </details>
            )}
          </DetailsBlock>
          <DetailsBlock
            title={t.lessons}
            defaultOpen
            action={
              lessonsLines.length > 0 ? (
                <button
                  type="button"
                  data-testid="section-listen-lessons-btn"
                  onClick={() => toggleSectionTts(lsSessionId, lessonsLines)}
                  style={{
                    backgroundColor:
                      lineTts.isPlayingSession(lsSessionId) || lineTts.isLoadingSession(lsSessionId)
                        ? '#D4AF37'
                        : '#073C30',
                    color:
                      lineTts.isPlayingSession(lsSessionId) || lineTts.isLoadingSession(lsSessionId)
                        ? '#041B14'
                        : '#FFFFFF',
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-2xs cursor-pointer"
                >
                  {lineTts.isLoadingSession(lsSessionId) ? (
                    <AudioLoadingSpinner size={13} />
                  ) : lineTts.isPlayingSession(lsSessionId) ? (
                    <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span>
                    {lineTts.isLoadingSession(lsSessionId)
                      ? loadingAudioLabel(lang)
                      : lineTts.isPlayingSession(lsSessionId)
                        ? 'Pause'
                        : `Listen (${langLabel})`}
                  </span>
                </button>
              ) : null
            }
          >
            {lessonsLines.length > 0 ? (
              <ol className="space-y-2" lang={hadith.lang}>
                {lessonsLines.map((lesson, idx) => {
                  const isLineActive =
                    lineTts.sessionId === lsSessionId &&
                    lineTts.status !== 'idle' &&
                    lineTts.currentSourceIndex === idx;
                  return (
                    <li
                      key={lesson}
                      data-tts-line-index={idx}
                      data-tts-line-active={isLineActive ? 'true' : undefined}
                      onClick={() => {
                        void lineTts.start({
                          sessionId: lsSessionId,
                          lines: lessonsLines,
                          startIndex: idx,
                          lang: hadith.lang,
                        });
                      }}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 transition ${
                        isLineActive
                          ? 'border-l-4 border-[#D4AF37] bg-amber-50/90 font-medium text-stone-950 shadow-2xs'
                          : 'bg-white/60 hover:bg-white'
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#073C30] font-mono text-[10px] font-bold text-[#F9E7B9]">
                        {idx + 1}
                      </span>
                      <span className="whitespace-pre-wrap">{lesson}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-muted">{t.lessonsEmpty}</p>
            )}
            {hadith.lessonsArabic.length > 0 && (
              <details className="mt-2 rounded-xl border border-stone-200 bg-white/80 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-emerald-900">
                  Show Arabic Lessons Reference (الفوائد بالعربية)
                </summary>
                <ul lang="ar" dir="rtl" className="arabic mt-2 list-disc space-y-2 pr-5 text-xl">
                  {hadith.lessonsArabic.map(lesson => (
                    <li key={lesson} className="whitespace-pre-wrap">
                      {lesson}
                    </li>
                  ))}
                </ul>
              </details>
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
  const rawPage = Number(new URLSearchParams(hash.split('?')[1] ?? '').get('page'));
  const page = Number.isInteger(rawPage) && rawPage>=1 && rawPage<=500 ? rawPage : 1;
  const remote = useRemote<HadeethListPage>(`/api/hadeeth/list?lang=${lang}&category=${categoryId}&page=${page}`);
  const data = remote.data && remote.data.lang === lang && remote.data.categoryId === categoryId && remote.data.page === page ? remote.data : null;
  const last = data ? Math.max(1,data.pages) : page;
  useEffect(()=>{
    if (page<=last) return;
    window.history.replaceState(null,'',`#/hadith/category/${categoryId}?lang=${lang}&page=${last}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },[categoryId,lang,page,last]);
  return (
    <Card>
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && page<=last && data.items.length === 0 && <EmptyState>{t.libraryEmpty}</EmptyState>}
      <ul className="space-y-2">
        {data?.items.map(item => (
          <li key={item.id}>
            <a href={`#/hadith/${item.id}?lang=${lang}`} className="block min-h-11 rounded-2xl border border-[#0E382B]/10 bg-[#FBF9F5] px-4 py-3 text-sm hover:border-emerald-700" lang={lang}>
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
            <a href={`#/hadith/${item.id}?lang=${lang}`} className="block rounded-2xl border border-[#0E382B]/10 bg-[#FBF9F5] px-4 py-3 text-sm hover:border-emerald-700" lang={lang}>
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
            <a href={`#/hadith/category/${category.id}?lang=${lang}`} className="relative block min-h-11 overflow-hidden rounded-2xl border border-[#0E382B]/10 bg-[#FBF9F5] px-4 py-3 pr-14 hover:border-emerald-700">
              <SelectionWash />
              <span className="relative block font-medium text-pine" lang={lang}>
                {category.title}
              </span>
              <span className="relative text-xs text-muted">{category.count}</span>
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
            <a href={`#/hadith/category/${category.id}?lang=${lang}`} className="relative block overflow-hidden rounded-2xl border border-[#0E382B]/10 bg-[#FBF9F5] px-4 py-3 pr-14 hover:border-emerald-700">
              <SelectionWash />
              <span className="relative block font-medium text-pine" lang={lang}>
                {category.title}
              </span>
              <span className="relative text-xs text-muted">{category.count}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
