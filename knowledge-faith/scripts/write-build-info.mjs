import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function commitSha() {
  const fromEnv = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  if (/^[0-9a-f]{7,40}$/i.test(fromEnv)) return fromEnv.toLowerCase();
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
    if (/^[0-9a-f]{7,40}$/i.test(sha)) return sha.toLowerCase();
  } catch {
    // Railway's build checkout may not include a usable git directory.
  }
  return 'unknown';
}

const info = {
  sha: commitSha(),
  builtAt: new Date().toISOString(),
};

writeFileSync(join(root, 'build-info.json'), `${JSON.stringify(info)}\n`);
