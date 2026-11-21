/**
 * Prepared-text / audio readiness gates.
 * Catalogue presence and original PDF availability are separate from reviewed
 * prepared text. Quarantined ids must not open prepared text or start generation.
 */

/** Tamil book: prepared text/audio quarantined; original PDF remains available. */
export const PREPARED_TEXT_QUARANTINE_IDS = new Set<number>([2843165]);

export function preparedTextQuarantined(id: number): boolean {
  return Number.isInteger(id) && PREPARED_TEXT_QUARANTINE_IDS.has(id);
}

export const PREPARED_TEXT_QUARANTINE_MESSAGE =
  'Prepared text and audio for this book are under review. The original PDF remains available.';
