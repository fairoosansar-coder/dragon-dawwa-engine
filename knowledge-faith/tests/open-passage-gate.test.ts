import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  OpenPassageGate,
  defaultGateDbPath,
  digestCaller,
  GUEST_CALLER_PENDING_TTL_SEC,
} from '../src/server/openPassage/accessGate.ts';
import { finalizeOpenPassageReport } from '../src/server/openPassage/reportFormat.ts';
import { openPassageEvidence } from '../src/server/openPassage/evidence.ts';
import {
  isOpenPassageHostSpeaker,
  OPEN_PASSAGE_HOST_VOICE_ID,
} from '../src/server/openPassage/audio.ts';
import {
  isOpenPassageFlagEnabled,
  openPassageGoogleClientId,
  openPassagePublicEnabled,
} from '../src/server/openPassage/feature.ts';
import { openPassageRouter } from '../src/server/openPassage/routes.ts';
import express from 'express';
import {
  fillOpenPassageStartQuotaForTests,
  getOpenPassageGate,
  resetOpenPassageJobsForTests,
  seedOpenPassageJobForTests,
  startOpenPassageJob,
} from '../src/server/openPassage/jobs.ts';
import { UpstreamError } from '../src/server/http.ts';

test('guest pass allows one successful custom report then requires Google', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const caller = digestCaller('guest-one-report');
  const pass = gate.mint(false, caller);
  try {
    assert.equal(gate.reserve(pass, 'Q1', 'a', jobs, caller), 'a');
    jobs.a = {};
    assert.throws(() => gate.reserve(pass, 'Q2', 'b', jobs, caller), (err: Error & { status?: number }) => {
      assert.equal(err.status, 409);
      return true;
    });
    gate.finish('a', true);
    jobs.a = { result: { full: true } };
    assert.equal(gate.reserve(pass, 'Q1', 'c', jobs, caller), 'a');
    assert.throws(() => gate.reserve(pass, 'Q2', 'b', jobs, caller), (err: Error & { status?: number }) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, 'google_required');
      return true;
    });
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fresh guest token still requires Google after the same caller used their free report', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const caller = digestCaller('192.0.2.40');
  try {
    const first = gate.mint(false, caller);
    assert.equal(gate.reserve(first, 'What is Qur’an 49:6?', 'job-1', jobs, caller), 'job-1');
    jobs['job-1'] = {};
    gate.finish('job-1', true);
    jobs['job-1'] = { result: { full: true } };
    assert.equal(gate.guestCallerConsumed(caller), true);

    const reminted = gate.mint(false, caller);
    assert.notEqual(reminted, first);
    assert.throws(
      () => gate.reserve(reminted, 'What does kindness mean in Islam?', 'job-2', jobs, caller),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 403);
        assert.equal(err.message, 'google_required');
        return true;
      },
    );
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('in-flight guest reserve claims caller so a reminted token cannot race a second free report', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const caller = digestCaller('192.0.2.55');
  try {
    const first = gate.mint(false, caller);
    assert.equal(gate.reserve(first, 'What is fasting?', 'job-a', jobs, caller), 'job-a');
    jobs['job-a'] = {};
    assert.equal(gate.guestCallerBlocked(caller), true);
    assert.equal(gate.guestCallerConsumed(caller), false);

    const reminted = gate.mint(false, caller);
    assert.throws(
      () => gate.reserve(reminted, 'What is zakat?', 'job-b', jobs, caller),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 403);
        assert.equal(err.message, 'google_required');
        return true;
      },
    );

    gate.finish('job-a', false);
    assert.equal(gate.guestCallerBlocked(caller), false);

    assert.equal(gate.reserve(reminted, 'What is zakat?', 'job-c', jobs, caller), 'job-c');
    jobs['job-c'] = {};
    gate.finish('job-c', true);
    assert.equal(gate.guestCallerConsumed(caller), true);
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stale pending guest claims expire after job TTL; consumed stays durable', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const pendingCaller = digestCaller('192.0.2.70');
  const consumedCaller = digestCaller('192.0.2.71');
  try {
    const pendingPass = gate.mint(false, pendingCaller);
    assert.equal(gate.reserve(pendingPass, 'What is wudu?', 'job-p', jobs, pendingCaller), 'job-p');
    jobs['job-p'] = {};
    assert.equal(gate.guestCallerBlocked(pendingCaller), true);

    const future = Math.floor(Date.now() / 1000) + GUEST_CALLER_PENDING_TTL_SEC + 5;
    gate.expireStalePendingGuestCallers(future);
    assert.equal(gate.guestCallerBlocked(pendingCaller), false);
    assert.equal(GUEST_CALLER_PENDING_TTL_SEC, 3_600);

    const consumedPass = gate.mint(false, consumedCaller);
    assert.equal(
      gate.reserve(consumedPass, 'What is salah?', 'job-q', jobs, consumedCaller),
      'job-q',
    );
    jobs['job-q'] = {};
    gate.finish('job-q', true);
    assert.equal(gate.guestCallerConsumed(consumedCaller), true);
    gate.expireStalePendingGuestCallers(future);
    assert.equal(gate.guestCallerConsumed(consumedCaller), true);
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('failed or sources-only completion does not consume the guest allowance', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const pass = gate.mint(false);
  try {
    assert.equal(gate.reserve(pass, 'Q1', 'a', jobs), 'a');
    jobs.a = {};
    gate.finish('a', false);
    assert.equal(gate.reserve(pass, 'Q2', 'b', jobs), 'b');
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('member pass can continue after a successful report', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const pass = gate.mint(true);
  try {
    assert.equal(gate.reserve(pass, 'Q1', 'a', jobs), 'a');
    jobs.a = {};
    gate.finish('a', true);
    assert.equal(gate.reserve(pass, 'Q2', 'b', jobs), 'b');
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid pass is rejected before research starts', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  try {
    assert.throws(
      () => gate.reserve('invalid', 'Q', 'a', {}),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 401);
        return true;
      },
    );
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('canonical report markdown includes the same revision used for listening metadata', () => {
  const report = finalizeOpenPassageReport({
    question: 'What does Qur’an 49:6 teach?',
    status: 'Seven-role AI research report',
    full: true,
    summary: 'Verify news before acting.',
    sections: [
      {
        title: 'Qur’an Tafsir',
        summary: 'Surah al-Hujurat 49:6 warns against acting on unchecked reports.',
        points: ['Confirm before harm spreads.'],
        citations: ['quran:49:6'],
      },
    ],
    sources: [
      {
        id: 'quran:49:6',
        locator: 'Qur’an 49:6',
        text: 'O you who have believed, if there comes to you a disobedient one with information…',
        provider: 'Saheeh International · local Qur’an edition',
        canonicalUrl: 'https://quran.com/49/6',
      },
    ],
    limit: 'AI research, not a ruling.',
    turns: [
      { speaker: 'Host', text: 'What does 49:6 say?' },
      { speaker: 'Analyst', text: 'Verify news carefully.' },
    ],
    revision: 'op-test-revision-1',
  });
  assert.equal(report.revision, 'op-test-revision-1');
  assert.match(report.markdown, /Revision: op-test-revision-1/);
  assert.match(report.markdown, /Qur’an 49:6/);
  assert.deepEqual(report.sections[0].citations, ['Qur’an 49:6']);
});

test('evidence opener resolves an explicit Qur’an reference', async () => {
  const rows = await openPassageEvidence('Please open Qur’an 49:6 for study');
  assert.ok(rows.some(row => row.id === 'quran:49:6'));
  assert.ok(rows[0].canonicalUrl.includes('quran.com/49/6'));
});

test('podcast host voice matches named hosts, not only exact Host', () => {
  assert.equal(isOpenPassageHostSpeaker('Host'), true);
  assert.equal(isOpenPassageHostSpeaker('host'), true);
  assert.equal(isOpenPassageHostSpeaker('Brother Feroz (Host)'), true);
  assert.equal(isOpenPassageHostSpeaker('Sister Amina (host)'), true);
  assert.equal(isOpenPassageHostSpeaker('Analyst'), false);
  assert.equal(isOpenPassageHostSpeaker('Guest'), false);
  assert.equal(isOpenPassageHostSpeaker(''), false);
});

test('unset Open Passage flags keep UI helper and public API inactive (opt-in default)', () => {
  const prev = process.env.OPEN_PASSAGE_PUBLIC;
  try {
    delete process.env.OPEN_PASSAGE_PUBLIC;
    assert.equal(openPassagePublicEnabled(), false);
    assert.equal(isOpenPassageFlagEnabled(undefined), false);
    assert.equal(isOpenPassageFlagEnabled(''), false);
    assert.equal(isOpenPassageFlagEnabled('0'), false);
    assert.equal(isOpenPassageFlagEnabled('false'), false);
    assert.equal(isOpenPassageFlagEnabled('off'), false);

    const root = path.dirname(fileURLToPath(import.meta.url));
    const home = readFileSync(path.join(root, '../src/views/openPassage/OpenPassageHome.tsx'), 'utf8');
    const frame = readFileSync(path.join(root, '../src/components/shell/Frame.tsx'), 'utf8');
    const app = readFileSync(path.join(root, '../src/App.tsx'), 'utf8');
    // Frontend must require an explicit truthy VITE_OPEN_PASSAGE — no default-on branch.
    assert.match(home, /export function openPassageUiEnabled/);
    assert.match(home, /flag === '1'/);
    assert.doesNotMatch(home, /Default on for this feature branch/);
    assert.doesNotMatch(home, /flag !== 'off'/);
    assert.match(frame, /openPassageUiEnabled\(\)/);
    assert.doesNotMatch(frame, /VITE_OPEN_PASSAGE\s*!==\s*'0'/);
    assert.match(app, /openPassageUiEnabled\(\)/);
    assert.doesNotMatch(app, /VITE_OPEN_PASSAGE\s*===\s*'0'/);
  } finally {
    if (prev === undefined) delete process.env.OPEN_PASSAGE_PUBLIC;
    else process.env.OPEN_PASSAGE_PUBLIC = prev;
  }
});

test('explicit staging enablement activates public API and UI flag helpers', async () => {
  const prev = process.env.OPEN_PASSAGE_PUBLIC;
  const listen = async (
    flag: string | undefined,
  ): Promise<{ accessStatus: number; accessBody: string; healthStatus: number; healthPublic: boolean | undefined }> => {
    if (flag === undefined) delete process.env.OPEN_PASSAGE_PUBLIC;
    else process.env.OPEN_PASSAGE_PUBLIC = flag;
    const app = express();
    app.use(express.json());
    app.use('/api/open-passage', openPassageRouter());
    return await new Promise((resolve, reject) => {
      const server = app.listen(0, '127.0.0.1', async () => {
        try {
          const { port } = server.address() as { port: number };
          const base = `http://127.0.0.1:${port}/api/open-passage`;
          const health = await fetch(`${base}/health`);
          const access = await fetch(`${base}/access`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          });
          const healthJson = (await health.json().catch(() => ({}))) as { public?: boolean };
          resolve({
            accessStatus: access.status,
            accessBody: await access.text(),
            healthStatus: health.status,
            healthPublic: healthJson.public,
          });
        } catch (err) {
          reject(err);
        } finally {
          server.close();
        }
      });
    });
  };
  try {
    assert.equal(isOpenPassageFlagEnabled('1'), true);
    assert.equal(isOpenPassageFlagEnabled('true'), true);
    assert.equal(isOpenPassageFlagEnabled('ON'), true);
    assert.equal(isOpenPassageFlagEnabled('yes'), true);

    process.env.OPEN_PASSAGE_PUBLIC = '1';
    assert.equal(openPassagePublicEnabled(), true);

    const off = await listen(undefined);
    assert.equal(off.accessStatus, 404);
    assert.match(off.accessBody, /disabled/i);
    assert.equal(off.healthStatus, 200);
    assert.equal(off.healthPublic, false);

    const on = await listen('1');
    assert.equal(on.healthStatus, 200);
    assert.equal(on.healthPublic, true);
    assert.equal(on.accessStatus, 200);
    assert.match(on.accessBody, /"token"/);
  } finally {
    if (prev === undefined) delete process.env.OPEN_PASSAGE_PUBLIC;
    else process.env.OPEN_PASSAGE_PUBLIC = prev;
  }
});

test('openPassageGoogleClientId falls back to GOOGLE_OIDC_CLIENT_ID via getGoogleAuthConfig', () => {
  const keys = [
    'OPEN_PASSAGE_GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_OIDC_CLIENT_ID',
    'VITE_GOOGLE_CLIENT_ID',
  ] as const;
  const prev: Record<string, string | undefined> = {};
  for (const key of keys) prev[key] = process.env[key];
  try {
    for (const key of keys) delete process.env[key];
    process.env.GOOGLE_OIDC_CLIENT_ID = 'oidc-fallback-client.apps.googleusercontent.com';
    assert.equal(openPassageGoogleClientId(), 'oidc-fallback-client.apps.googleusercontent.com');

    process.env.OPEN_PASSAGE_GOOGLE_CLIENT_ID = 'op-override.apps.googleusercontent.com';
    assert.equal(openPassageGoogleClientId(), 'op-override.apps.googleusercontent.com');
  } finally {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
});

test('open-passage router is mounted under /api/open-passage with relative routes', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const routesSrc = readFileSync(path.join(root, '../src/server/openPassage/routes.ts'), 'utf8');
  const serverSrc = readFileSync(path.join(root, '../server.ts'), 'utf8');
  const jobsSrc = readFileSync(path.join(root, '../src/server/openPassage/jobs.ts'), 'utf8');
  const sevenSrc = readFileSync(path.join(root, '../src/server/sevenAgentService.ts'), 'utf8');
  assert.match(serverSrc, /app\.use\(\s*['"]\/api\/open-passage['"]\s*,\s*openPassageRouter\(\)\s*\)/);
  assert.doesNotMatch(routesSrc, /router\.(get|post)\(\s*['"]\/api\/open-passage/);
  assert.match(routesSrc, /router\.get\(\s*['"]\/health['"]/);
  assert.match(routesSrc, /router\.post\(\s*['"]\/google['"]/);
  assert.match(routesSrc, /limitGuestIssuanceForCaller/);
  assert.match(routesSrc, /limitGuestIssuance/);
  assert.match(routesSrc, /beginGoogleVerifyForCaller/);
  assert.match(routesSrc, /limitGoogleIssuance/);
  assert.match(routesSrc, /beginGoogleVerifyForCaller[\s\S]*verifyGoogleIdToken[\s\S]*limitGoogleIssuance/);
  assert.match(routesSrc, /endGoogleVerifyForCaller/);
  assert.match(routesSrc, /pruneCallerStore/);
  assert.match(routesSrc, /evictOldestCallerKeys/);
  assert.doesNotMatch(routesSrc, /store\.clear\s*\(/);
  assert.match(routesSrc, /digestCaller\(callerKey\(req\)\)/);
  assert.match(jobsSrc, /callerDigest/);
  const audioSrc = readFileSync(path.join(root, '../src/server/openPassage/audio.ts'), 'utf8');
  assert.match(audioSrc, /eleven_v4/);
  assert.match(audioSrc, /renderViaElevenLabs/);
  assert.match(audioSrc, /renderViaGemini/);
  assert.match(audioSrc, /OPEN_PASSAGE_HOST_VOICE_ID/);
  assert.equal(OPEN_PASSAGE_HOST_VOICE_ID, 'xSfzoa4Rf8qe7qNgSiq5');
  assert.match(audioSrc, /Guest listening voices are unavailable/);
  assert.doesNotMatch(audioSrc, /offlineSpeak|flite=/);
  assert.match(audioSrc, /libmp3lame/);
  assert.doesNotMatch(audioSrc, /-c',\s*'copy'|'-c',\s*'copy'/);
  const gateSrc = readFileSync(path.join(root, '../src/server/openPassage/accessGate.ts'), 'utf8');
  assert.match(gateSrc, /claimGuestCaller/);
  assert.match(gateSrc, /releaseGuestCallerPending/);
  assert.match(gateSrc, /state = 'pending'/);
  assert.match(gateSrc, /expireStalePendingGuestCallers/);
  assert.match(gateSrc, /GUEST_CALLER_PENDING_TTL_SEC\s*=\s*3_600/);
  assert.match(jobsSrc, /OPEN_PASSAGE_QUESTION_MAX/);
  assert.match(jobsSrc, /Keep questions under 1,200 characters/);
  assert.match(jobsSrc, /new UpstreamError\([\s\S]*429/);
  assert.match(jobsSrc, /openPassageDesk:\s*true/);
  assert.match(jobsSrc, /mimeType/);
  assert.match(sevenSrc, /export type BuildDynamicDossierOptions/);
  assert.match(sevenSrc, /openPassageDesk && retrievedPassages\.length/);
  assert.match(sevenSrc, /await retrieveSevenAgentEvidencePacket/);
  // Public-desk restraint must be gated — Hub/custom research keeps Parallel evidence tone.
  assert.match(sevenSrc, /OPEN_PASSAGE_EVIDENTIARY_RESTRAINT/);
  assert.match(sevenSrc, /\.\.\.\(openPassageDesk \? \[OPEN_PASSAGE_EVIDENTIARY_RESTRAINT\] : \[\]\)/);
  assert.match(sevenSrc, /synthesizeDynamicDossierPayload\(question, evidencePacket, language, openPassageDesk\)/);
  assert.match(sevenSrc, /generateRoundtableAfterSynthesis\(question, generated, agents, language, openPassageDesk\)/);
});

test('guest gate ledger defaults under persistRoot, not ephemeral cwd', () => {
  const prevGate = process.env.OPEN_PASSAGE_GATE_DB;
  const prevPersist = process.env.DD_PERSIST_DIR;
  try {
    delete process.env.OPEN_PASSAGE_GATE_DB;
    process.env.DD_PERSIST_DIR = '/tmp/op-persist-gate-test';
    assert.match(defaultGateDbPath(), /\/tmp\/op-persist-gate-test\/open-passage\/gate\.sqlite$/);
    process.env.OPEN_PASSAGE_GATE_DB = '/data/open-passage/gate.sqlite';
    assert.equal(defaultGateDbPath(), '/data/open-passage/gate.sqlite');
  } finally {
    if (prevGate === undefined) delete process.env.OPEN_PASSAGE_GATE_DB;
    else process.env.OPEN_PASSAGE_GATE_DB = prevGate;
    if (prevPersist === undefined) delete process.env.DD_PERSIST_DIR;
    else process.env.DD_PERSIST_DIR = prevPersist;
  }
});

test('demo sample report carries a stable revision for matching audio', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const sample = JSON.parse(
    readFileSync(path.join(root, '../public/assets/guest-sample/report.json'), 'utf8'),
  ) as { revision?: string; markdown?: string };
  assert.equal(sample.revision, 'op-kindness-sample-v1');
  assert.match(String(sample.markdown || ''), /Revision: op-kindness-sample-v1/);
});


test('SeekerAuthCard and GoogleGate share GIS init without direct initialize overwrite', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const modal = readFileSync(path.join(root, '../src/components/SeekerAuthModal.tsx'), 'utf8');
  const access = readFileSync(path.join(root, '../src/views/openPassage/ResearchAccess.tsx'), 'utf8');
  const auth = readFileSync(path.join(root, '../src/lib/seekerAuth.ts'), 'utf8');
  assert.doesNotMatch(modal, /gId\.initialize\s*\(/);
  assert.doesNotMatch(access, /\.initialize\s*\(/);
  assert.match(modal, /ensureGoogleIdentityInitialized/);
  assert.match(modal, /subscribeGoogleGisCredential/);
  assert.match(modal, /setGoogleGisActiveHandler/);
  assert.match(access, /setGoogleGisActiveHandler/);
  assert.match(auth, /export function setGoogleGisActiveHandler/);
  assert.match(auth, /gisActiveHandlerId/);
  assert.equal((auth.match(/window\.google\.accounts\.id\.initialize/g) || []).length, 1);
});

test('GoogleGate resumes research before seeker session flip; App keeps OP desk without replacing Hub', () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const access = readFileSync(path.join(root, '../src/views/openPassage/ResearchAccess.tsx'), 'utf8');
  const app = readFileSync(path.join(root, '../src/App.tsx'), 'utf8');
  const home = readFileSync(path.join(root, '../src/views/openPassage/OpenPassageHome.tsx'), 'utf8');
  const parkAt = access.indexOf("replaceState(null, '', '#/')");
  const resumeAt = access.indexOf('done.current()');
  const signInAt = access.indexOf('signInWithGoogleCredential(credential)');
  assert.ok(parkAt > 0 && resumeAt > 0 && signInAt > 0);
  assert.ok(parkAt < resumeAt && resumeAt < signInAt);
  assert.match(access, /isOpenPassageDeskHash/);
  assert.match(app, /keepAuthenticatedOpDesk/);
  assert.match(app, /isOpenPassageDeskHash\(rawHash\)/);
  assert.match(app, /PublicHomeOverview/);
  // Authenticated `#/hub` must reach KnowledgeHub — not OP via onPublicHome alone.
  assert.doesNotMatch(app, /openPassageUiEnabled\(\)\s*&&\s*onPublicHome/);
  // Authenticated empty-home must not bounce to Faith Wall while OP is enabled.
  assert.match(app, /!openPassageUiEnabled\(\)/);
  assert.match(app, /#\/quran\/wall/);
  assert.match(home, /op-research-v1:pending-desk/);
  assert.match(home, /export function isOpenPassageDeskHash/);
  assert.match(home, /replaceState\(null, '', '#\/'\)/);
  assert.match(home, /readPendingDesk|writePendingDesk/);
});

test('startOpenPassageJob reuses an existing full report before new-job quotas', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-jobs-'));
  try {
    resetOpenPassageJobsForTests(path.join(dir, 'gate.sqlite'));
    const gate = getOpenPassageGate();
    const token = gate.mint(false);
    const question = 'Please open Qur’an 49:6 for verifying news';
    const seedId = 'seed-full-job-1';
    seedOpenPassageJobForTests({
      id: seedId,
      time: Date.now(),
      state: 'ready',
      sources: [],
      result: {
        question,
        status: 'Seven-role AI research report',
        full: true,
        summary: 'Verify news carefully.',
        sections: [],
        sources: [],
        limit: 'test',
        turns: [],
        markdown: '# test',
        revision: 'op-test-seed',
      },
      audio: {},
    });
    const jobsView: Record<string, { result?: { full?: boolean } }> = {
      [seedId]: { result: { full: true } },
    };
    assert.equal(gate.reserve(token, question, seedId, jobsView), seedId);
    gate.finish(seedId, true);

    fillOpenPassageStartQuotaForTests(30);
    const first = startOpenPassageJob(token, question);
    assert.equal(first.id, seedId);
    const second = startOpenPassageJob(token, question);
    assert.equal(second.id, seedId);

    assert.throws(
      () => startOpenPassageJob(token, 'a'.repeat(1201)),
      (err: unknown) => err instanceof UpstreamError && err.status === 400,
    );
  } finally {
    resetOpenPassageJobsForTests(path.join(dir, 'gate-reset.sqlite'));
    rmSync(dir, { recursive: true, force: true });
  }
});
