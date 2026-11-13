import fs from 'node:fs';
import path from 'node:path';

/** This Mac's external disk. Railway's container disk is a different path and is wiped on deploy. */
export const MAC_PERSIST_DIR = '/Volumes/50/Dragon Dawwa/persistent/dragon-dawwa';

/**
 * Point the process at the external disk when this machine has it.
 * Called from the server entry, not from unit tests, so tests keep using a temporary directory.
 */
export function applyPersistDir(): string {
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  if (!process.env.DD_PERSIST_DIR && !onRailway && fs.existsSync('/Volumes/50/Dragon Dawwa')) {
    fs.mkdirSync(MAC_PERSIST_DIR, { recursive: true });
    process.env.DD_PERSIST_DIR = MAC_PERSIST_DIR;
  }
  return persistRoot();
}

/** Saved research, reports, audio, and the imported source collection. */
export function persistRoot(): string {
  if (process.env.DD_PERSIST_DIR) return path.resolve(process.env.DD_PERSIST_DIR);
  if (process.env.KF_DATA_DIR) return path.resolve(process.env.KF_DATA_DIR);
  return path.resolve(process.cwd(), '.data');
}
