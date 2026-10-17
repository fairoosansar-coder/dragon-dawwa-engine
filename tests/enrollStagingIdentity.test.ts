import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EnrollmentError, enrollStagingIdentity } from '../scripts/enroll-staging-identity.mjs';

const subject = `google:${'A'.repeat(43)}`;
const token = 't'.repeat(86);
const operator = 'ummah-operator:verified-callback';
const project = '48d7a4cf-07dc-489b-8a3d-d6d10142b14e';
const environment = '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095';
const service = 'f3756510-4e87-445b-9cfb-9dad042d6758';

function stagingEnv(inputPath: string) {
  return {
    UMMAH_IDENTITY_ENROLLMENT_INPUT_FILE: inputPath,
    UMMAH_IDENTITY_ENVIRONMENT: 'isolated-staging',
    RAILWAY_PROJECT_ID: project,
    RAILWAY_ENVIRONMENT_ID: environment,
    RAILWAY_SERVICE_ID: service,
    REVIEW_DB_NAME: 'ummah_identity_staging',
    REVIEW_DB_USER: 'ummah_identity_app',
    REVIEW_DB_HOST: 'identity-db.railway.internal',
    REVIEW_DB_PASSWORD: 'p'.repeat(32),
    REVIEW_PUBLIC_ORIGIN: 'https://ummah-app-staging.up.railway.app',
    UMMAH_PUBLIC_ORIGIN: 'https://ummah-app-staging.up.railway.app',
    HUMHUB_ORIGIN: 'https://ummah-humhub-staging.up.railway.app',
  };
}

async function privateJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value), { mode: 0o600 });
  await chmod(path, 0o600);
}

async function files(t: any, input: any, map?: any) {
  const dir = await mkdtemp(join(tmpdir(), 'enroll-staging-identity-'));
  await chmod(dir, 0o700);
  const inputPath = join(dir, 'input.json');
  const mapPath = join(dir, 'account-map.json');
  await privateJson(inputPath, input);
  if (map !== undefined) await privateJson(mapPath, map);
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { inputPath, mapPath };
}

function request(role: 'author' | 'reviewer' = 'author', operation: 'stage' | 'activate' = 'stage', extra: Record<string, unknown> = {}) {
  return {
    kind: 'verified-ummah-identity-enrollment',
    subjectReference: subject,
    role,
    spaceId: 1,
    operation,
    ...extra,
  };
}

function account(overrides: Record<string, unknown> = {}) {
  return { enabled: true, humhubUserId: 7, token, ...overrides };
}

function protectedMap(overrides: Record<string, unknown> = {}) {
  return { schemaVersion: 1, accounts: { [subject]: account(overrides) } };
}

class FakeDb {
  row: any;
  history: Array<{ sql: string; params: any[] }> = [];
  began = 0;
  committed = 0;
  rolledBack = 0;
  private snapshot: any;
  currentUser = 'ummah_identity_app@%';
  marker: any = { instance_id: 'ummahconnect-isolated-staging', project_id: project, environment_id: environment };
  failUpdate = false;

  constructor(row: any = null) { this.row = row ? { ...row } : null; }

  async beginTransaction() {
    this.began += 1;
    this.snapshot = this.row ? { ...this.row } : null;
  }

  async commit() { this.committed += 1; }

  async rollback() {
    this.rolledBack += 1;
    this.row = this.snapshot ? { ...this.snapshot } : null;
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    this.history.push({ sql, params });
    if (sql.startsWith('SELECT CURRENT_USER()')) return [[{ current_user: this.currentUser }], []];
    if (sql.startsWith('SELECT instance_id')) return [[this.marker], []];
    if (sql.startsWith('SELECT role')) return [this.row ? [{ ...this.row }] : [], []];
    if (sql.startsWith('INSERT INTO review_roles')) {
      if (this.row) throw new Error('duplicate');
      this.row = { role: params[1], disabled: 1, updated_at: params[2], updated_by: params[3] };
      return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith('UPDATE review_roles')) {
      if (!this.row || this.row.role !== params[3] || Number(this.row.disabled) !== 1 || this.row.updated_by !== params[4]) return [{ affectedRows: 0 }, []];
      this.row.disabled = 0;
      this.row.updated_at = params[0];
      this.row.updated_by = params[1];
      if (this.failUpdate) throw new Error('forced update fault');
      return [{ affectedRows: 1 }, []];
    }
    throw new Error('unexpected SQL');
  }
}

function collection() { return { results: [], total: 0, page: 1, pages: 0 }; }

function nativeFetch(role: 'author' | 'reviewer' = 'author', { uid = 7, authorQueueStatus = 403 }: { uid?: number; authorQueueStatus?: number } = {}) {
  return async (input: string | URL, init: any) => {
    const url = new URL(String(input));
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    assert.equal(init.headers.Accept, 'application/json');
    const path = url.pathname.replace('/api/v1/', '');
    if (path === 'auth/current') return Response.json({ id: uid, display_name: 'Synthetic member' });
    if (path === 'space/1') return Response.json({ id: 1, name: 'UmmahConnect Staging Review', description: '', contentcontainer_id: 3 });
    if (path === 'ummahreview/posts') return Response.json(collection());
    if (path === 'ummahreview/submissions') return role === 'author' ? Response.json(collection()) : Response.json({}, { status: 403 });
    if (path === 'ummahreview/reviews') return role === 'reviewer' ? Response.json(collection()) : Response.json({}, { status: authorQueueStatus });
    assert.fail(`unexpected native endpoint ${url.pathname}`);
  };
}

async function run({ env, db, mapPath, fetcher }: { env: any; db: FakeDb; mapPath?: string; fetcher?: any }) {
  return enrollStagingIdentity({
    env,
    db,
    mapPath,
    nativeFetch: fetcher,
    now: () => new Date('2026-10-17T12:00:00.000Z'),
  });
}

async function rejectsCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: any) => error instanceof EnrollmentError && error.code === code);
}

test('rejects malformed verified references and any owner or publisher request before SQL', async t => {
  for (const bad of [request('author', 'stage', { subjectReference: 'google:bad' }), request('owner' as any), request('publisher' as any)]) {
    const { inputPath } = await files(t, bad);
    const db = new FakeDb();
    await rejectsCode(run({ env: stagingEnv(inputPath), db }), 'invalid_enrollment_input');
    assert.equal(db.began, 0);
  }
});

test('rejects a wrong Railway staging scope before any SQL', async t => {
  const { inputPath } = await files(t, request());
  const db = new FakeDb();
  const env = stagingEnv(inputPath);
  env.RAILWAY_SERVICE_ID = 'wrong-service';
  await rejectsCode(run({ env, db }), 'invalid_staging_environment');
  assert.equal(db.began, 0);
});

test('stages only a disabled author row and idempotently accepts that exact operator row', async t => {
  const { inputPath } = await files(t, request('author', 'stage'));
  const db = new FakeDb();
  const result = await run({ env: stagingEnv(inputPath), db, fetcher: () => assert.fail('stage must not call native') });
  assert.deepEqual(result, {
    kind: 'staging-identity-enrollment', operation: 'stage', role: 'author', stage: true, nativeChecksPassed: false,
  });
  assert.equal(db.row.disabled, 1);
  assert.equal(db.row.role, 'author');
  assert.equal(db.row.updated_by, operator);
  assert.ok(db.history.some(item => item.sql.startsWith('INSERT INTO review_roles')));
  assert.equal(db.history.some(item => item.sql.startsWith('UPDATE review_roles')), false);

  const replay = await run({ env: stagingEnv(inputPath), db });
  assert.equal((replay as any).stage, true);
  assert.equal(db.history.filter(item => item.sql.startsWith('INSERT INTO review_roles')).length, 1);
});

test('refuses a pre-existing active or differently-provenanced role instead of changing it', async t => {
  const { inputPath } = await files(t, request('author', 'stage'));
  for (const row of [
    { role: 'author', disabled: 0, updated_by: operator },
    { role: 'reviewer', disabled: 1, updated_by: operator },
    { role: 'author', disabled: 1, updated_by: 'another-operator' },
  ]) {
    const db = new FakeDb(row);
    await rejectsCode(run({ env: stagingEnv(inputPath), db }), 'role_conflict');
    assert.equal(Number(db.row.disabled), Number(row.disabled));
    assert.equal(db.rolledBack, 1);
  }
});

test('activation fails closed when the protected account map is absent', async t => {
  const { inputPath, mapPath } = await files(t, request('author', 'activate'));
  const db = new FakeDb({ role: 'author', disabled: 1, updated_by: operator });
  await rejectsCode(run({ env: stagingEnv(inputPath), db, mapPath, fetcher: nativeFetch() }), 'protected_account_map_unavailable');
  assert.equal(db.began, 0);
  assert.equal(db.row.disabled, 1);
});

test('activation rejects a native user-id mismatch without enabling the staged role', async t => {
  const { inputPath, mapPath } = await files(t, request('author', 'activate'), protectedMap());
  const db = new FakeDb({ role: 'author', disabled: 1, updated_by: operator });
  await rejectsCode(run({ env: stagingEnv(inputPath), db, mapPath, fetcher: nativeFetch('author', { uid: 8 }) }), 'native_checks_failed');
  assert.equal(db.began, 0);
  assert.equal(db.row.disabled, 1);
});

test('activation rejects an author that can read the reviewer queue', async t => {
  const { inputPath, mapPath } = await files(t, request('author', 'activate'), protectedMap());
  const db = new FakeDb({ role: 'author', disabled: 1, updated_by: operator });
  await rejectsCode(run({ env: stagingEnv(inputPath), db, mapPath, fetcher: nativeFetch('author', { authorQueueStatus: 200 }) }), 'native_checks_failed');
  assert.equal(db.began, 0);
  assert.equal(db.row.disabled, 1);
});

test('activation rolls back and never leaves an enabled role when the guarded update fails', async t => {
  const { inputPath, mapPath } = await files(t, request('author', 'activate'), protectedMap());
  const db = new FakeDb({ role: 'author', disabled: 1, updated_by: operator });
  db.failUpdate = true;
  await rejectsCode(run({ env: stagingEnv(inputPath), db, mapPath, fetcher: nativeFetch('author') }), 'database_mutation_failed');
  assert.equal(db.rolledBack, 1);
  assert.equal(db.committed, 0);
  assert.equal(db.row.disabled, 1);
});

test('activation re-reads and hashes the protected map before the transaction', async t => {
  const { inputPath, mapPath } = await files(t, request('author', 'activate'), protectedMap());
  const db = new FakeDb({ role: 'author', disabled: 1, updated_by: operator });
  let changed = false;
  const fetcher = async (url: string, init: any) => {
    if (!changed && new URL(url).pathname.endsWith('/auth/current')) {
      changed = true;
      await privateJson(mapPath, protectedMap({ token: 'u'.repeat(86) }));
    }
    return nativeFetch('author')(url, init);
  };
  await rejectsCode(run({ env: stagingEnv(inputPath), db, mapPath, fetcher }), 'protected_account_map_changed');
  assert.equal(db.began, 0);
  assert.equal(db.row.disabled, 1);
});

test('activates only the exact staged reviewer after native authorization checks pass', async t => {
  const { inputPath, mapPath } = await files(t, request('reviewer', 'activate'), protectedMap());
  const db = new FakeDb({ role: 'reviewer', disabled: 1, updated_by: operator });
  const result = await run({ env: stagingEnv(inputPath), db, mapPath, fetcher: nativeFetch('reviewer') });
  assert.deepEqual(result, {
    kind: 'staging-identity-enrollment', operation: 'activate', role: 'reviewer', activated: true, nativeChecksPassed: true,
  });
  assert.equal(db.row.disabled, 0);
  assert.equal(db.row.updated_by, operator);
  assert.equal(db.committed, 1);
  assert.ok(db.history.some(item => item.sql.includes('FOR UPDATE')));
  const update = db.history.find(item => item.sql.startsWith('UPDATE review_roles'));
  assert.deepEqual(update?.params.slice(2), [subject, 'reviewer', operator]);
});
