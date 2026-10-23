export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/** The library shell scrolls inside `#main`, not the window. */
export function scrollMain(): void {
  document.getElementById('main')?.scrollTo({ top: 0, behavior: scrollBehavior() });
}

/** Move a verse inside the reading pane. Never scrolls the window, so the section bar stays put. */
export function scrollMarkIntoMain(mark: HTMLElement): void {
  const main = document.getElementById('main');
  if (!main) return;
  const markRect = mark.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();
  const above = markRect.top < mainRect.top + 12;
  const below = markRect.bottom > mainRect.bottom - 28;
  if (!above && !below) return;
  const delta = above ? markRect.top - mainRect.top - 12 : markRect.bottom - mainRect.bottom + 28;
  main.scrollBy({ top: delta, behavior: scrollBehavior() });
}
