/**
 * One successful custom research job per anonymous browser pass.
 * Never store raw tokens or questions — only digests and opaque job ids.
 * Guest callers that finish one full report are blocked from another free report
 * even if they mint a fresh guest token (same caller digest).
 * Pending rows are claimed at reserve() so concurrent reminted tokens cannot race.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { persistRoot } from '../persist.ts';

export type GateJobLookup = Record<string, { result?: { full?: boolean } } | undefined>;

type GuestCallerState = 'pending' | 'consumed';

/** Align with in-memory Open Passage job TTL (`jobs.ts` expireJobs = 1 hour). */
export const GUEST_CALLER_PENDING_TTL_SEC = 3_600;

export class OpenPassageGate {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS passes (
        token TEXT PRIMARY KEY,
        member INTEGER NOT NULL,
        expires INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        job TEXT,
        query_hash TEXT,
        touched INTEGER NOT NULL,
        caller TEXT
      );
      CREATE TABLE IF NOT EXISTS guest_callers (
        caller TEXT PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'consumed',
        touched INTEGER NOT NULL
      );
    `);
    this.ensureCallerColumn();
    this.ensureGuestCallerStateColumn();
  }

  private ensureCallerColumn(): void {
    const cols = this.db.prepare('PRAGMA table_info(passes)').all() as Array<{ name?: string }>;
    if (!cols.some(col => col.name === 'caller')) {
      this.db.exec('ALTER TABLE passes ADD COLUMN caller TEXT');
    }
  }

  private ensureGuestCallerStateColumn(): void {
    const cols = this.db.prepare('PRAGMA table_info(guest_callers)').all() as Array<{ name?: string }>;
    if (!cols.some(col => col.name === 'state')) {
      this.db.exec(`ALTER TABLE guest_callers ADD COLUMN state TEXT NOT NULL DEFAULT 'consumed'`);
    }
  }

  close(): void {
    this.db.close();
  }

  mint(member = false, callerDigest?: string): string {
    const raw = randomBytes(32).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    this.expireStalePendingGuestCallers(now);
    this.db.prepare('DELETE FROM passes WHERE expires < ?').run(now);
    this.db
      .prepare(
        'INSERT INTO passes(token, member, expires, touched, caller) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        digest(raw),
        member ? 1 : 0,
        now + (member ? 43_200 : 365 * 86_400),
        now,
        callerDigest || null,
      );
    return raw;
  }

  reserve(
    raw: string,
    question: string,
    jobId: string,
    jobs: GateJobLookup,
    callerDigest?: string,
  ): string {
    const nowSec = Math.floor(Date.now() / 1000);
    this.expireStalePendingGuestCallers(nowSec);
    const row = this.db
      .prepare(
        'SELECT member, status, job, query_hash, touched, caller FROM passes WHERE token = ? AND expires > ?',
      )
      .get(digest(raw), nowSec) as
      | {
          member: number;
          status: string;
          job: string | null;
          query_hash: string | null;
          touched: number;
          caller: string | null;
        }
      | undefined;
    if (!row) throw Object.assign(new Error('access_pass_required'), { status: 401 });

    const caller = callerDigest || row.caller || '';
    if (caller && caller !== row.caller) {
      this.db
        .prepare('UPDATE passes SET caller = ?, touched = ? WHERE token = ?')
        .run(caller, nowSec, digest(raw));
    }

    const sig = digest(question.toLowerCase().split(/\s+/).filter(Boolean).join(' '));
    const previous = row.job || '';
    const previousJob = previous ? jobs[previous] : undefined;
    if (
      previous &&
      previousJob &&
      sig === row.query_hash &&
      (row.status === 'pending' ||
        row.status === 'used' ||
        previousJob.result?.full)
    ) {
      return previous;
    }
    if (row.status === 'pending' && previous && jobs[previous]) {
      throw Object.assign(
        new Error('A question is already being researched. Please wait for it to finish.'),
        { status: 409 },
      );
    }
    if (!row.member) {
      if (row.status === 'used') {
        throw Object.assign(new Error('google_required'), { status: 403 });
      }
      if (caller && this.guestCallerBlocked(caller)) {
        throw Object.assign(new Error('google_required'), { status: 403 });
      }
    }

    this.db
      .prepare(
        "UPDATE passes SET status = 'pending', job = ?, query_hash = ?, touched = ?, caller = COALESCE(?, caller) WHERE token = ?",
      )
      .run(jobId, sig, nowSec, caller || null, digest(raw));

    // Claim the free guest slot immediately so concurrent reminted tokens cannot race.
    if (!row.member && caller) {
      this.claimGuestCaller(caller, 'pending', nowSec);
    }
    return jobId;
  }

  finish(jobId: string, complete: boolean): void {
    const now = Math.floor(Date.now() / 1000);
    const row = this.db
      .prepare('SELECT member, caller FROM passes WHERE job = ?')
      .get(jobId) as { member: number; caller: string | null } | undefined;
    this.db
      .prepare(
        `UPDATE passes SET status = CASE WHEN member = 0 AND ? THEN 'used' ELSE 'new' END, touched = ? WHERE job = ?`,
      )
      .run(complete ? 1 : 0, now, jobId);
    if (!row || row.member !== 0 || !row.caller) return;
    if (complete) {
      this.claimGuestCaller(row.caller, 'consumed', now);
    } else {
      // Release only when the free report did not complete (failed / sources-only / quota rollback).
      this.releaseGuestCallerPending(row.caller);
    }
  }

  guestCallerConsumed(callerDigest: string): boolean {
    return this.guestCallerState(callerDigest) === 'consumed';
  }

  guestCallerBlocked(callerDigest: string): boolean {
    const state = this.guestCallerState(callerDigest);
    return state === 'pending' || state === 'consumed';
  }

  /** Drop orphan pending claims after job TTL — consumed rows stay durable. */
  expireStalePendingGuestCallers(now = Math.floor(Date.now() / 1000)): void {
    this.db
      .prepare(`DELETE FROM guest_callers WHERE state = 'pending' AND touched < ?`)
      .run(now - GUEST_CALLER_PENDING_TTL_SEC);
  }

  private guestCallerState(callerDigest: string): GuestCallerState | null {
    if (!callerDigest) return null;
    this.expireStalePendingGuestCallers();
    const hit = this.db
      .prepare('SELECT state FROM guest_callers WHERE caller = ?')
      .get(callerDigest) as { state?: string } | undefined;
    if (!hit?.state) return null;
    if (hit.state === 'pending' || hit.state === 'consumed') return hit.state;
    return 'consumed';
  }

  private claimGuestCaller(caller: string, state: GuestCallerState, now: number): void {
    this.db
      .prepare(
        `INSERT INTO guest_callers(caller, state, touched) VALUES (?, ?, ?)
         ON CONFLICT(caller) DO UPDATE SET
           state = CASE
             WHEN guest_callers.state = 'consumed' THEN 'consumed'
             ELSE excluded.state
           END,
           touched = excluded.touched`,
      )
      .run(caller, state, now);
  }

  private releaseGuestCallerPending(caller: string): void {
    this.db
      .prepare(`DELETE FROM guest_callers WHERE caller = ? AND state = 'pending'`)
      .run(caller);
  }
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Opaque digest for rate/guest ledgers — never store raw IPs in the gate tables. */
export function digestCaller(callerKey: string): string {
  return digest(`op-caller:${callerKey.trim() || 'unknown'}`);
}

export function defaultGateDbPath(): string {
  // Prefer an explicit path; otherwise keep the ledger on the durable persist volume
  // (Railway container cwd is wiped on deploy — never default to ephemeral disk).
  return (
    process.env.OPEN_PASSAGE_GATE_DB ||
    path.join(persistRoot(), 'open-passage', 'gate.sqlite')
  );
}
