import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LANGS, type Lang } from '../../shared/sources.ts';
import { ALL_GUIDES, GUIDE_SECTIONS, PROSE_SECTIONS, findGuide } from '../../shared/spiritual/catalog.ts';
import {
  addReview,
  allowedActions,
  applyTransition,
  EditorialError,
  publicGuide,
  ROLES,
  type Action,
  type EditorUser,
  type GuideRecord,
  type GuideRevision,
  type PublicGuide,
  type ReviewKind,
  type Role,
} from '../../shared/spiritual/governance.ts';

export const SCHEMA_VERSION = 1;

export interface ErrorReport {
  id: string;
  slug: string;
  section: string;
  lang: Lang;
  message: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

interface StoreFile {
  schemaVersion: number;
  guides: GuideRecord[];
  reports: ErrorReport[];
}

const MAX_REPORTS = 5000;

/**
 * File-backed editorial store. Seeding is additive: a guide from the catalog is added only when the store
 * has no record for it, so editors' work is never overwritten by a deploy.
 */
export class EditorialStore {
  private data: StoreFile;

  constructor(
    private readonly file: string | null,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {
    this.data = this.load();
    if (this.seed()) this.save();
  }

  private load(): StoreFile {
    if (this.file && fs.existsSync(this.file)) {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<StoreFile>;
      if ((parsed.schemaVersion ?? 0) > SCHEMA_VERSION) throw new Error(`Editorial store ${this.file} was written by a newer version`);
      return { schemaVersion: SCHEMA_VERSION, guides: parsed.guides ?? [], reports: parsed.reports ?? [] };
    }
    return { schemaVersion: SCHEMA_VERSION, guides: [], reports: [] };
  }

  private seed(): boolean {
    const known = new Set(this.data.guides.map(g => g.slug));
    let added = false;
    const now = this.clock();
    for (const { guide } of ALL_GUIDES) {
      if (known.has(guide.slug)) continue;
      this.data.guides.push({
        slug: guide.slug,
        revisions: [
          {
            rev: 1,
            state: 'draft',
            round: 1,
            author: { id: 'catalog', name: 'Dragon Dawwa editorial outline' },
            createdAt: now,
            updatedAt: now,
            sections: {},
            translationEdition: {},
            interpretiveTradition: '',
            changeNote: '',
            notes: guide.brief,
            reviews: [],
            history: [],
          },
        ],
      });
      added = true;
    }
    return added;
  }

  private save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }

  private record(slug: string): GuideRecord {
    const record = this.data.guides.find(g => g.slug === slug);
    if (!record) throw new EditorialError('Guide not found', 404);
    return record;
  }

  private revision(slug: string, rev: number): GuideRevision {
    const revision = this.record(slug).revisions.find(r => r.rev === rev);
    if (!revision) throw new EditorialError('Revision not found', 404);
    return revision;
  }

  publicGuide(slug: string, lang: Lang): PublicGuide {
    if (!findGuide(slug)) throw new EditorialError('Guide not found', 404);
    return publicGuide(this.data.guides.find(g => g.slug === slug), slug, lang);
  }

  /** Publication status of every guide, for topic pages; no text. */
  publicIndex(): Record<string, { status: PublicGuide['status']; scholarReviewed: boolean; languages: Lang[]; updatedAt?: string }> {
    const out: Record<string, { status: PublicGuide['status']; scholarReviewed: boolean; languages: Lang[]; updatedAt?: string }> = {};
    for (const { guide } of ALL_GUIDES) {
      const p = this.publicGuide(guide.slug, 'en');
      out[guide.slug] = { status: p.status, scholarReviewed: p.scholarReviewed, languages: p.languages, updatedAt: p.updatedAt };
    }
    return out;
  }

  /** Published sections for the study assistant, as retrievable evidence. */
  publishedSections(slugs: string[], lang: Lang): { slug: string; section: string; text: string; guide: PublicGuide }[] {
    return slugs.flatMap(slug => {
      const guide = this.publicGuide(slug, lang);
      return Object.entries(guide.sections).map(([section, text]) => ({ slug, section, text: text as string, guide }));
    });
  }

  list(user: EditorUser) {
    return this.data.guides.map(g => ({
      slug: g.slug,
      revisions: g.revisions.map(r => ({ rev: r.rev, state: r.state, updatedAt: r.updatedAt, allowedActions: allowedActions(r, user) })),
    }));
  }

  get(slug: string, user: EditorUser) {
    const record = this.record(slug);
    return { ...record, revisions: record.revisions.map(r => ({ ...r, allowedActions: allowedActions(r, user) })) };
  }

  createRevision(slug: string, user: EditorUser): GuideRevision {
    requireRole(user, ['author']);
    const record = this.record(slug);
    if (record.revisions.some(r => !['published', 'withdrawn'].includes(r.state))) {
      throw new EditorialError('Finish or withdraw the open revision before starting another.', 409);
    }
    const base = record.revisions.find(r => r.state === 'published') ?? record.revisions[record.revisions.length - 1];
    const now = this.clock();
    const rev: GuideRevision = {
      rev: Math.max(...record.revisions.map(r => r.rev)) + 1,
      state: 'draft',
      round: 1,
      author: { id: user.id, name: user.name },
      createdAt: now,
      updatedAt: now,
      sections: structuredClone(base.sections),
      translationEdition: { ...base.translationEdition },
      interpretiveTradition: base.interpretiveTradition,
      changeNote: '',
      notes: base.notes,
      reviews: [],
      history: [{ at: now, by: user.id, action: 'create', from: 'draft', to: 'draft' }],
    };
    record.revisions.push(rev);
    this.save();
    return rev;
  }

  edit(
    slug: string,
    revNumber: number,
    user: EditorUser,
    patch: { sections?: unknown; translationEdition?: unknown; interpretiveTradition?: unknown; changeNote?: unknown; notes?: unknown },
  ): GuideRevision {
    requireRole(user, ['author']);
    const rev = this.revision(slug, revNumber);
    if (rev.state !== 'draft') throw new EditorialError('Only drafts can be edited.', 409);
    if (patch.sections && typeof patch.sections === 'object') {
      for (const [section, byLang] of Object.entries(patch.sections as Record<string, unknown>)) {
        if (!(PROSE_SECTIONS as readonly string[]).includes(section) || !byLang || typeof byLang !== 'object') continue;
        for (const [lang, text] of Object.entries(byLang as Record<string, unknown>)) {
          if (!LANGS.includes(lang as Lang) || typeof text !== 'string') continue;
          const id = section as (typeof GUIDE_SECTIONS)[number];
          rev.sections[id] = { ...rev.sections[id], [lang]: text.slice(0, 20_000) };
        }
      }
    }
    if (patch.translationEdition && typeof patch.translationEdition === 'object') {
      for (const [lang, value] of Object.entries(patch.translationEdition as Record<string, unknown>)) {
        if (LANGS.includes(lang as Lang) && typeof value === 'string') rev.translationEdition[lang as Lang] = value.slice(0, 300);
      }
    }
    if (typeof patch.interpretiveTradition === 'string') rev.interpretiveTradition = patch.interpretiveTradition.slice(0, 300);
    if (typeof patch.changeNote === 'string') rev.changeNote = patch.changeNote.slice(0, 1000);
    if (typeof patch.notes === 'string') rev.notes = patch.notes.slice(0, 5000);
    if (rev.author.id === 'catalog') rev.author = { id: user.id, name: user.name };
    rev.updatedAt = this.clock();
    this.save();
    return rev;
  }

  review(slug: string, revNumber: number, user: EditorUser, input: { kind: unknown; decision: unknown; notes: unknown; lang?: unknown }) {
    const rev = this.revision(slug, revNumber);
    const kind = input.kind as ReviewKind;
    if (!['source', 'religious', 'language'].includes(kind)) throw new EditorialError('Unknown review kind', 400);
    if (input.decision !== 'approved' && input.decision !== 'changes-requested') throw new EditorialError('decision must be approved or changes-requested', 400);
    const review = addReview(
      rev,
      user,
      { kind, decision: input.decision, notes: typeof input.notes === 'string' ? input.notes : '', lang: input.lang as Lang | undefined },
      randomUUID(),
      this.clock(),
    );
    this.save();
    return review;
  }

  transition(slug: string, revNumber: number, action: Action, user: EditorUser): GuideRevision {
    const rev = applyTransition(this.record(slug), revNumber, action, user, this.clock());
    this.save();
    return rev;
  }

  addReport(input: { slug: unknown; section: unknown; lang: unknown; message: unknown }): ErrorReport {
    const slug = typeof input.slug === 'string' ? input.slug : '';
    if (!findGuide(slug)) throw new EditorialError('Unknown guide', 400);
    const section = typeof input.section === 'string' && (GUIDE_SECTIONS as readonly string[]).includes(input.section) ? input.section : 'overview';
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!message) throw new EditorialError('Please describe the error.', 400);
    const report: ErrorReport = {
      id: randomUUID(),
      slug,
      section,
      lang: LANGS.includes(input.lang as Lang) ? (input.lang as Lang) : 'en',
      message: message.slice(0, 1500),
      createdAt: this.clock(),
      status: 'open',
    };
    this.data.reports.unshift(report);
    this.data.reports.length = Math.min(this.data.reports.length, MAX_REPORTS);
    this.save();
    return report;
  }

  reports(user: EditorUser): ErrorReport[] {
    requireRole(user, ROLES);
    return this.data.reports;
  }

  resolveReport(id: string, user: EditorUser): ErrorReport {
    requireRole(user, ['author', 'publisher']);
    const report = this.data.reports.find(r => r.id === id);
    if (!report) throw new EditorialError('Report not found', 404);
    report.status = 'resolved';
    this.save();
    return report;
  }
}

function requireRole(user: EditorUser, roles: Role[]) {
  if (!user.roles.some(r => roles.includes(r))) throw new EditorialError(`This action requires the role: ${roles.join(' or ')}.`, 403);
}

/* ---------- Editor accounts ---------- */

export interface EditorAccount extends EditorUser {
  tokenHash: Buffer;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest();

/**
 * Parses EDITORIAL_USERS: a JSON array of {token, id, name, roles, credential?}. Tokens shorter than
 * 24 characters are rejected so a guessable token cannot unlock editorial actions.
 */
export function parseEditorAccounts(raw: string | undefined): EditorAccount[] {
  if (!raw || !raw.trim()) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    throw new Error('EDITORIAL_USERS must be a JSON array');
  }
  if (!Array.isArray(list)) throw new Error('EDITORIAL_USERS must be a JSON array');
  return list.map((entry, i) => {
    const e = entry as Record<string, unknown>;
    const token = typeof e.token === 'string' ? e.token : '';
    if (token.length < 24) throw new Error(`EDITORIAL_USERS[${i}].token must be at least 24 characters`);
    const roles = Array.isArray(e.roles) ? (e.roles.filter(r => ROLES.includes(r as Role)) as Role[]) : [];
    if (!roles.length) throw new Error(`EDITORIAL_USERS[${i}] needs at least one valid role`);
    if (typeof e.id !== 'string' || !e.id || typeof e.name !== 'string' || !e.name) throw new Error(`EDITORIAL_USERS[${i}] needs id and name`);
    return {
      id: e.id,
      name: e.name,
      roles,
      ...(typeof e.credential === 'string' && e.credential ? { credential: e.credential } : {}),
      tokenHash: hashToken(token),
    };
  });
}

export function authenticate(accounts: EditorAccount[], header: string | undefined): EditorUser | null {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  if (!m) return null;
  const candidate = hashToken(m[1].trim());
  for (const account of accounts) {
    if (timingSafeEqual(account.tokenHash, candidate)) {
      const { tokenHash: _hash, ...user } = account;
      return user;
    }
  }
  return null;
}
