import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AArrowDown,
  AArrowUp,
  Bookmark,
  BookmarkCheck,
  BookOpenText,
  ChevronDown,
  Copy,
  Flag,
  Maximize2,
  Minimize2,
  Search,
  Share2,
  Volume2,
} from 'lucide-react';
import type { Lang } from '../../shared/sources.ts';
import { findGuide, findTopic, PROSE_SECTIONS, TOOL_ROUTES, type GuideSectionId } from '../../shared/spiritual/catalog.ts';
import type { PublicGuide, PublicReviewSummary } from '../../shared/spiritual/governance.ts';
import { postJson, useRemote } from '../../lib/api.ts';
import { fmt, type SpKey } from '../../lib/i18nSpiritual.ts';
import { formatIso, spHref } from '../../lib/spiritualFormat.ts';
import { useBookmarks, usePositions, useProgress, useReading, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Divider, IlluminatedFrame, SpButton, StatusBadge, inputClass } from '../../components/spiritual/ornaments.tsx';
import { Highlight, HighlightProvider, SourceList } from '../../components/spiritual/sources.tsx';
import { StudyAssistant } from '../../components/spiritual/StudyAssistant.tsx';

const SIZES = ['0.95rem', '1.05rem', '1.15rem', '1.3rem', '1.45rem'];

/** Renders reviewed plain text: blank lines separate paragraphs, "- " and "1. " start list items. No HTML is interpreted. */
function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n').map(l => l.trim());
        if (lines.every(l => /^[-•]\s+/.test(l)))
          return (
            <ul key={i} className="my-3 list-disc space-y-1 pl-6">
              {lines.map((l, k) => (
                <li key={k}>
                  <Highlight text={l.replace(/^[-•]\s+/, '')} />
                </li>
              ))}
            </ul>
          );
        if (lines.every(l => /^\d+[.)]\s+/.test(l)))
          return (
            <ol key={i} className="my-3 list-decimal space-y-1 pl-6">
              {lines.map((l, k) => (
                <li key={k}>
                  <Highlight text={l.replace(/^\d+[.)]\s+/, '')} />
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i}>
            <Highlight text={lines.join(' ')} />
          </p>
        );
      })}
    </>
  );
}

function ReviewLine({ r }: { r: PublicReviewSummary }) {
  const { s, lang } = useSp();
  return (
    <li className="text-sm">
      <span className="font-semibold text-emerald">{r.name}</span> — {s[`role_${r.role}` as SpKey]}
      {r.lang && <> ({s[`langName_${r.lang}` as SpKey]})</>}
      {r.credential && <span className="block text-xs text-ink/60">{r.credential}</span>}
      <span className="block text-xs text-ink/55">{formatIso(lang, r.date.slice(0, 10))}</span>
    </li>
  );
}

function ReportForm({ slug, sections, lang, onClose }: { slug: string; sections: GuideSectionId[]; lang: Lang; onClose: () => void }) {
  const { s } = useSp();
  const [section, setSection] = useState<string>(sections[0] ?? 'sources');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function send(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      await postJson('/api/spiritual/reports', { slug, section, lang, message: message.trim() });
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }

  if (state === 'done')
    return (
      <div role="status" className="rounded-2xl bg-emerald/5 p-4 text-sm text-emerald">
        {s.reportThanks}
        <SpButton variant="ghost" className="ml-2" onClick={onClose}>
          {s.close}
        </SpButton>
      </div>
    );
  return (
    <form onSubmit={send} className="space-y-3 rounded-2xl border border-emerald/15 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink/75">
        {s.reportSection}
        <select className={inputClass} value={section} onChange={e => setSection(e.target.value)}>
          {sections.map(sec => (
            <option key={sec} value={sec}>
              {s[`sec_${sec}` as SpKey]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink/75">
        {s.reportError}
        <textarea
          className={`${inputClass} min-h-24`}
          required
          minLength={5}
          maxLength={2000}
          value={message}
          placeholder={s.reportPlaceholder}
          onChange={e => setMessage(e.target.value)}
        />
      </label>
      {state === 'error' && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <SpButton type="submit" disabled={state === 'busy' || message.trim().length < 5}>
          {s.reportSend}
        </SpButton>
        <SpButton variant="ghost" onClick={onClose}>
          {s.cancel}
        </SpButton>
      </div>
    </form>
  );
}

function ToolbarButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${pressed ? 'bg-emerald text-ivory' : 'text-emerald hover:bg-emerald/10'}`}
    >
      {children}
    </button>
  );
}

export default function GuideReader({ slug }: { slug: string }) {
  const { s, lang: uiLang } = useSp();
  const found = findGuide(slug)!;
  const topic = findTopic(found.topic)!;
  const [chosenLang, setChosenLang] = useState<Lang | null>(null);
  const lang = chosenLang ?? uiLang;
  const guideRes = useRemote<PublicGuide>(`/api/spiritual/guides/${slug}?lang=${lang}`);
  const guide = guideRes.data;
  const [reading, setReading] = useReading();
  const [bookmarks, setBookmarks] = useBookmarks();
  const [, setProgress] = useProgress();
  const [positions, setPositions] = usePositions();
  const [query, setQuery] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [current, setCurrent] = useState(0);
  const [focus, setFocus] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const restored = useRef(false);
  const bookmarked = bookmarks.includes(slug);
  const book = reading.mode === 'book';
  const title = found.guide.title[lang];

  useEffect(() => {
    document.title = `${title} · ${s.title} · ${s.brand}`;
  }, [title, s]);

  useEffect(() => {
    setProgress(p => (p.enabled ? { ...p, opened: { ...p.opened, [slug]: new Date().toISOString() } } : p));
  }, [slug, setProgress]);

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocus(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  // Remember how far the reader got, as a fraction of the article, and return there next time.
  useEffect(() => {
    let t: number | undefined;
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const el = articleRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - window.innerHeight)));
        setPositions(p => ({ ...p, [slug]: frac.toFixed(3) }));
      }, 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(t);
    };
  }, [slug, setPositions]);

  useEffect(() => {
    if (restored.current || !guide) return;
    const frac = Number(positions[slug] ?? 0);
    restored.current = true;
    if (frac > 0.02) {
      const id = window.setTimeout(() => {
        const el = articleRef.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + frac * Math.max(0, el.offsetHeight - window.innerHeight) });
      }, 600);
      return () => window.clearTimeout(id);
    }
  }, [guide, positions, slug]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const marks = articleRef.current?.querySelectorAll('mark[data-sp-match]') ?? [];
      setMatchCount(marks.length);
      setCurrent(0);
      marks.forEach((m, i) => m.setAttribute('data-current', String(i === 0)));
      (marks[0] as HTMLElement | undefined)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
    return () => window.clearTimeout(id);
  }, [query, guide]);

  function nextMatch() {
    const marks = articleRef.current?.querySelectorAll('mark[data-sp-match]');
    if (!marks?.length) return;
    const n = (current + 1) % marks.length;
    marks.forEach((m, i) => m.setAttribute('data-current', String(i === n)));
    (marks[n] as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
    setCurrent(n);
  }

  const proseSections = useMemo(() => PROSE_SECTIONS.filter(sec => guide?.sections[sec]), [guide]);
  const toc: GuideSectionId[] = [...proseSections, 'sources', 'tools', 'review'];
  const sourceReviewed = guide?.status === 'published' && guide.reviews.source.length > 0;
  const url = `${window.location.origin}${window.location.pathname}${spHref(`guide/${slug}`)}`;
  const reference = `${title} — ${s.brand}, ${s.title}${guide?.rev ? `, ${fmt(s.revision, { n: guide.rev })}` : ''}. ${url}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(s.copied);
    } catch {
      setNotice(text);
    }
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    void copy(url);
  }

  const toolbar = (
    <div className="sp-no-print sticky top-[4.25rem] z-20 mb-4 flex flex-wrap items-center gap-1 rounded-full border border-emerald/10 bg-white/95 px-2 py-1 shadow-sm backdrop-blur">
      <div role="group" aria-label={s.readingMode} className="flex rounded-full bg-emerald/5 p-0.5">
        {(['book', 'plain'] as const).map(m => (
          <button
            key={m}
            type="button"
            aria-pressed={reading.mode === m}
            onClick={() => setReading(r => ({ ...r, mode: m }))}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${reading.mode === m ? 'bg-emerald text-ivory' : 'text-emerald'}`}
          >
            {m === 'book' ? s.modeBook : s.modePlain}
          </button>
        ))}
      </div>
      {book && (
        <ToolbarButton label={s.border} pressed={reading.border} onClick={() => setReading(r => ({ ...r, border: !r.border }))}>
          <BookOpenText className="h-4 w-4" aria-hidden />
        </ToolbarButton>
      )}
      <ToolbarButton label={s.textSmaller} onClick={() => setReading(r => ({ ...r, size: Math.max(0, r.size - 1) }))}>
        <AArrowDown className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={s.textLarger} onClick={() => setReading(r => ({ ...r, size: Math.min(SIZES.length - 1, r.size + 1) }))}>
        <AArrowUp className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={s.findInGuide} pressed={findOpen} onClick={() => setFindOpen(v => !v)}>
        <Search className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={bookmarked ? s.bookmarked : s.bookmark}
        pressed={bookmarked}
        onClick={() => setBookmarks(b => (b.includes(slug) ? b.filter(x => x !== slug) : [slug, ...b]))}
      >
        {bookmarked ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
      </ToolbarButton>
      <ToolbarButton label={s.copyRef} onClick={() => void copy(reference)}>
        <Copy className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={s.share} onClick={() => void share()}>
        <Share2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={s.reportError} pressed={reporting} onClick={() => setReporting(v => !v)}>
        <Flag className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={focus ? s.exitFocus : s.focusMode} pressed={focus} onClick={() => setFocus(v => !v)}>
        {focus ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
      </ToolbarButton>
      {notice && (
        <span role="status" className="ml-1 max-w-[16rem] truncate text-xs text-emerald">
          {notice}
        </span>
      )}
      {findOpen && (
        <div className="flex w-full items-center gap-2 px-2 pb-1 pt-1 sm:w-auto sm:pt-0">
          <label htmlFor="sp-find" className="sr-only">
            {s.findInGuide}
          </label>
          <input
            id="sp-find"
            type="search"
            autoFocus
            className={`${inputClass} h-9 sm:w-56`}
            placeholder={s.findInGuide}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), nextMatch())}
          />
          <span className="whitespace-nowrap text-xs text-ink/60" aria-live="polite">
            {query.trim().length >= 2 ? (matchCount ? `${current + 1}/${fmt(s.matches, { n: matchCount })}` : s.noMatches) : ''}
          </span>
          <SpButton variant="ghost" className="min-h-9 px-3" onClick={nextMatch} disabled={!matchCount}>
            {s.nextMatch}
          </SpButton>
        </div>
      )}
    </div>
  );

  const article = (
    <HighlightProvider query={query}>
      <article
        ref={articleRef}
        lang={lang}
        className={`${book ? 'sp-surface-book' : 'sp-surface-plain'} rounded-[1.75rem] shadow-sm ring-1 ring-emerald/10`}
        style={{ ['--sp-size' as string]: SIZES[reading.size] ?? SIZES[1] }}
      >
        <IlluminatedFrame on={book && reading.border} className="rounded-[1.75rem] px-5 py-8 sm:px-10 sm:py-12">
          <header className="mx-auto max-w-[68ch] text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gilt-deep">
              {topic.title[lang]} · {found.guide.title.en !== title ? found.guide.title.en : topic.subtitle[lang]}
            </p>
            <h1 className={`mt-3 font-display text-3xl font-bold leading-tight text-emerald sm:text-4xl`}>{title}</h1>
            <div className="mt-3 flex flex-wrap justify-center gap-2">{guide && <StatusBadge status={guide.status} scholarReviewed={guide.scholarReviewed} />}</div>
            {guide && guide.languages.length > 0 && (
              <p className="mt-2 text-xs text-ink/60">{fmt(s.availableIn, { langs: guide.languages.map(l => s[`langName_${l}` as SpKey]).join(', ') })}</p>
            )}
            {guide?.updatedAt && (
              <p className="mt-1 text-xs text-ink/55">
                {fmt(s.lastUpdated, { date: formatIso(lang, guide.updatedAt.slice(0, 10)) })} · {fmt(s.revision, { n: guide.rev ?? 1 })}
              </p>
            )}
          </header>
          {book && <Divider />}

          <div className="sp-prose mx-auto">
            {guideRes.loading && <p role="status">{s.loading}</p>}
            {guideRes.error && (
              <p role="alert" className="text-red-800">
                {guideRes.error}
              </p>
            )}
            {guide?.status === 'in-preparation' && <Callout tone="caution">{s.preparationNote}</Callout>}
            {guide?.status === 'withdrawn' && <Callout tone="caution">{s.withdrawnNote}</Callout>}
            {guide?.status === 'published' && !guide.lang && (
              <Callout tone="info">
                <p>{fmt(s.notInLang, { lang: s[`langName_${lang}` as SpKey] })}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {guide.languages.map(l => (
                    <SpButton key={l} variant="soft" onClick={() => setChosenLang(l)}>
                      {fmt(s.readIn, { lang: s[`langName_${l}` as SpKey] })}
                    </SpButton>
                  ))}
                </div>
              </Callout>
            )}
            {chosenLang && chosenLang !== uiLang && (
              <p className="mt-2 text-xs text-ink/60">
                {s.guideLanguage}: {s[`langName_${chosenLang}` as SpKey]} ·{' '}
                <button type="button" className="text-lapis underline" onClick={() => setChosenLang(null)}>
                  {s[`langName_${uiLang}` as SpKey]}
                </button>
              </p>
            )}

            {proseSections.map(sec => (
              <section key={sec} id={`sec-${sec}`} className="mt-8 scroll-mt-32">
                <h2 className="mb-3 text-2xl font-bold text-emerald">{s[`sec_${sec}` as SpKey]}</h2>
                <Prose text={guide!.sections[sec]!} />
              </section>
            ))}

            <section id="sec-sources" className="mt-8 scroll-mt-32">
              <h2 className="mb-3 text-2xl font-bold text-emerald">{s.sec_sources}</h2>
              {!sourceReviewed && <p className="mb-3 text-sm text-ink/65">{s.selectionPending}</p>}
              {found.guide.sources.length ? (
                <div className="font-sans text-[0.95rem]">
                  <SourceList refs={found.guide.sources} />
                </div>
              ) : (
                <p className="text-sm text-ink/60">{s.none}</p>
              )}
            </section>

            <section id="sec-tools" className="mt-8 scroll-mt-32">
              <h2 className="mb-3 text-2xl font-bold text-emerald">{s.sec_tools}</h2>
              {topic.tools.length ? (
                <ul className="flex flex-wrap gap-2 font-sans">
                  {topic.tools.map(tool => (
                    <li key={tool}>
                      <a href={spHref(TOOL_ROUTES[tool])} className="inline-block rounded-full bg-emerald/5 px-4 py-2 text-sm font-medium text-emerald ring-1 ring-emerald/15 hover:bg-emerald/10">
                        {s[`tool_${tool}` as SpKey]}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink/60">{s.toolsNone}</p>
              )}
            </section>

            <section id="sec-review" className="mt-8 scroll-mt-32 font-sans">
              <h2 className="mb-3 font-display text-2xl font-bold text-emerald">{s.sec_review}</h2>
              {guide?.status === 'published' ? (
                <div className="space-y-3 text-sm">
                  {guide.author && <p>{fmt(s.writtenBy, { name: guide.author })}</p>}
                  {(['source', 'religious', 'language'] as const).map(kind =>
                    guide.reviews[kind].length ? (
                      <div key={kind}>
                        <p className="font-semibold text-ink/75">{s[`review_${kind}` as SpKey]}</p>
                        <ul className="mt-1 space-y-2">
                          {guide.reviews[kind].map(r => (
                            <ReviewLine key={`${r.name}-${r.date}-${r.lang ?? ''}`} r={r} />
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                  {guide.translationEdition && <p>{fmt(s.translationEdition, { name: guide.translationEdition })}</p>}
                  {guide.interpretiveTradition && <p>{fmt(s.tradition, { text: guide.interpretiveTradition })}</p>}
                  {guide.changeNote && <p>{fmt(s.changeNote, { text: guide.changeNote })}</p>}
                </div>
              ) : (
                <p className="text-sm text-ink/65">{s.notReviewedYet}</p>
              )}
              <div className="mt-6 flex items-start gap-2 rounded-2xl bg-white/60 p-3 text-sm text-ink/70">
                <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-gilt-deep" aria-hidden />
                <span>
                  <span className="font-semibold text-ink/80">{s.audioTitle}. </span>
                  {s.narrationNone}
                </span>
              </div>
            </section>
          </div>
        </IlluminatedFrame>
      </article>
    </HighlightProvider>
  );

  const tocNav = (
    <nav aria-label={s.contents}>
      <ol className="space-y-1 text-sm">
        {toc.map(sec => (
          <li key={sec}>
            <a href={`#sec-${sec}`} onClick={e => (e.preventDefault(), document.getElementById(`sec-${sec}`)?.scrollIntoView({ behavior: 'smooth' }))} className="block rounded-lg px-2 py-1 text-emerald hover:bg-emerald/5">
              {s[`sec_${sec}` as SpKey]}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );

  if (focus) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-vellum px-3 py-4 sm:px-6" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mx-auto max-w-4xl">
          {toolbar}
          {article}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref(topic.id), label: topic.title[uiLang] }, { label: title }]} />
      {toolbar}
      {reporting && (
        <div className="sp-no-print mb-4">
          <ReportForm slug={slug} sections={toc} lang={lang} onClose={() => setReporting(false)} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <aside className="sp-no-print lg:sticky lg:top-32 lg:self-start">
          <details className="rounded-2xl border border-emerald/10 bg-white p-3 lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-emerald">
              {s.contents} <ChevronDown className="h-4 w-4" aria-hidden />
            </summary>
            <div className="mt-2">{tocNav}</div>
          </details>
          <div className="hidden rounded-2xl border border-emerald/10 bg-white p-3 lg:block">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gilt-deep">{s.contents}</p>
            {tocNav}
          </div>
        </aside>
        <div className="min-w-0 space-y-6">
          {article}
          <StudyAssistant topic={topic.id} guide={slug} />
        </div>
      </div>
    </div>
  );
}
