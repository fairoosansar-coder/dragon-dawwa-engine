import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, FileCheck, History, Sparkles } from 'lucide-react';
import { postJson } from '../lib/api.ts';
import type { Lang } from '../shared/sources.ts';
import { PROGRAMME_FAMILIES } from '../shared/studio/catalogue.ts';
import type {
  PresentationFormat,
  ProgrammeFamilyId,
  StudioEpisode,
  StudioSegment,
} from '../shared/studio/contracts.ts';
import type { StudioTransitionAction } from '../shared/studio/verification.ts';

export function EditorialProductionDesk({
  episode,
  lang,
  onEpisodeUpdated,
}: {
  episode: StudioEpisode;
  lang: Lang;
  onEpisodeUpdated: (next: StudioEpisode) => void;
}) {
  const [topic, setTopic] = useState('');
  const [familyId, setFamilyId] = useState<ProgrammeFamilyId>('research-room');
  const [format, setFormat] = useState<PresentationFormat>('explanatory_dialogue');
  const [learningObjective, setLearningObjective] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(4);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [dossierNotes, setDossierNotes] = useState<{
    examined: string[];
    notExamined: string[];
    unanswered: string[];
    disagreements: string[];
  } | null>(null);

  const [editingSegIndex, setEditingSegIndex] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [editorialToken, setEditorialToken] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  async function handleRunPipeline(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || pipelineBusy) return;
    setPipelineBusy(true);
    setPipelineError(null);
    setActionNotice(null);
    try {
      const res = await postJson<{
        episode: StudioEpisode;
        dossierSummary: {
          examined: string[];
          notExamined: string[];
          unanswered: string[];
          disagreements: string[];
        };
      }>('/api/studio/pipeline/run', {
        topic: topic.trim(),
        familyId,
        format,
        learningObjective: learningObjective.trim(),
        durationMinutes,
        lang,
      });
      setDossierNotes(res.dossierSummary);
      onEpisodeUpdated(res.episode);
      setActionNotice(
        `Pipeline complete: assembled ${res.episode.segments.length} segments from ${res.episode.passages.length} retrieved passage(s). Episode is in "${res.episode.editorialState}" state (never auto-published).`,
      );
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Production pipeline failed.');
    } finally {
      setPipelineBusy(false);
    }
  }

  async function handleSaveSegmentEdit(segIndex: number) {
    if (actionBusy) return;
    setActionBusy(true);
    setActionNotice(null);
    setPipelineError(null);
    try {
      const nextSegments: StudioSegment[] = episode.segments.map((s, idx) =>
        idx === segIndex ? { ...s, text: editedText } : s,
      );
      const res = await fetch(`/api/studio/productions/${encodeURIComponent(episode.id)}/script`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: episode.lang,
          segments: nextSegments,
          editorName: 'Studio Script Editor',
          changeNote: changeNote.trim() || `Edited segment #${segIndex + 1}`,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to save script edit');
      const updated = body as StudioEpisode;
      onEpisodeUpdated(updated);
      setEditingSegIndex(null);
      setChangeNote('');
      setActionNotice(
        `Saved Revision #${updated.currentRevision}. Prior approval and narration were automatically invalidated; state is now "${updated.editorialState}".`,
      );
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Script edit failed.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleTransition(action: StudioTransitionAction) {
    if (actionBusy) return;
    setActionBusy(true);
    setActionNotice(null);
    setPipelineError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (editorialToken.trim()) {
        headers.Authorization = `Bearer ${editorialToken.trim()}`;
      }
      const res = await fetch(`/api/studio/productions/${encodeURIComponent(episode.id)}/transition`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lang: episode.lang,
          action,
          notes: `Editorial transition: ${action}`,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Transition refused');
      const updated = body as StudioEpisode;
      onEpisodeUpdated(updated);
      setActionNotice(`Episode transitioned to "${updated.editorialState}" (Revision #${updated.currentRevision}).`);
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Editorial transition failed.');
    } finally {
      setActionBusy(false);
    }
  }

  const v = episode.verification;

  return (
    <section
      aria-label="Editorial and Script Production Studio"
      data-testid="editorial-production-desk"
      className="space-y-6 rounded-3xl border border-pine/20 bg-white p-4 sm:p-6"
    >
      <div className="border-b border-pine/10 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">
          Editorial Studio & Production Workflow
        </p>
        <h3 className="mt-1 font-display text-2xl font-bold text-pine">
          Topic Brief → Dossier → Outline → Script → Verification → Editorial Review
        </h3>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Every episode is built from retrieved evidence passages. Generated episodes are never published automatically, and editing any script line after approval immediately invalidates prior approval and narration.
        </p>
      </div>

      {/* Current Episode Editorial Status & 7-Point Verification Matrix */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-pine/15 bg-sand/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-pine">
              Active Episode Governance
            </span>
            <span
              data-testid="editorial-state-badge"
              className="rounded-full bg-pine px-3 py-1 text-xs font-bold uppercase tracking-wider text-sand"
            >
              State: {episode.editorialState} · Rev #{episode.currentRevision}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white p-2.5">
              <dt className="text-muted">Approval Valid</dt>
              <dd data-testid="approval-valid-status" className="mt-0.5 font-semibold text-ink">
                {episode.approvalValid ? `Yes (Rev #${episode.approvedRevision})` : 'Invalidated / Pending'}
              </dd>
            </div>
            <div className="rounded-xl bg-white p-2.5">
              <dt className="text-muted">Narration Valid</dt>
              <dd data-testid="narration-valid-status" className="mt-0.5 font-semibold text-ink">
                {episode.narrationValid ? `Matches Rev #${episode.narratedRevision}` : 'Not recorded / Invalidated'}
              </dd>
            </div>
            <div className="rounded-xl bg-white p-2.5">
              <dt className="text-muted">Public Status</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {episode.published ? 'Published' : 'Unpublished (Editorial)'}
              </dd>
            </div>
            <div className="rounded-xl bg-white p-2.5">
              <dt className="text-muted">Format</dt>
              <dd className="mt-0.5 font-semibold text-ink">{episode.format.replace(/_/g, ' ')}</dd>
            </div>
          </dl>

          {/* Editorial transition controls */}
          <div className="mt-4 space-y-2 border-t border-pine/10 pt-3">
            <p className="text-xs font-semibold text-pine">Editorial Actions</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleTransition('submit-for-review')}
                className="min-h-9 rounded-full border border-pine/25 bg-white px-3 py-1 text-xs font-semibold text-pine hover:border-pine"
              >
                Submit for Review
              </button>
              <button
                type="button"
                disabled={actionBusy}
                data-testid="approve-script-btn"
                onClick={() => void handleTransition('approve-script')}
                className="min-h-9 rounded-full bg-pine px-3 py-1 text-xs font-semibold text-sand hover:bg-moss"
              >
                Approve Script Revision
              </button>
              <button
                type="button"
                disabled={actionBusy}
                data-testid="record-narration-btn"
                onClick={() => void handleTransition('record-narration')}
                className="min-h-9 rounded-full border border-pine/25 bg-white px-3 py-1 text-xs font-semibold text-pine hover:border-pine"
              >
                Mark Narration Recorded
              </button>
              <button
                type="button"
                disabled={actionBusy}
                data-testid="publish-episode-btn"
                onClick={() => void handleTransition('publish-episode')}
                className="min-h-9 rounded-full border border-gold bg-gold/20 px-3 py-1 text-xs font-semibold text-ink hover:bg-gold/30"
              >
                Publish (Requires Publisher Token)
              </button>
            </div>
            <input
              type="password"
              value={editorialToken}
              onChange={e => setEditorialToken(e.target.value)}
              placeholder="Optional publisher Bearer token (for authorized publication)"
              className="mt-1 block w-full rounded-xl border border-pine/20 bg-white px-3 py-1.5 text-xs text-ink"
            />
          </div>
        </div>

        {/* 7-Point Verification Checklist */}
        <div className="rounded-2xl border border-pine/15 bg-sand/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pine">
              <FileCheck className="h-4 w-4" aria-hidden="true" />
              Automated Claim & Citation Verification
            </span>
            <span
              data-testid="verification-supported-badge"
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                v.supported ? 'bg-mint text-pine' : 'bg-red-100 text-red-900'
              }`}
            >
              {v.supported ? 'All Checks Passed' : 'Attention Needed'}
            </span>
          </div>

          <ul className="mt-3 space-y-1.5 text-xs">
            {[
              { label: 'Every citation resolves to retrieved material', ok: v.allCitationsResolve },
              { label: 'Quotations match the cited edition verbatim', ok: v.quotationsMatchEdition },
              { label: 'Claims are supported by cited passage wording', ok: v.claimsSupported },
              { label: 'Translation edition and source language identified', ok: v.languagesIdentified },
              { label: 'Published hadith grades and attributions preserved', ok: v.gradesPreserved },
              { label: 'Scientific limitations represented where applicable', ok: v.scientificLimitationsRepresented },
              { label: 'Narration corresponds to approved script revision', ok: v.narrationMatchesApprovedRevision },
            ].map(item => (
              <li key={item.label} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5">
                <span className="text-ink">{item.label}</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  {item.ok ? (
                    <span className="inline-flex items-center gap-1 text-pine">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Unverified
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">{v.note}</p>
        </div>
      </div>

      {actionNotice && (
        <div
          role="status"
          data-testid="editorial-action-notice"
          className="rounded-2xl border border-pine/30 bg-mint/70 px-4 py-3 text-xs font-medium text-pine"
        >
          {actionNotice}
        </div>
      )}
      {pipelineError && (
        <div
          role="alert"
          data-testid="editorial-action-error"
          className="rounded-2xl border border-red-900/30 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
        >
          {pipelineError}
        </div>
      )}

      {/* Script Revision Editor & Revision History */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-2xl border border-pine/15 bg-sand/40 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-pine">
            Script Segments · Inline Revision Editor
          </h4>
          <p className="mt-1 text-xs text-muted">
            Editing any segment creates a new script revision and invalidates prior approval and narration.
          </p>
          <ol className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
            {episode.segments.map((seg, idx) => (
              <li key={seg.id} className="rounded-xl border border-pine/10 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-pine">
                    #{idx + 1} · {seg.sectionLabel} ({seg.speakerName})
                  </span>
                  <button
                    type="button"
                    data-testid={`edit-segment-btn-${idx}`}
                    onClick={() => {
                      setEditingSegIndex(idx);
                      setEditedText(seg.text);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 font-semibold text-pine hover:bg-pine hover:text-sand"
                  >
                    <Edit3 className="h-3 w-3" aria-hidden="true" /> Edit
                  </button>
                </div>
                {editingSegIndex === idx ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={3}
                      value={editedText}
                      data-testid={`edit-segment-textarea-${idx}`}
                      onChange={e => setEditedText(e.target.value)}
                      className="w-full rounded-xl border border-pine/30 bg-sand/50 p-2 text-xs text-ink"
                    />
                    <input
                      type="text"
                      value={changeNote}
                      onChange={e => setChangeNote(e.target.value)}
                      placeholder="Revision note (e.g. Refined opening reflection)"
                      className="w-full rounded-xl border border-pine/20 bg-white px-2.5 py-1.5 text-xs text-ink"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        data-testid={`save-segment-edit-btn-${idx}`}
                        onClick={() => void handleSaveSegmentEdit(idx)}
                        className="rounded-full bg-pine px-3 py-1 font-semibold text-sand"
                      >
                        Save Revision
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSegIndex(null)}
                        className="rounded-full border border-pine/20 bg-white px-3 py-1 font-semibold text-pine"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 line-clamp-2 text-ink/85">{seg.text}</p>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-pine/15 bg-sand/40 p-4">
          <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pine">
            <History className="h-4 w-4" aria-hidden="true" />
            Revision History ({episode.revisions.length})
          </h4>
          <ul data-testid="revision-history-list" className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
            {episode.revisions.map(rev => (
              <li key={`${rev.revision}-${rev.updatedAt}`} className="rounded-xl border border-pine/10 bg-white p-3">
                <div className="flex items-center justify-between font-semibold text-pine">
                  <span>Revision #{rev.revision} · {rev.state}</span>
                  <span className="font-mono text-[10px] text-muted">{rev.contentHash}</span>
                </div>
                <p className="mt-1 text-ink/85">{rev.changeNote}</p>
                <p className="mt-1 text-[11px] text-muted">
                  By {rev.updatedBy} · {rev.verificationSupported ? 'Verified' : 'Needs Review'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* New Topic Brief Production Pipeline Form */}
      <form onSubmit={handleRunPipeline} className="space-y-4 border-t border-pine/15 pt-5">
        <h4 className="font-display text-lg font-bold text-pine">
          Produce a New Episode from a Topic Brief
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-pine sm:col-span-2">
            Topic or Listener Question
            <input
              type="text"
              value={topic}
              maxLength={280}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Mercy and forgiveness in Surah Az-Zumar 39:53"
              className="min-h-10 rounded-xl border border-pine/20 bg-sand/50 px-3 py-2 text-sm font-normal text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-pine">
            Programme Family
            <select
              value={familyId}
              onChange={e => setFamilyId(e.target.value as ProgrammeFamilyId)}
              className="min-h-10 rounded-xl border border-pine/20 bg-sand/50 px-3 py-2 text-sm font-normal text-ink"
            >
              {PROGRAMME_FAMILIES.map(f => (
                <option key={f.id} value={f.id}>
                  {f.channelNumber} · {f.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-pine">
            Presentation Format
            <select
              value={format}
              onChange={e => setFormat(e.target.value as PresentationFormat)}
              className="min-h-10 rounded-xl border border-pine/20 bg-sand/50 px-3 py-2 text-sm font-normal text-ink"
            >
              <option value="single_presenter">Single Presenter (Sakinah)</option>
              <option value="explanatory_dialogue">Explanatory Dialogue (Sakinah & Tariq)</option>
              <option value="introduced_recording">Introduction Around Original Recording</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-pine">
            Target Duration (minutes)
            <select
              value={String(durationMinutes)}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              className="min-h-10 rounded-xl border border-pine/20 bg-sand/50 px-3 py-2 text-sm font-normal text-ink"
            >
              {[2, 3, 4, 5, 8].map(m => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-pine">
            Learning Objective (optional)
            <input
              type="text"
              value={learningObjective}
              maxLength={240}
              onChange={e => setLearningObjective(e.target.value)}
              placeholder="What the listener will understand"
              className="min-h-10 rounded-xl border border-pine/20 bg-sand/50 px-3 py-2 text-sm font-normal text-ink"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pipelineBusy || !topic.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-pine px-5 py-2 text-sm font-semibold text-sand hover:bg-moss disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
          {pipelineBusy ? 'Running Dossier & Script Pipeline…' : 'Run Production Pipeline'}
        </button>

        {dossierNotes && (
          <div className="mt-3 rounded-2xl border border-pine/15 bg-sand/60 p-3 text-xs text-ink/85">
            <p className="font-semibold text-pine">Research Dossier Coverage Log</p>
            {dossierNotes.examined.map((line, i) => (
              <p key={i} className="mt-1">• {line}</p>
            ))}
          </div>
        )}
      </form>
    </section>
  );
}
