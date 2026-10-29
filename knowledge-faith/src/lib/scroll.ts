export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/** The library shell scrolls inside `#main`, not the window. The mushaf scrolls inside the reader column. */
export function scrollMain(): void {
  const behavior = scrollBehavior();
  document.getElementById('main')?.scrollTo({ top: 0, behavior });
  document.querySelector('[data-reader-scroll]')?.scrollTo({ top: 0, behavior });
}

/** Space between the sticky reading controls and the first line they must not cover. */
function readingClearance(main: HTMLElement): number {
  const bar = main.querySelector('[data-reading-bar]');
  if (!bar) return 12;
  return bar.getBoundingClientRect().height + 20;
}

/** Move a verse inside the reading pane. Never scrolls the window, so the section bar stays put. */
export function scrollMarkIntoMain(mark: HTMLElement): void {
  const pane = mark.closest('[data-reader-scroll]');
  const scroller = pane instanceof HTMLElement ? pane : document.getElementById('main');
  if (!scroller) return;
  const markRect = mark.getBoundingClientRect();
  const paneRect = scroller.getBoundingClientRect();
  const inner = scroller.hasAttribute('data-reader-scroll');
  const clearance = inner ? 16 : readingClearance(scroller);
  const visibleTop = paneRect.top + clearance;
  const visibleBottom = paneRect.bottom - (inner ? 16 : 28);
  if (markRect.top >= visibleTop && markRect.top <= visibleBottom - 48) return;
  scroller.scrollBy({ top: markRect.top - visibleTop, behavior: scrollBehavior() });
}
