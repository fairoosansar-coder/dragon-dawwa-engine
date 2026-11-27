import { getGoogleAuthConfig } from '../seekerAuth.ts';

/** Opt-in only: unset/empty/falsey keeps the public research API off (production-safe default). */
export function isOpenPassageFlagEnabled(raw: unknown): boolean {
  const value = String(raw ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}

/** Public research API: set OPEN_PASSAGE_PUBLIC=1 (or true/on/yes) to enable. Default off. */
export function openPassagePublicEnabled(): boolean {
  return isOpenPassageFlagEnabled(process.env.OPEN_PASSAGE_PUBLIC);
}

/**
 * Prefer an Open Passage–specific client ID when set; otherwise reuse the same
 * Google OIDC stack as seekerAuth (`GOOGLE_CLIENT_ID` / `GOOGLE_OIDC_CLIENT_ID` / Vite).
 */
export function openPassageGoogleClientId(): string {
  const override = (process.env.OPEN_PASSAGE_GOOGLE_CLIENT_ID || '').trim();
  if (override) return override;
  return (getGoogleAuthConfig().clientId || '').trim();
}
