import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

/** True when GEMINI_API_KEY is a real secret, not empty or the committed placeholder. */
export function hasGeminiApiKey(value: string | undefined): value is string {
  const key = value?.trim() ?? '';
  return Boolean(key) && key !== 'MY_GEMINI_API_KEY';
}

const appDir = path.resolve(import.meta.dirname, '../..');
const envFiles = [path.join(appDir, '.env'), path.join(appDir, '..', '.env')];

for (const file of envFiles) {
  dotenv.config({ path: file });
}

if (!hasGeminiApiKey(process.env.GEMINI_API_KEY)) {
  for (const file of envFiles) {
    try {
      const parsed = dotenv.parse(fs.readFileSync(file));
      if (hasGeminiApiKey(parsed.GEMINI_API_KEY)) {
        process.env.GEMINI_API_KEY = parsed.GEMINI_API_KEY.trim();
        break;
      }
    } catch {
      /* missing .env is expected in CI */
    }
  }
}
