export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/** The library shell scrolls inside `#main`, not the window. */
export function scrollMain(): void {
  document.getElementById('main')?.scrollTo({ top: 0, behavior: scrollBehavior() });
}

/** Space between the sticky reading controls and the first line they must not cover. */
function readingClearance(main: HTMLElement): number {
  const bar = main.querySelector('[data-reading-bar]');
  if (!bar) return 12;
  return bar.getBoundingClientRect().height + 20;
}

/** Move a verse inside the reading pane. Never scrolls the window, so the section bar stays put. */
export function scrollMarkIntoMain(mark: HTMLElement): void {
  const main = document.getElementById('main');
  if (!main) return;
  const markRect = mark.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();
  const clearance = readingClearance(main);
  const visibleTop = mainRect.top + clearance;
  const visibleBottom = mainRect.bottom - 28;
  if (markRect.top >= visibleTop && markRect.top <= visibleBottom - 48) return;
  main.scrollBy({ top: markRect.top - visibleTop, behavior: scrollBehavior() });
}
