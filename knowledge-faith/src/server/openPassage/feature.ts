/** Kill switch: set OPEN_PASSAGE_PUBLIC=0 to disable the public desk without deleting data. */
export function openPassagePublicEnabled(): boolean {
  const raw = (process.env.OPEN_PASSAGE_PUBLIC ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

export function openPassageGoogleClientId(): string {
  return (
    process.env.OPEN_PASSAGE_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
}
