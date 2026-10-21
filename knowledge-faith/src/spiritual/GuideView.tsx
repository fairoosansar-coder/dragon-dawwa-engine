import { useEffect, useState } from 'react';
import { VerseCard } from '../components/cards.tsx';
import { useRemote } from '../lib/api.ts';
import { useStored } from '../lib/store.tsx';
import type { Verse } from '../shared/types.ts';
import { isScholarReviewed } from './editorial.ts';
import { findGuide, guideById, text, type Guide, type GuideSection } from './content.ts';
import { slotLabel } from './i18n.ts';
import { Banner, PageBack, Panel, Prose, control, useSp } from './chrome.tsx';

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
const BEGINNER = new Set(['overview', 'meaning', 'preparation', 'sources', 'tools', 'review']);

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
  const { lang, s } = useSp();
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
    if (!anchor) return;
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
  const visible = guide.sections.filter(section => {
    if (guide.id === 'salah-learn' && beginner && !BEGINNER.has(section.id)) return false;
    if (!query.trim()) return true;
    return `${slotLabel(lang, section.id)} ${sectionBlob(section, lang)}`.toLowerCase().includes(query.trim().toLowerCase());
  });
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

  const body = (
    <article className={prefs.mode === 'book' ? (prefs.border ? 'dd-book dd-illuminated' : 'dd-book') : 'dd-plain'} style={{ ['--dd-font' as string]: `${FONTS[prefs.font] ?? 1.125}rem` }}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dd-emerald">{reviewed ? s.reviewer : s.notReviewed}</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-dd-emerald sm:text-4xl">{text(guide.title, lang) || guide.title.en}</h1>
      <Prose copy={guide.summary} />
      <p className="mt-3 text-sm text-dd-ink/70">
        {s.updated} {guide.meta.updated} · {s.author}: {guide.meta.author}
      </p>
      <Banner>
        {s.incomplete} {s.languagePending}
      </Banner>
      {guide.id === 'salah-learn' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={`min-h-11 rounded-full px-4 ${beginner ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setBeginner(true)}>
            {s.beginner}
          </button>
          <button type="button" className={`min-h-11 rounded-full px-4 ${!beginner ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setBeginner(false)}>
            {s.detailed}
          </button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
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
      </div>
      <label className="mt-4 block text-sm">
        {s.inArticle}
        <input value={query} onChange={event => setQuery(event.target.value)} className={`${control} mt-1 w-full`} />
      </label>
      <nav aria-label={s.toc} className="mt-4 flex flex-wrap gap-2">
        {visible.map(section => (
          <a key={section.id} href={`#/spiritual/${guide.path.join('/')}/${section.id}`} className="min-h-11 rounded-full bg-white px-3 py-2 text-sm text-dd-emerald">
            {slotLabel(lang, section.id)}
            {section.status === 'withheld' ? ` · ${s.withheld}` : ''}
          </a>
        ))}
      </nav>
      <div className="mt-6 space-y-8">
        {visible.map(section => (
          <section key={section.id} id={`sec-${section.id}`} className="scroll-mt-28">
            <h2 className="font-display text-2xl font-bold text-dd-emerald">{slotLabel(lang, section.id)}</h2>
            {section.status === 'withheld' ? (
              <p className="mt-2 rounded-2xl border border-dashed border-dd-lapis/40 p-4 text-sm">{s.withheldBody}</p>
            ) : (
              <SectionBody section={section} english={english} />
            )}
          </section>
        ))}
      </div>
      {guide.id === 'shahadah' && <p className="mt-6 text-sm">{s.audioMissing}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
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
        <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setEnglish(value => !value)}>
          {s.showEnglish}
        </button>
      </div>
      {guide.links.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {guide.links.map(link => (
            <li key={link.href}>
              <a href={link.href} className="inline-flex min-h-11 items-center rounded-full bg-dd-gold/20 px-4 text-sm font-medium text-dd-emerald">
                {text(link.label, lang) || link.label.en}
              </a>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-6"
        onSubmit={event => {
          event.preventDefault();
          if (!report.trim()) return;
          setReports(items => [{ guideId: guide.id, note: report.trim().slice(0, 500), at: new Date().toISOString() }, ...items].slice(0, 30));
          setReport('');
          setReported(true);
        }}
      >
        <label className="block text-sm">
          {s.report}
          <textarea value={report} onChange={event => setReport(event.target.value)} rows={3} className={`${control} mt-1 w-full`} />
        </label>
        <p className="mt-1 text-xs text-dd-ink/60">{s.reportHint}</p>
        <button type="submit" className="mt-2 min-h-11 rounded-full bg-white px-4 text-sm">
          {s.save}
        </button>
        {reported && <p className="mt-2 text-sm">{s.reportSaved}</p>}
      </form>
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

function SectionBody({ section, english }: { section: GuideSection; english: boolean }) {
  const { lang, s } = useSp();
  const refs = section.verseRefs ?? [];
  const url = refs.length ? `/api/quran/verses?refs=${encodeURIComponent(refs.join(','))}&lang=${english ? 'en' : lang}` : null;
  const remote = useRemote<Verse[]>(url);
  const show = (copy: Guide['title']) => (english && lang !== 'en' ? copy.en : text(copy, lang) || '');
  return (
    <div className="mt-3 space-y-3">
      {section.arabic && (
        <p lang="ar" className="text-3xl">
          {section.arabic}
        </p>
      )}
      {section.transliteration && (
        <p className="text-sm italic">
          <span className="not-italic font-semibold">{s.translitLabel}. </span>
          {section.transliteration}
        </p>
      )}
      {section.meanings && (
        <div>
          <h3 className="text-sm font-semibold">{s.meaningLabel}</h3>
          <p lang={english ? 'en' : lang}>{show(section.meanings) || s.missingLang}</p>
          <p className="text-xs text-dd-ink/60">{s.editionUnset}</p>
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
          {remote.loading && <p>{s.loading}</p>}
          {remote.error && (
            <p>
              {remote.error}{' '}
              <button type="button" onClick={remote.reload}>
                {s.retry}
              </button>
            </p>
          )}
          {remote.data?.map(verse => (
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
              {title} · {slotLabel(lang, item.section)}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
