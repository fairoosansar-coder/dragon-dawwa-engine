import { useEffect, useState } from 'react';
import { VerseCard } from '../components/cards.tsx';
import { PronunciationControl, PronunciationStatus } from '../components/shell/widgets.tsx';
import { useRemote } from '../lib/api.ts';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { usePronunciation, withPronunciation } from '../lib/pronunciation.ts';
import { shownVerses, translationRequest } from '../shared/quranenc.ts';
import { useStored } from '../lib/store.tsx';
import type { Verse } from '../shared/types.ts';
import { isScholarReviewed } from './editorial.ts';
import { findGuide, guideById, readingSections, text, type Copy, type Guide, type GuideSection } from './content.ts';
import { SP, slotLabel } from './i18n.ts';
import { PageBack, Panel, Prose, control, useSp } from './chrome.tsx';

interface ReadingPrefs {
  mode: 'book' | 'plain';
  font: number;
  border: boolean;
}

interface Mark {
  guideId: string;
  section: string;
}

const FONTS = [1, 1.125, 1.3, 1.5];
const BEGINNER = new Set(['overview', 'meaning', 'preparation', 'sources', 'tools']);

function sectionBlob(section: GuideSection, lang: 'en' | 'ta' | 'si'): string {
  return [
    ...(section.paragraphs ?? []).map(item => text(item, lang)),
    ...(section.steps ?? []).map(item => text(item, lang)),
    ...(section.terms ?? []).map(item => text(item.name, lang)),
    section.arabic ?? '',
    section.transliteration ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

export function GuideView({ segments, anchor }: { segments: string[]; anchor?: string }) {
  const { lang, s, t } = useSp();
  const [pronunciation] = usePronunciation();
  const guide = findGuide(segments);
  const [prefs, setPrefs] = useStored<ReadingPrefs>('kf-reading', { mode: 'book', font: 1, border: false });
  const [focus, setFocus] = useState(false);
  const [query, setQuery] = useState('');
  const [english, setEnglish] = useState(false);
  const [beginner, setBeginner] = useState(true);
  const [bookmarks, setBookmarks] = useStored<Mark[]>('kf-spiritual-bookmarks', []);
  const [progress, setProgress] = useStored<Mark[]>('kf-spiritual-progress', []);
  const [report, setReport] = useState('');
  const [reports, setReports] = useStored<{ guideId: string; note: string; at: string }[]>('kf-spiritual-reports', []);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (anchor !== 'review') return;
    const panel = document.getElementById('about-page');
    if (panel instanceof HTMLDetailsElement) panel.open = true;
    panel?.scrollIntoView({ block: 'start' });
  }, [anchor, lang]);

  useEffect(() => {
    if (!anchor || anchor === 'review') return;
    document.getElementById(`sec-${anchor}`)?.scrollIntoView({ block: 'start' });
  }, [anchor, lang]);

  if (!guide) {
    return (
      <Panel>
        <PageBack segments={segments} />
        <p className="mt-4">{s.searchEmpty}</p>
      </Panel>
    );
  }

  const reviewed = isScholarReviewed(guide.meta);
  const withheld = guide.sections.some(section => section.status === 'withheld');
  const review = guide.sections.find(section => section.id === 'review' && section.status === 'published');
  const published = readingSections(guide.sections);
  const hasDetailed = guide.id === 'salah-learn' && published.some(section => !BEGINNER.has(section.id));
  const needle = query.trim().toLowerCase();
  const visible = published.filter(section => {
    if (hasDetailed && beginner && !BEGINNER.has(section.id)) return false;
    if (!needle) return true;
    return `${slotLabel('en', section.id)} ${sectionBlob(section, lang)}`.toLowerCase().includes(needle);
  });
  const testimony = guide.id === 'shahadah' ? visible.find(section => section.id === 'meaning') : undefined;
  const flow = testimony ? visible.filter(section => section.id !== 'meaning') : visible;
  const saved = bookmarks.some(item => item.guideId === guide.id);

  const copyRef = async () => {
    const body = `${text(guide.title, lang) || guide.title.en}\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const showCopy = (copy: Copy) => (english && lang !== 'en' ? copy.en : text(copy, lang) || '');
  const body = (
    <article className={prefs.mode === 'book' ? (prefs.border ? 'dd-book dd-illuminated' : 'dd-book') : 'dd-plain'} style={{ ['--dd-font' as string]: `${FONTS[prefs.font] ?? 1.125}rem` }}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dd-emerald">{reviewed ? s.reviewer : s.notReviewed}</p>
      <h1 className="mt-4 font-display text-4xl font-bold text-dd-emerald sm:text-5xl">{text(guide.title, lang) || guide.title.en}</h1>
      {guide.id === 'shahadah' ? (
        <p lang={lang} className="mt-4 max-w-xl text-lg leading-relaxed">{SP[lang].shahadahLede}</p>
      ) : (
        <div className="mt-4 max-w-xl">
          <Prose copy={guide.summary} />
        </div>
      )}
      {testimony && <Testimony section={testimony} english={english} show={showCopy} pronunciation={pronunciation} />}
      {guide.id === 'shahadah' && (
        <p className="mt-10">
          <a href="#/spiritual/names" className="text-sm font-medium text-dd-emerald underline decoration-dd-gold underline-offset-4">
            {t.namesLink} →
          </a>
        </p>
      )}
      <details className="mt-12">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border border-dd-emerald/20 bg-white px-4 text-sm font-semibold text-dd-emerald [&::-webkit-details-marker]:hidden">
          {s.contents}
        </summary>
        <nav aria-label={s.toc} className="mt-3 flex flex-col rounded-2xl border border-dd-emerald/10 bg-white p-2">
          {visible.map(section => (
            <a key={section.id} href={`#/spiritual/${guide.path.join('/')}/${section.id}`} className="rounded-xl px-3 py-2 text-sm text-dd-emerald hover:bg-dd-gold/15">
              {slotLabel('en', section.id)}
            </a>
          ))}
          {guide.links.length > 0 && <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-dd-ink/50">{s.related}</p>}
          {guide.links.map(link => (
            <a key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm text-dd-emerald hover:bg-dd-gold/15">
              {text(link.label, 'en') || link.label.en}
            </a>
          ))}
        </nav>
      </details>
      <details className="mt-4 rounded-2xl border border-dd-emerald/15 bg-white/70 px-4 py-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-dd-emerald [&::-webkit-details-marker]:hidden">
          {t.readingSettings}
        </summary>
        <div className="mt-4 space-y-4">
          <PronunciationControl />
          <div className="flex flex-wrap gap-2">
            {(['book', 'plain'] as const).map(mode => (
              <button key={mode} type="button" className={`min-h-11 rounded-full px-4 ${prefs.mode === mode ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setPrefs({ ...prefs, mode })}>
                {s[mode]}
              </button>
            ))}
            <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setPrefs({ ...prefs, font: (prefs.font + 1) % FONTS.length })} aria-label={s.font}>
              {s.font}
            </button>
            {prefs.mode === 'book' && (
              <button type="button" className="min-h-11 rounded-full bg-white px-4" aria-pressed={prefs.border} onClick={() => setPrefs({ ...prefs, border: !prefs.border })}>
                {s.illuminated}
              </button>
            )}
            <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setFocus(true)}>
              {s.focus}
            </button>
            <button type="button" className="min-h-11 rounded-full bg-white px-4" aria-pressed={english} onClick={() => setEnglish(value => !value)}>
              {s.showEnglish}
            </button>
          </div>
          <label className="block">
            {s.inArticle}
            <input value={query} onChange={event => setQuery(event.target.value)} className={`${control} mt-1 w-full`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory"
              onClick={() => setBookmarks(items => (saved ? items.filter(item => item.guideId !== guide.id) : [{ guideId: guide.id, section: anchor || 'overview' }, ...items]))}
            >
              {saved ? s.bookmarked : s.bookmark}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full bg-white px-4"
              onClick={() => setProgress(items => (items.some(item => item.guideId === guide.id) ? items : [{ guideId: guide.id, section: anchor || 'overview' }, ...items]))}
            >
              {progress.some(item => item.guideId === guide.id) ? s.markedRead : s.markRead}
            </button>
            <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => void copyRef()}>
              {copied ? s.copied : s.copyRef}
            </button>
          </div>
          <form
            onSubmit={event => {
              event.preventDefault();
              if (!report.trim()) return;
              setReports(items => [{ guideId: guide.id, note: report.trim().slice(0, 500), at: new Date().toISOString() }, ...items].slice(0, 30));
              setReport('');
              setReported(true);
            }}
          >
            <label className="block">
              {s.report}
              <textarea value={report} onChange={event => setReport(event.target.value)} rows={3} className={`${control} mt-1 w-full`} />
            </label>
            <p className="mt-1 text-xs text-dd-ink/60">{s.reportHint}</p>
            <button type="submit" className="mt-2 min-h-11 rounded-full bg-white px-4">
              {s.save}
            </button>
            {reported && <p className="mt-2">{s.reportSaved}</p>}
          </form>
        </div>
      </details>
      <div className="mt-3">
        <PronunciationStatus pronunciation={pronunciation} />
      </div>
      {hasDetailed && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className={`min-h-11 rounded-full px-4 ${beginner ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setBeginner(true)}>
            {s.beginner}
          </button>
          <button type="button" className={`min-h-11 rounded-full px-4 ${!beginner ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setBeginner(false)}>
            {s.detailed}
          </button>
        </div>
      )}
      <div className="mt-12 space-y-14">
        {flow.length === 0 && needle && <p>{s.searchEmpty}</p>}
        {flow.map(section => (
          <section key={section.id} id={section.id === testimony?.id ? undefined : `sec-${section.id}`} className="scroll-mt-28">
            <h2 className="font-display text-2xl font-bold text-dd-emerald">{slotLabel('en', section.id)}</h2>
            <SectionBody section={section} english={english} />
          </section>
        ))}
      </div>
      <details id="about-page" className="mt-16 rounded-2xl border border-dd-emerald/15 bg-white/70 px-4 py-3">
        <summary id="sec-review" className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-dd-emerald [&::-webkit-details-marker]:hidden">
          {s.aboutPage}
        </summary>
        <div className="mt-4 space-y-4 text-sm leading-relaxed">
          {guide.id === 'shahadah' && <Prose copy={guide.summary} />}
          <p>
            {s.updated} {guide.meta.updated} · {s.author}: {guide.meta.author}
          </p>
          {guide.meta.languageReview === 'pending' && <p>{s.languagePending}</p>}
          <p>{s.editionUnset}</p>
          <p>{s.audioMissing}</p>
          {withheld && <p>{s.incomplete}</p>}
          {testimony?.paragraphs?.map((copy, index) => (
            <p key={`meaning-${index}`}>{showCopy(copy) || s.missingLang}</p>
          ))}
          {review?.paragraphs?.map((copy, index) => (
            <p key={index}>{showCopy(copy) || s.missingLang}</p>
          ))}
        </div>
      </details>
    </article>
  );

  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      {focus ? (
        <div className="fixed inset-0 z-40 overflow-auto bg-dd-ivory p-4 sm:p-8">
          <button type="button" className="mb-4 min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" onClick={() => setFocus(false)}>
            {s.exitFocus}
          </button>
          {body}
        </div>
      ) : (
        body
      )}
    </div>
  );
}

function Testimony({
  section,
  english,
  show,
  pronunciation,
}: {
  section: GuideSection;
  english: boolean;
  show: (copy: Copy) => string;
  pronunciation: ReturnType<typeof usePronunciation>[0];
}) {
  const { lang, s } = useSp();
  return (
    <div id="sec-meaning" className="scroll-mt-28">
      <div className="mt-14 space-y-14 sm:mt-20 sm:space-y-20">
        {section.arabic && (
          <p lang="ar" className="text-center text-4xl leading-[2.6] text-dd-ink sm:text-5xl">
            {section.arabic}
          </p>
        )}
        {pronunciation === 'en' && section.transliteration && (
          <p lang="en" className="mx-auto max-w-xl text-center text-lg leading-relaxed">
            <span className="mb-4 block text-xs font-semibold uppercase tracking-[0.18em] text-dd-ink/60">{s.translitLabel}</span>
            {section.transliteration}
          </p>
        )}
        {section.meanings && (
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-dd-ink/60">{s.meaningLabel}</h2>
            <p lang={english && lang !== 'en' ? 'en' : lang} className="mt-6 text-xl leading-relaxed">
              {show(section.meanings) || s.missingLang}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBody({ section, english }: { section: GuideSection; english: boolean }) {
  const { lang, s } = useSp();
  const [pronunciation] = usePronunciation();
  const refs = section.verseRefs ?? [];
  const requestLang = english ? 'en' : lang;
  const quranEdition = useQuranEdition();
  const request = translationRequest(
    refs.length ? `/api/quran/verses?refs=${encodeURIComponent(refs.join(','))}&lang=${requestLang}` : null,
    requestLang,
    lang,
    quranEdition.edition,
    quranEdition.loading,
  );
  const url = request ? withPronunciation(request.url, pronunciation) : null;
  const remote = useRemote<Verse[]>(url);
  const verses = remote.loading || (requestLang === lang && quranEdition.loading) ? null : shownVerses(remote.data, requestLang, request?.editionKey ?? null);
  const show = (copy: Guide['title']) => (english && lang !== 'en' ? copy.en : text(copy, lang) || '');
  return (
    <div className="mt-3 space-y-3">
      {section.arabic && (
        <p lang="ar" className="text-3xl">
          {section.arabic}
        </p>
      )}
      {pronunciation === 'en' && section.transliteration && (
        <p lang="en" className="text-sm italic">
          <span className="not-italic font-semibold">{s.translitLabel}. </span>
          {section.transliteration}
        </p>
      )}
      {section.meanings && (
        <div>
          <h3 className="text-sm font-semibold">{s.meaningLabel}</h3>
          <p lang={english ? 'en' : lang}>{show(section.meanings) || s.missingLang}</p>
        </div>
      )}
      {section.paragraphs?.map((copy, index) => (
        <p key={index} lang={english && lang !== 'en' ? 'en' : lang}>
          {show(copy) || s.missingLang}
        </p>
      ))}
      {section.steps && (
        <ol className="list-decimal space-y-2 pl-5">
          {section.steps.map((copy, index) => (
            <li key={index}>{show(copy) || s.missingLang}</li>
          ))}
        </ol>
      )}
      {section.terms && (
        <ul className="space-y-2">
          {section.terms.map(term => (
            <li key={term.arabic}>
              <span lang="ar" className="text-xl">
                {term.arabic}
              </span>{' '}
              <span>{show(term.name) || s.missingLang}</span>
            </li>
          ))}
        </ul>
      )}
      {refs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">{s.sources}</h3>
          <p className="text-xs text-dd-ink/60">{s.audioNotSpoken}</p>
          {(remote.loading || (quranEdition.loading && requestLang === lang)) && <p>{s.loading}</p>}
          {requestLang === lang && quranEdition.error && <p>{quranEdition.error}</p>}
          {remote.error && (
            <p>
              {remote.error}{' '}
              <button type="button" onClick={remote.reload}>
                {s.retry}
              </button>
            </p>
          )}
          {verses?.map(verse => (
            <VerseCard key={verse.key} verse={verse} />
          ))}
        </div>
      )}
    </div>
  );
}

export function useGuideProgress() {
  return useStored<Mark[]>('kf-spiritual-progress', []);
}

export function useBookmarks() {
  return useStored<Mark[]>('kf-spiritual-bookmarks', []);
}

export function BookmarkList() {
  const { lang, s } = useSp();
  const [bookmarks] = useBookmarks();
  if (!bookmarks.length) return <p>{s.savedEmpty}</p>;
  return (
    <ul className="space-y-2">
      {bookmarks.map(item => {
        const guide = guideById(item.guideId);
        const href = guide ? `#/spiritual/${guide.path.join('/')}` : '#/spiritual';
        const title = guide ? text(guide.title, lang) || guide.title.en : item.guideId;
        return (
          <li key={`${item.guideId}-${item.section}`}>
            <a className="font-medium text-dd-emerald underline" href={href}>
              {title} · {slotLabel('en', item.section)}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
