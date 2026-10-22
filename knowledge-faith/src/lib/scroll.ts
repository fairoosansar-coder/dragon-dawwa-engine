export function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/** The library shell scrolls inside `#main`, not the window. */
export function scrollMain(): void {
  document.getElementById('main')?.scrollTo({ top: 0, behavior: scrollBehavior() });
}
