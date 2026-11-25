/**
 * One successful custom research job per anonymous browser pass.
 * Never store raw tokens or questions — only digests and opaque job ids.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type GateJobLookup = Record<string, { result?: { full?: boolean } } | undefined>;

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
        touched INTEGER NOT NULL
      )
    `);
  }

  close(): void {
    this.db.close();
  }

  ownsRecoveredJob(raw: string, id: string): boolean {
    return !!raw && !!this.db.prepare('SELECT 1 FROM passes WHERE token=? AND job=? AND expires>?')
      .get(digest(raw), id, Math.floor(Date.now() / 1000));
  }

  private ensureLibrary() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS personal_report_library (
      owner TEXT NOT NULL, job TEXT NOT NULL, question TEXT NOT NULL, document TEXT NOT NULL,
      saved_at INTEGER NOT NULL, PRIMARY KEY(owner,job))`);
  }

  saveReport(owner: string, job: {id: string;ownerId?: string; result?: {question:string;markdown:string}}) {
    if (!owner || job.ownerId !== owner || !job.result?.markdown) return false;
    this.ensureLibrary();
    this.db.prepare('INSERT OR IGNORE INTO personal_report_library VALUES(?,?,?,?,?)')
      .run(owner,job.id,job.result.question,job.result.markdown,Date.now());
    return true;
  }

  library(owner: string) {
    this.ensureLibrary();
    return this.db.prepare('SELECT job AS id,question FROM personal_report_library WHERE owner=? ORDER BY saved_at DESC,job').all(owner);
  }

  libraryDocument(owner: string,id: string) {
    this.ensureLibrary();
    return this.db.prepare('SELECT document FROM personal_report_library WHERE owner=? AND job=?').get(owner,id);
  }

  mint(member = false): string {
    const raw = randomBytes(32).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare('DELETE FROM passes WHERE expires < ?').run(now);
    this.db
      .prepare('INSERT INTO passes(token, member, expires, touched) VALUES (?, ?, ?, ?)')
      .run(digest(raw), member ? 1 : 0, now + (member ? 43_200 : 365 * 86_400), now);
    return raw;
  }

  reserve(raw: string, question: string, jobId: string, jobs: GateJobLookup): string {
    const row = this.db
      .prepare(
        'SELECT member, status, job, query_hash, touched FROM passes WHERE token = ? AND expires > ?',
      )
      .get(digest(raw), Math.floor(Date.now() / 1000)) as
      | { member: number; status: string; job: string | null; query_hash: string | null; touched: number }
      | undefined;
    if (!row) throw Object.assign(new Error('access_pass_required'), { status: 401 });

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
    if (!row.member && row.status === 'used') {
      throw Object.assign(new Error('google_required'), { status: 403 });
    }
    this.db
      .prepare("UPDATE passes SET status = 'pending', job = ?, query_hash = ?, touched = ? WHERE token = ?")
      .run(jobId, sig, Math.floor(Date.now() / 1000), digest(raw));
    return jobId;
  }

  finish(jobId: string, complete: boolean): void {
    this.db
      .prepare(
        `UPDATE passes SET status = CASE WHEN member = 0 AND ? THEN 'used' ELSE 'new' END, touched = ? WHERE job = ?`,
      )
      .run(complete ? 1 : 0, Math.floor(Date.now() / 1000), jobId);
  }
}

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function defaultGateDbPath(): string {
  return (
    process.env.OPEN_PASSAGE_GATE_DB ||
    path.join(process.cwd(), '.guest-data', 'gate.sqlite')
  );
}
