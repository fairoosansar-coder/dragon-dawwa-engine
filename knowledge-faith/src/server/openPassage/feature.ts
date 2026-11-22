import { getGoogleAuthConfig } from '../seekerAuth.ts';

/** Kill switch: set OPEN_PASSAGE_PUBLIC=0 to disable the public desk without deleting data. */
export function openPassagePublicEnabled(): boolean {
  const raw = (process.env.OPEN_PASSAGE_PUBLIC ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
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
