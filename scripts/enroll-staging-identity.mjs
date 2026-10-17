import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PROJECT_ID = '48d7a4cf-07dc-489b-8a3d-d6d10142b14e';
const ENVIRONMENT_ID = '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095';
const SERVICE_ID = 'f3756510-4e87-445b-9cfb-9dad042d6758';
const IDENTITY_INSTANCE = 'ummahconnect-isolated-staging';
const DB_USER = 'ummah_identity_app';
const DB_NAME = 'ummah_identity_staging';
const APP_ORIGIN = 'https://ummah-app-staging.up.railway.app';
const HUMHUB_ORIGIN = 'https://ummah-humhub-staging.up.railway.app';
const MAP_PATH = '/tmp/ummahconnect/account-map.json';
const MYSQL_MODULE_PATH = '/app/deployment/staging/identity/node_modules/mysql2/promise.js';
const OPERATOR = 'ummah-operator:verified-callback';
const MAX_FILE_BYTES = 1_048_576;
const NATIVE_TIMEOUT_MS = 10_000;
const SUBJECT_REFERENCE = /^google:[A-Za-z0-9_-]{43}$/;
const NATIVE_TOKEN = /^[A-Za-z0-9_-]{86}$/;
const ROLES = new Set(['author', 'reviewer']);

export class EnrollmentError extends Error {
  constructor(code) {
    super(code);
    this.name = 'EnrollmentError';
    this.code = code;
  }
}

function fail(code) {
  throw new EnrollmentError(code);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactOrigin(value, expected) {
  if (value !== expected) return false;
  try {
    const parsed = new URL(value);
    return parsed.origin === expected && parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      parsed.pathname === '/' && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

/** Validate the non-secret deployment scope before any file, network, or SQL operation. */
export function validateStagingEnvironment(env = process.env) {
  if (!env || typeof env !== 'object' ||
      env.UMMAH_IDENTITY_ENVIRONMENT !== 'isolated-staging' ||
      env.RAILWAY_PROJECT_ID !== PROJECT_ID ||
      env.RAILWAY_ENVIRONMENT_ID !== ENVIRONMENT_ID ||
      env.RAILWAY_SERVICE_ID !== SERVICE_ID ||
      env.REVIEW_DB_NAME !== DB_NAME ||
      env.REVIEW_DB_USER !== DB_USER ||
      typeof env.REVIEW_DB_HOST !== 'string' || !/^[-a-z0-9]+\.railway\.internal$/.test(env.REVIEW_DB_HOST) ||
      typeof env.REVIEW_DB_PASSWORD !== 'string' || env.REVIEW_DB_PASSWORD.length < 32 ||
      !exactOrigin(env.REVIEW_PUBLIC_ORIGIN, APP_ORIGIN) ||
      !exactOrigin(env.UMMAH_PUBLIC_ORIGIN, APP_ORIGIN) ||
      !exactOrigin(env.HUMHUB_ORIGIN, HUMHUB_ORIGIN)) fail('invalid_staging_environment');
  return Object.freeze({
    host: env.REVIEW_DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: env.REVIEW_DB_PASSWORD,
    nativeOrigin: HUMHUB_ORIGIN,
  });
}

async function readPrivateJson(path, { mode, maxBytes }) {
  if (typeof path !== 'string' || !path || path.includes('\0')) fail('protected_file_unavailable');
  let listed;
  try { listed = await lstat(path); } catch { fail('protected_file_unavailable'); }
  if (!listed.isFile() || (listed.mode & 0o7777) !== mode || listed.size > maxBytes) fail('protected_file_unavailable');

  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (!metadata.isFile() || (metadata.mode & 0o7777) !== mode || metadata.size > maxBytes) fail('protected_file_unavailable');
    const bytes = await handle.readFile();
    if (bytes.length > maxBytes) fail('protected_file_unavailable');
    let value;
    try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('protected_file_unavailable'); }
    return { value, digest: createHash('sha256').update(bytes).digest() };
  } catch (error) {
    if (error instanceof EnrollmentError) throw error;
    fail('protected_file_unavailable');
  } finally {
    await handle?.close().catch(() => {});
  }
}

function validInput(value) {
  if (!plainObject(value) || value.kind !== 'verified-ummah-identity-enrollment' ||
      !SUBJECT_REFERENCE.test(value.subjectReference) || !ROLES.has(value.role) || value.spaceId !== 1 ||
      !['stage', 'activate'].includes(value.operation)) fail('invalid_enrollment_input');
  return Object.freeze({
    subjectReference: value.subjectReference,
    role: value.role,
    operation: value.operation,
  });
}

export async function readEnrollmentInput(path) {
  let input;
  try {
    const file = await readPrivateJson(path, { mode: 0o600, maxBytes: MAX_FILE_BYTES });
    input = file.value;
  } catch (error) {
    if (error instanceof EnrollmentError) throw error;
    fail('invalid_enrollment_input');
  }
  return validInput(input);
}

function linkedNativeAccount(value) {
  if (!plainObject(value) || value.enabled !== true || value.disabled === true ||
      !Number.isSafeInteger(value.humhubUserId) || value.humhubUserId < 1 ||
      typeof value.token !== 'string' || !NATIVE_TOKEN.test(value.token)) fail('protected_account_map_unavailable');
  return Object.freeze({ humhubUserId: value.humhubUserId, token: value.token });
}

async function readLinkedAccount(subjectReference, mapPath) {
  let file;
  try { file = await readPrivateJson(mapPath, { mode: 0o600, maxBytes: MAX_FILE_BYTES - 1 }); }
  catch { fail('protected_account_map_unavailable'); }
  const map = file.value;
  if (!plainObject(map) || map.schemaVersion !== 1 || !plainObject(map.accounts) || !Object.hasOwn(map.accounts, subjectReference)) {
    fail('protected_account_map_unavailable');
  }
  return { account: linkedNativeAccount(map.accounts[subjectReference]), digest: file.digest };
}

function equalDigest(left, right) {
  return Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.length === right.length && timingSafeEqual(left, right);
}

async function discard(response) {
  try { await response?.body?.cancel?.(); } catch { /* response cleanup is best effort */ }
}

async function boundedJson(response) {
  if (!response?.headers?.get('content-type')?.toLowerCase().includes('application/json')) fail('native_checks_failed');
  const reader = response.body?.getReader?.();
  if (!reader) fail('native_checks_failed');
  const parts = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_BYTES) {
        await reader.cancel();
        fail('native_checks_failed');
      }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch (error) {
    if (error instanceof EnrollmentError) throw error;
    fail('native_checks_failed');
  }
}

function validText(value, max, { required = false } = {}) {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}

function validReviewed(value, expectedStatus) {
  if (!plainObject(value) || !Number.isSafeInteger(value.id) || value.id < 1 ||
      !Number.isSafeInteger(value.reviewId) || value.reviewId < 1 || !validText(value.message, 12_000) ||
      !['pending', 'approved', 'rejected'].includes(value.status) || ![1, 10].includes(value.state) ||
      (value.status === 'approved' ? value.state !== 1 : value.state !== 10) ||
      (expectedStatus && value.status !== expectedStatus) || !Array.isArray(value.sources) || value.sources.length > 8) return false;
  return value.sources.every(source => {
    if (!validText(source, 2_000, { required: true })) return false;
    try {
      const url = new URL(source);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  });
}

function validCollection(value, expectedStatus) {
  if (!plainObject(value) || !Array.isArray(value.results) || value.results.length > 50 ||
      !Number.isSafeInteger(value.total) || value.total < 0 || !Number.isSafeInteger(value.page) || value.page < 1 ||
      !Number.isSafeInteger(value.pages) || value.pages < 0) return false;
  return value.results.every(item => validReviewed(item, expectedStatus));
}

async function nativeGet(fetcher, origin, token, path, expectedStatus) {
  let response;
  try {
    response = await fetcher(`${origin}/api/v1/${path}`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(NATIVE_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    fail('native_checks_failed');
  }
  if (!response || response.status !== expectedStatus) {
    await discard(response);
    fail('native_checks_failed');
  }
  if (expectedStatus !== 200) {
    await discard(response);
    return null;
  }
  return boundedJson(response);
}

/**
 * Read-only authorization probe matching the existing HumHub adapter's response
 * contracts. It never submits content, changes memberships, or mints a session.
 */
export async function verifyNativeEnrollment({ role, account, nativeFetch = fetch, origin = HUMHUB_ORIGIN }) {
  if (!ROLES.has(role) || !account || !Number.isSafeInteger(account.humhubUserId) || account.humhubUserId < 1 ||
      typeof account.token !== 'string' || !NATIVE_TOKEN.test(account.token) || !exactOrigin(origin, HUMHUB_ORIGIN)) {
    fail('native_checks_failed');
  }

  const current = await nativeGet(nativeFetch, origin, account.token, 'auth/current', 200);
  if (!plainObject(current) || current.id !== account.humhubUserId || !validText(current.display_name, 250)) fail('native_checks_failed');

  const space = await nativeGet(nativeFetch, origin, account.token, 'space/1', 200);
  if (!plainObject(space) || space.id !== 1 || space.name !== 'UmmahConnect Staging Review' ||
      !validText(space.description ?? '', 20_000) || !Number.isSafeInteger(space.contentcontainer_id) || space.contentcontainer_id < 1) {
    fail('native_checks_failed');
  }

  const posts = await nativeGet(nativeFetch, origin, account.token, 'ummahreview/posts?space=1', 200);
  if (!validCollection(posts, 'approved')) fail('native_checks_failed');

  if (role === 'author') {
    const own = await nativeGet(nativeFetch, origin, account.token, 'ummahreview/submissions?space=1', 200);
    if (!validCollection(own)) fail('native_checks_failed');
    await nativeGet(nativeFetch, origin, account.token, 'ummahreview/reviews?space=1', 403);
  } else {
    const reviews = await nativeGet(nativeFetch, origin, account.token, 'ummahreview/reviews?space=1', 200);
    if (!validCollection(reviews, 'pending')) fail('native_checks_failed');
    await nativeGet(nativeFetch, origin, account.token, 'ummahreview/submissions?space=1', 403);
  }
  return true;
}

function rowsOf(result) {
  if (!Array.isArray(result) || !Array.isArray(result[0])) fail('database_scope_mismatch');
  return result[0];
}

async function assertDatabaseScope(db) {
  const principals = rowsOf(await db.execute('SELECT CURRENT_USER() AS `current_user`'));
  const currentUser = principals.length === 1 ? principals[0]?.current_user : null;
  if (typeof currentUser !== 'string' || !new RegExp(`^${DB_USER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@[^@]+$`).test(currentUser)) {
    fail('database_scope_mismatch');
  }
  const markers = rowsOf(await db.execute(
    'SELECT instance_id, project_id, environment_id FROM ummah_identity_instance WHERE instance_id=? FOR UPDATE',
    [IDENTITY_INSTANCE],
  ));
  const marker = markers.length === 1 ? markers[0] : null;
  if (!marker || marker.instance_id !== IDENTITY_INSTANCE || marker.project_id !== PROJECT_ID || marker.environment_id !== ENVIRONMENT_ID) {
    fail('database_scope_mismatch');
  }
}

async function lockedRole(db, subjectReference) {
  const rows = rowsOf(await db.execute(
    'SELECT role, disabled, updated_by FROM review_roles WHERE user_id=? FOR UPDATE',
    [subjectReference],
  ));
  if (rows.length > 1) fail('database_scope_mismatch');
  return rows[0] || null;
}

function exactDisabledOperatorRole(row, role) {
  return row?.role === role && Number(row.disabled) === 1 && row.updated_by === OPERATOR;
}

async function inTransaction(db, work) {
  let started = false;
  try {
    await db.beginTransaction();
    started = true;
    const result = await work();
    await db.commit();
    started = false;
    return result;
  } catch (error) {
    if (started) await db.rollback().catch(() => {});
    throw error;
  }
}

async function stageRole(db, enrollment, now) {
  try {
    return await inTransaction(db, async () => {
      await assertDatabaseScope(db);
      const existing = await lockedRole(db, enrollment.subjectReference);
      if (existing) {
        if (!exactDisabledOperatorRole(existing, enrollment.role)) fail('role_conflict');
        return;
      }
      await db.execute(
        'INSERT INTO review_roles (user_id, role, disabled, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)',
        [enrollment.subjectReference, enrollment.role, now().toISOString(), OPERATOR],
      );
    });
  } catch (error) {
    if (error instanceof EnrollmentError) throw error;
    fail('database_mutation_failed');
  }
}

async function activateRole(db, enrollment, now) {
  try {
    return await inTransaction(db, async () => {
      await assertDatabaseScope(db);
      const existing = await lockedRole(db, enrollment.subjectReference);
      if (!exactDisabledOperatorRole(existing, enrollment.role)) fail('activation_requires_staged_role');
      const result = await db.execute(
        'UPDATE review_roles SET disabled=0, updated_at=?, updated_by=? WHERE user_id=? AND role=? AND disabled=1 AND updated_by=?',
        [now().toISOString(), OPERATOR, enrollment.subjectReference, enrollment.role, OPERATOR],
      );
      const changed = result?.[0]?.affectedRows;
      if (changed !== 1) fail('activation_requires_staged_role');
    });
  } catch (error) {
    if (error instanceof EnrollmentError) throw error;
    fail('database_mutation_failed');
  }
}

async function connectDatabase(config, { db, mysql } = {}) {
  if (db) return { db, owned: false };
  if (!mysql || typeof mysql.createConnection !== 'function') fail('database_unavailable');
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      connectTimeout: NATIVE_TIMEOUT_MS,
      multipleStatements: false,
    });
    return { db: connection, owned: true };
  } catch {
    fail('database_unavailable');
  }
}

/**
 * Execute one operator enrollment from a mode-0600 request file. Tests may
 * inject an already-open DB and read-only native fetcher; production CLI calls
 * dynamically load mysql2 only after this module has been imported.
 * @param {{env?:any,db?:any,mysql?:any,nativeFetch?:any,inputPath?:string,mapPath?:string,now?:()=>Date}} [options]
 */
export async function enrollStagingIdentity({
  env = process.env,
  db,
  mysql,
  nativeFetch = fetch,
  inputPath = env.UMMAH_IDENTITY_ENROLLMENT_INPUT_FILE,
  mapPath = MAP_PATH,
  now = () => new Date(),
} = {}) {
  const config = validateStagingEnvironment(env);
  const enrollment = await readEnrollmentInput(inputPath);
  if (typeof now !== 'function') fail('invalid_enrollment_input');
  const connection = await connectDatabase(config, { db, mysql });
  try {
    if (enrollment.operation === 'stage') {
      await stageRole(connection.db, enrollment, now);
      return Object.freeze({
        kind: 'staging-identity-enrollment',
        operation: 'stage',
        role: enrollment.role,
        stage: true,
        nativeChecksPassed: false,
      });
    }

    const initial = await readLinkedAccount(enrollment.subjectReference, mapPath);
    await verifyNativeEnrollment({ role: enrollment.role, account: initial.account, nativeFetch, origin: config.nativeOrigin });
    const current = await readLinkedAccount(enrollment.subjectReference, mapPath);
    if (!equalDigest(initial.digest, current.digest)) fail('protected_account_map_changed');
    await activateRole(connection.db, enrollment, now);
    return Object.freeze({
      kind: 'staging-identity-enrollment',
      operation: 'activate',
      role: enrollment.role,
      activated: true,
      nativeChecksPassed: true,
    });
  } finally {
    if (connection.owned) await connection.db.end().catch(() => {});
  }
}

export async function runCli(env = process.env) {
  try {
    validateStagingEnvironment(env);
    const module = await import(MYSQL_MODULE_PATH);
    const mysql = module.default || module;
    const result = await enrollStagingIdentity({ env, mysql });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch {
    process.stderr.write('Staging identity enrollment failed.\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then(code => { process.exitCode = code; });
}
