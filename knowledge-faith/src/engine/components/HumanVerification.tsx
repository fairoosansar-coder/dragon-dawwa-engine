import { useEffect, useState } from 'react';
import {
  OUTCOME_LABEL,
  REVIEW_STATUS_LABEL,
  type ReviewOutcome,
  type ReviewRole,
  type ReviewStatus,
} from '../../shared/research/revision.ts';

export interface ShownReview {
  role: ReviewRole;
  reviewerName: string;
  qualification: string;
  organisation: string;
  outcome: ReviewOutcome;
  notes: string;
  submittedAt: string;
  revision: string;
}

export interface ShownRevision {
  revision: string;
  reviews: ShownReview[];
}

export interface ShownHumanReview {
  status: ReviewStatus;
  statusLabel: string;
  revision: string;
  reviews: ShownReview[];
  history: ShownRevision[];
  digitalReviewAvailable: boolean;
  viewer: { name: string; canSubmitSources: boolean; canSubmitFindings: boolean } | null;
}

let latest: ShownHumanReview | null = null;

export function latestHumanReview(): ShownHumanReview | null {
  return latest;
}

const DECLARATION: Record<ReviewRole, string> = {
  sources: 'I have reviewed the source references, quotations, translations and their relevance to this report. Any limitations or required corrections are recorded in my review notes.',
  findings: 'I have reviewed the findings, interpretations and conclusions against the cited evidence, including the representation of scholarly differences and unresolved issues. Any limitations or required corrections are recorded in my review notes.',
};

const PANEL: Record<ReviewRole, string> = {
  sources: 'Reviewer 1 — Sources & Evidence',
  findings: 'Reviewer 2 — Findings & Interpretation',
};

function formatWhen(iso: string): string {
  if (!iso) return 'Not recorded on this dossier';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded on this dossier';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date) + ' Gulf (UTC+4)';
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="hr-sign-field">
      <span className="hr-block-label">{label}</span>
      <span className="hr-sign-value" lang="und">{value || ' '}</span>
    </p>
  );
}

function SignatureLines({ signedAt }: { signedAt?: string }) {
  return (
    <>
      <p className="hr-block-label">Signature</p>
      <div className="hr-sign-line hr-sign-hand" />
      <p className="hr-sign-note">Handwritten signature on a printed copy. A name recorded after sign-in is an authenticated review record, not a cryptographic digital signature.</p>
      <p className="hr-block-label">Date signed</p>
      {signedAt ? <p className="hr-sign-value">{formatWhen(signedAt)}</p> : <div className="hr-sign-line hr-sign-date" />}
    </>
  );
}

function PanelView({
  role,
  review,
  canSubmit,
  reviewerName,
  busy,
  error,
  onSubmit,
}: {
  role: ReviewRole;
  review?: ShownReview;
  canSubmit: boolean;
  reviewerName: string;
  busy: boolean;
  error: string;
  onSubmit: (role: ReviewRole, body: { qualification: string; organisation: string; outcome: ReviewOutcome; notes: string }) => void;
}) {
  const [qualification, setQualification] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [outcome, setOutcome] = useState<ReviewOutcome | ''>('');
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);

  return (
    <article className="hr-sign-panel" data-testid={`signoff-panel-${role}`}>
      <h3>{PANEL[role]}</h3>
      {review ? (
        <>
          <Field label="Full name" value={review.reviewerName} />
          <Field label="Qualification / relevant expertise" value={review.qualification} />
          <Field label="Organisation or affiliation, if applicable" value={review.organisation || 'Not stated'} />
          <Field label="Review outcome" value={OUTCOME_LABEL[review.outcome]} />
          <Field label="Review notes / required corrections" value={review.notes || 'None recorded.'} />
          <p className="hr-sign-note">Authenticated review record for {review.revision}. This is human review of this report, not a cryptographic digital signature, a scholarly consensus, or a fatwa.</p>
          <SignatureLines signedAt={review.submittedAt} />
        </>
      ) : (
        <>
          <Field label="Full name" value="" />
          <Field label="Qualification / relevant expertise" value="" />
          <Field label="Organisation or affiliation, if applicable" value="" />
          <Field label="Review outcome" value="" />
          <Field label="Review notes / required corrections" value="" />
          <p className="hr-sign-declaration">{DECLARATION[role]}</p>
          <SignatureLines />
          {canSubmit && (
            <form
              className="hr-sign-form screen-only"
              onSubmit={event => {
                event.preventDefault();
                if (!outcome) return;
                onSubmit(role, { qualification, organisation, outcome, notes });
              }}
            >
              <p className="hr-sign-note">Signed in as {reviewerName}. The full name recorded is this account’s name.</p>
              <label>
                Qualification / relevant expertise
                <input value={qualification} onChange={event => setQualification(event.target.value)} required maxLength={300} />
              </label>
              <label>
                Organisation or affiliation, if applicable
                <input value={organisation} onChange={event => setOrganisation(event.target.value)} maxLength={300} />
              </label>
              <label>
                Review outcome
                <select value={outcome} onChange={event => setOutcome(event.target.value as ReviewOutcome)} required>
                  <option value="">Select an outcome</option>
                  <option value="approved">Approved</option>
                  <option value="approved_with_corrections">Approved with corrections</option>
                  <option value="revision_required">Revision required</option>
                </select>
              </label>
              <label>
                Review notes / required corrections
                <textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={4000} rows={4} />
              </label>
              <label className="hr-sign-check">
                <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} required />
                <span>{DECLARATION[role]}</span>
              </label>
              <button type="submit" disabled={busy || !accepted}>{busy ? 'Submitting review…' : 'Submit review'}</button>
              {error && <p className="hr-sign-error" role="alert">{error}</p>}
            </form>
          )}
        </>
      )}
    </article>
  );
}

export function HumanVerification({
  jobId,
  question,
  reportId,
  revision,
  language,
  languageLabel,
  generatedAt,
  onStatus,
}: {
  jobId?: string;
  question: string;
  reportId: string;
  revision: string;
  language: string;
  languageLabel: string;
  generatedAt: string;
  onStatus?: (label: string) => void;
}) {
  const [remote, setRemote] = useState<ShownHumanReview | null>(null);
  const [token, setToken] = useState('');
  const [draftToken, setDraftToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const statusLabel = remote?.revision === revision ? remote.statusLabel : REVIEW_STATUS_LABEL.awaiting;

  useEffect(() => {
    onStatus?.(statusLabel);
  }, [onStatus, statusLabel]);

  useEffect(() => {
    const stored = sessionStorage.getItem('dd-reviewer-token') || '';
    setToken(stored);
  }, []);

  useEffect(() => {
    if (!jobId) {
      latest = null;
      setRemote(null);
      return;
    }
    const controller = new AbortController();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`/api/reports/${encodeURIComponent(jobId)}/review?lang=${encodeURIComponent(language)}`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Review status could not be loaded.');
        return body as ShownHumanReview;
      })
      .then(body => {
        latest = body;
        setRemote(body);
        setError('');
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        latest = null;
        setError(err instanceof Error ? err.message : 'Review status could not be loaded.');
      });
    return () => controller.abort();
  }, [jobId, language, revision, token]);

  const matching = remote?.revision === revision ? remote : null;
  const viewer = matching?.viewer ?? null;

  const submit = (role: ReviewRole, body: { qualification: string; organisation: string; outcome: ReviewOutcome; notes: string }) => {
    if (!jobId || !token) return;
    setBusy(true);
    setError('');
    fetch(`/api/reports/${encodeURIComponent(jobId)}/review?lang=${encodeURIComponent(language)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, role, lang: language, declarationAccepted: true }),
    })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'The review was not recorded.');
        latest = payload as ShownHumanReview;
        setRemote(payload as ShownHumanReview);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The review was not recorded.'))
      .finally(() => setBusy(false));
  };

  const reviewFor = (role: ReviewRole) => matching?.reviews.find(review => review.role === role);

  return (
    <section id="hr-section-signoff" data-testid="human-verification" data-status={matching?.status ?? 'awaiting'}>
      <div className="hr-signoff-sheet">
        <h2>Human Verification &amp; Sign-off</h2>
        <div className="hr-signoff-rule" aria-hidden="true" />
        <p className="hr-prose">This section records human review of the identified report version. AI-generated findings are not human-approved until the required reviewers have completed their reviews.</p>
        <dl className="hr-sign-meta">
          <div><dt>Research question</dt><dd lang={language}>{question}</dd></div>
          <div><dt>Report ID</dt><dd>{reportId}</dd></div>
          <div><dt>Report revision</dt><dd>{revision}</dd></div>
          <div><dt>Report language</dt><dd>{languageLabel}</dd></div>
          <div><dt>Report generation date</dt><dd>{formatWhen(generatedAt)}</dd></div>
          <div><dt>Verification status</dt><dd data-testid="signoff-status">{statusLabel}</dd></div>
        </dl>
        <p className="hr-sign-note">This status describes human review of this report. It is not a universal scholarly consensus and it is not an official fatwa. One review is not final approval. Approved with corrections leaves corrections outstanding. Revision required stays in force until this revision is replaced and both reviewers approve the new revision.</p>
        <div className="hr-sign-grid">
          {(['sources', 'findings'] as const).map(role => (
            <PanelView
              key={role}
              role={role}
              review={reviewFor(role)}
              canSubmit={Boolean(viewer && (role === 'sources' ? viewer.canSubmitSources : viewer.canSubmitFindings) && !reviewFor(role))}
              reviewerName={viewer?.name ?? ''}
              busy={busy}
              error={error}
              onSubmit={submit}
            />
          ))}
        </div>
        {!matching?.digitalReviewAvailable && jobId && (
          <p className="hr-sign-note hr-sign-unconfigured">Authenticated review is not configured on this server. Use the signature and date lines above when this report is printed. A handwritten signature is not a cryptographic digital signature.</p>
        )}
        <footer className="hr-footer">
          <span>Dragon Dawwa · By Aegis Intelligence</span>
          <span>{reportId}</span>
          <span>{revision}</span>
          <span className="hr-review">Machine-assisted research. Not a published scholarly certification. Printing or downloading this report does not change its verification status.</span>
        </footer>
      </div>
      {matching?.digitalReviewAvailable && (
        <details className="hr-reviewer-signin screen-only">
          <summary>Reviewer sign-in</summary>
          <form
            onSubmit={event => {
              event.preventDefault();
              sessionStorage.setItem('dd-reviewer-token', draftToken.trim());
              setToken(draftToken.trim());
            }}
          >
            <label>
              Reviewer access token
              <input type="password" value={draftToken} onChange={event => setDraftToken(event.target.value)} autoComplete="current-password" />
            </label>
            <button type="submit">Sign in</button>
            {token && (
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('dd-reviewer-token');
                  setToken('');
                  setDraftToken('');
                }}
              >
                Sign out
              </button>
            )}
          </form>
          <p className="hr-sign-note">Submission controls appear only after an authorised reviewer account signs in. Readers can see the review status and the details a reviewer has submitted.</p>
        </details>
      )}
      {error && !viewer && <p className="hr-sign-error screen-only" role="alert">{error}</p>}
      {matching && matching.history.length > 0 && (
        <div className="hr-signoff-history" data-testid="signoff-history">
          <h3>Previous review history</h3>
          <p className="hr-sign-note">These reviews belong to earlier revisions. They do not approve the current revision.</p>
          {matching.history.map(item => (
            <article key={item.revision}>
              <p><strong>{item.revision}</strong></p>
              {item.reviews.map(review => (
                <p key={`${item.revision}-${review.role}`}>
                  {PANEL[review.role]}: {review.reviewerName} — {OUTCOME_LABEL[review.outcome]}. {review.notes}
                </p>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function humanVerificationMarkdown(input: {
  question: string;
  reportId: string;
  revision: string;
  languageLabel: string;
  generatedAt: string;
}): string {
  const review = latest;
  const status = review?.revision === input.revision ? review.statusLabel : REVIEW_STATUS_LABEL.awaiting;
  const lines = [
    '',
    '## Human Verification & Sign-off',
    '',
    'This section records human review of the identified report version. AI-generated findings are not human-approved until the required reviewers have completed their reviews.',
    '',
    `- Research question: ${input.question}`,
    `- Report ID: ${input.reportId}`,
    `- Report revision: ${input.revision}`,
    `- Report language: ${input.languageLabel}`,
    `- Report generation date: ${input.generatedAt || 'Not recorded on this dossier'}`,
    `- Verification status: ${status}`,
    '',
    'This status is human review of this report. It is not a scholarly consensus and it is not a fatwa.',
    '',
  ];
  for (const role of ['sources', 'findings'] as const) {
    const item = review?.revision === input.revision ? review.reviews.find(entry => entry.role === role) : undefined;
    lines.push(`### ${PANEL[role]}`, '');
    lines.push(`- Full name: ${item?.reviewerName ?? ''}`);
    lines.push(`- Qualification / relevant expertise: ${item?.qualification ?? ''}`);
    lines.push(`- Organisation or affiliation, if applicable: ${item?.organisation ?? ''}`);
    lines.push(`- Review outcome: ${item ? OUTCOME_LABEL[item.outcome] : ''}`);
    lines.push(`- Review notes / required corrections: ${item?.notes ?? ''}`);
    lines.push(`- Signature: ${item ? 'Authenticated review record (not a cryptographic digital signature)' : ''}`);
    lines.push(`- Date signed: ${item?.submittedAt ?? ''}`, '');
    lines.push(DECLARATION[role], '');
  }
  return lines.join('\n');
}
