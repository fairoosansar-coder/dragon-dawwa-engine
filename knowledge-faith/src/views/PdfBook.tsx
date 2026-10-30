import { useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { facingPages, spreadOrigin, stepPage } from '../shared/bookSpread.ts';

GlobalWorkerOptions.workerSrc = workerSrc;

const PLACE_KEY = 'kf-book-page';
const SPREAD_AT = 720;

interface PageBox {
  number: number;
  width: number;
  height: number;
}

function storedPage(id: number): number {
  try {
    const raw = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null') as { id?: unknown; page?: unknown } | null;
    if (raw && raw.id === id && typeof raw.page === 'number' && Number.isInteger(raw.page) && raw.page > 0) return raw.page;
  } catch {
    /* ignore an unreadable place */
  }
  return 1;
}

function rememberPage(id: number, page: number) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify({ id, page }));
  } catch {
    /* keep the page in memory */
  }
}

function cancelledRender(err: unknown): boolean {
  return err instanceof Error && err.name === 'RenderingCancelledException';
}

function fitScale(bases: PageBox[], blank: boolean, stage: { w: number; h: number }, fit: 'page' | 'width'): number {
  if (!bases.length || stage.w < 48) return 0;
  const slots = bases.length + (blank ? 1 : 0);
  const gap = slots > 1 ? 16 : 0;
  const maxW = Math.max(...bases.map(box => box.width));
  const maxH = Math.max(...bases.map(box => box.height));
  const widthScale = (stage.w - gap) / slots / maxW;
  const chosen = fit === 'width' || stage.h < 48 ? widthScale : Math.min(widthScale, (stage.h - 28) / maxH);
  if (!Number.isFinite(chosen) || chosen <= 0) return 0;
  return Math.min(chosen, 2.6);
}

export function PdfBook({
  itemId,
  url,
  layout,
  fit,
}: {
  itemId: number;
  url: string;
  layout: 'single' | 'spread';
  fit: 'page' | 'width';
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(() => storedPage(itemId));
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [bases, setBases] = useState<PageBox[]>([]);
  const [draft, setDraft] = useState('1');

  useEffect(() => {
    setPage(storedPage(itemId));
    setDoc(null);
    setNumPages(0);
    setError(null);
    setBases([]);
  }, [itemId, url]);

  useEffect(() => {
    let active = true;
    const task = getDocument({
      url,
      disableAutoFetch: true,
      disableStream: true,
      rangeChunkSize: 131072,
      useSystemFonts: true,
    });
    task.promise.then(
      loaded => {
        if (!active) {
          void task.destroy();
          return;
        }
        setDoc(loaded);
        setNumPages(loaded.numPages);
      },
      () => {
        if (active) setError('The publication file could not be opened in this page.');
      },
    );
    return () => {
      active = false;
      void task.destroy();
    };
  }, [url, attempt]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setStage({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fit, error, numPages]);

  const spread = layout === 'spread' && stage.w >= SPREAD_AT;
  const leaf = facingPages(page, numPages || 1, spread && numPages > 1);
  const origin = leaf.pages[0] ?? 1;

  useEffect(() => {
    if (!numPages) return;
    const next = spreadOrigin(page, numPages, spread);
    if (next !== page) setPage(next);
  }, [numPages, page, spread]);

  useEffect(() => {
    if (!numPages) return;
    rememberPage(itemId, origin);
    setDraft(String(origin));
  }, [itemId, numPages, origin]);

  useEffect(() => {
    if (!doc || !numPages) return;
    let active = true;
    void (async () => {
      const views: PageBox[] = [];
      for (const number of leaf.pages) {
        const pdfPage = await doc.getPage(number);
        if (!active) return;
        const viewport = pdfPage.getViewport({ scale: 1 });
        views.push({ number, width: viewport.width, height: viewport.height });
      }
      if (active) setBases(views);
    })();
    return () => {
      active = false;
    };
  }, [doc, numPages, leaf.pages.join(',')]);

  const basesMatch = bases.length === leaf.pages.length && bases.every((box, index) => box.number === leaf.pages[index]);
  const scale = useMemo(
    () => fitScale(basesMatch ? bases : [], leaf.blank === 'right', stage, fit),
    [bases, basesMatch, leaf.blank, stage, fit],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (!numPages) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        turn(1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        turn(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function turn(directionStep: 1 | -1) {
    if (!numPages) return;
    const next = stepPage(page, numPages, spread, directionStep);
    if (next === origin) return;
    direction.current = directionStep;
    setPage(next);
  }

  function commitDraft() {
    const next = Number(draft);
    if (!Number.isInteger(next)) {
      setDraft(String(origin));
      return;
    }
    direction.current = next >= origin ? 1 : -1;
    setPage(spreadOrigin(next, numPages, spread));
  }

  const end = leaf.pages[leaf.pages.length - 1] ?? origin;
  const atStart = origin <= 1;
  const atEnd = end >= numPages;
  const rangeLabel = leaf.pages.length > 1 ? `Pages ${leaf.pages[0]} and ${leaf.pages[1]} of ${numPages}` : `Page ${origin} of ${numPages}`;

  return (
    <div data-book-reader="pdf">
      {error && (
        <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>{error}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => { setError(null); setAttempt(value => value + 1); }} className="min-h-10 rounded-full bg-mint px-4 text-sm font-medium text-pine">
              Try again
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-sm font-medium text-pine underline">
              Download the publication
            </a>
          </div>
        </div>
      )}
      {!error && !numPages && <p role="status" className="py-6 text-sm text-ink/70">Opening the publication</p>}
      {!error && numPages > 0 && (
        <>
          <div className="rounded-[1.75rem] bg-[#10281f] px-2 py-4 shadow-[inset_0_0_0_1px_rgba(201,161,78,0.45)] sm:px-6 sm:py-7">
            <div
              ref={stageRef}
              className={fit === 'page' ? 'flex h-[min(46dvh,calc(100dvh-22rem))] items-center justify-center sm:h-[min(58dvh,740px)]' : 'flex min-h-48 items-start justify-center'}
            >
              {doc && scale > 0 && basesMatch && (
                <div
                  key={leaf.pages.join('-')}
                  className="book-leaf flex items-stretch justify-center"
                  style={{ ['--book-shift' as string]: direction.current > 0 ? '18px' : '-18px' }}
                >
                  {bases.map((box, index) => (
                    <div key={box.number} className="flex items-stretch">
                      {index > 0 && <div className="w-3 shrink-0 bg-gradient-to-r from-black/40 via-[#0c241c] to-black/25" aria-hidden />}
                      <figure className="flex flex-col items-center">
                        <BookSheet doc={doc} pageNumber={box.number} scale={scale} width={box.width * scale} height={box.height * scale} />
                        <figcaption className="mt-2 text-[11px] tabular-nums tracking-wide text-sand/70">{box.number}</figcaption>
                      </figure>
                    </div>
                  ))}
                  {leaf.blank === 'right' && bases[0] && (
                    <div className="flex items-stretch">
                      <div className="w-3 shrink-0 bg-gradient-to-r from-black/40 via-[#0c241c] to-black/25" aria-hidden />
                      <div
                        className="rounded-sm bg-[#f4ecdc] shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                        style={{ width: bases[0].width * scale, height: bases[0].height * scale }}
                        aria-hidden
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div data-book-controls className="mt-3 rounded-2xl border border-pine/10 bg-sand px-2 py-2">
            <input
              type="range"
              min={1}
              max={numPages}
              value={origin}
              aria-label="Page"
              aria-valuemin={1}
              aria-valuemax={numPages}
              aria-valuenow={origin}
              aria-valuetext={rangeLabel}
              onChange={event => {
                const next = spreadOrigin(Number(event.target.value), numPages, spread);
                direction.current = next >= origin ? 1 : -1;
                setPage(next);
              }}
              className="w-full accent-pine"
            />
            <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button type="button" disabled={atStart} onClick={() => turn(-1)} className="min-h-11 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine disabled:opacity-40">
                Previous
              </button>
              <label className="flex items-center justify-center gap-1 text-sm tabular-nums text-ink/80">
                <span className="sr-only">Page number</span>
                <input
                  value={draft}
                  inputMode="numeric"
                  aria-label="Page number"
                  onChange={event => setDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  onBlur={commitDraft}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitDraft();
                    }
                  }}
                  className="w-12 rounded-lg border border-pine/20 bg-white px-1 py-1 text-center"
                />
                {leaf.pages.length > 1 && <span className="text-muted">– {leaf.pages[1]}</span>}
                <span className="text-muted">/ {numPages}</span>
              </label>
              <button type="button" disabled={atEnd} onClick={() => turn(1)} className="min-h-11 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BookSheet({
  doc,
  pageNumber,
  scale,
  width,
  height,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scale <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    setFailed(false);
    void (async () => {
      try {
        const pdfPage = await doc.getPage(pageNumber);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pdfPage.getViewport({ scale: scale * dpr });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        task = pdfPage.render({ canvas, viewport });
        await task.promise;
      } catch (err) {
        if (cancelled || cancelledRender(err)) return;
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, scale]);

  return (
    <div className="relative overflow-hidden rounded-sm bg-[#fffdf8] shadow-[0_16px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/20" style={{ width, height }}>
      <span className="absolute inset-x-0 top-0 z-10 h-0.5 bg-gold" aria-hidden />
      <canvas ref={canvasRef} className="block h-full w-full" aria-label={`Page ${pageNumber}`} />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center bg-[#fffdf8] px-4 text-center text-sm text-ink/70">
          This page could not be drawn.
        </p>
      )}
    </div>
  );
}
