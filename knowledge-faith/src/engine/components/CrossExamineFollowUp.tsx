import { useMemo, useState, type FormEvent } from 'react';
import { MessageSquareQuote, Send } from 'lucide-react';
import { postJson } from '../../lib/api.ts';
import type { Lang } from '../../shared/sources.ts';

export interface CrossExamineSource {
  id?: string;
  label: string;
  text?: string;
  url?: string;
}

interface FollowUpTurn {
  id: string;
  at: string;
  userCounterArgument: string;
  reply: string;
  provider: string;
}

interface FollowUpResponse {
  dossierId: string;
  turn: FollowUpTurn;
  thread: { turns: FollowUpTurn[] };
}

const CHIPS = [
  'Isn’t this historically contingent?',
  'How is this universal for all humanity?',
  'Doesn’t modern science contradict this?',
  'Where is the Hikmah in this ruling?',
] as const;

export function CrossExamineFollowUp(props: {
  dossierId: string;
  originalQuestion: string;
  previousSynthesis: string;
  openedSources: CrossExamineSource[];
  language: Lang;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<FollowUpTurn[]>([]);

  const canSubmit = useMemo(() => draft.trim().length >= 3 && !busy && Boolean(props.dossierId), [draft, busy, props.dossierId]);

  async function submit(text: string) {
    const counter = text.trim();
    if (counter.length < 3 || busy || !props.dossierId) return;
    setBusy(true);
    setError(null);
    try {
      const body = await postJson<FollowUpResponse>('/api/research/followup', {
        dossierId: props.dossierId,
        originalQuestion: props.originalQuestion,
        previousSynthesis: props.previousSynthesis,
        openedSources: props.openedSources,
        userCounterArgument: counter,
        language: props.language,
      });
      setTurns(body.thread?.turns?.length ? body.thread.turns : [...turns, body.turn]);
      setDraft('');
    } catch (err) {
      setError((err as Error).message || 'Follow-up failed.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(draft);
  }

  return (
    <section
      data-testid="cross-examine-followup"
      className="rounded-2xl border border-[#D4AF37]/45 bg-gradient-to-br from-[#041B14] via-[#0A2E23] to-[#073C30] p-4 text-[#F7F1E4] shadow-[0_0_24px_rgba(212,175,55,0.12)]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/50 bg-[#0B4B3A] text-[#E6C665]">
          <MessageSquareQuote className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-base font-semibold tracking-tight text-[#F9E7B9]">Cross-Examine / Follow-Up</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#D6D3D1]">
            Challenge the synthesis with Hikmah. The mentor steel-mans your objection and answers only from opened sources.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map(chip => (
          <button
            key={chip}
            type="button"
            disabled={busy}
            onClick={() => void submit(chip)}
            className="rounded-full border border-[#D4AF37]/40 bg-[#F7F1E4]/10 px-3 py-1.5 text-[11px] font-medium text-[#F9E7B9] hover:bg-[#D4AF37]/20 disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3" aria-live="polite">
        {turns.map(turn => (
          <div key={turn.id} className="space-y-2 rounded-xl border border-[#D4AF37]/25 bg-black/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#E6C665]">Your challenge</p>
            <p className="text-sm text-[#F7F1E4]">{turn.userCounterArgument}</p>
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-[#A7F3D0]">Mentor reply</p>
            <p className="text-sm leading-relaxed text-[#E7E5E4]">{turn.reply}</p>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`followup-${props.dossierId}`}>
          Counter-argument
        </label>
        <input
          id={`followup-${props.dossierId}`}
          value={draft}
          maxLength={1200}
          disabled={busy}
          onChange={event => setDraft(event.target.value)}
          placeholder="Steel-man a doubt or press a new claim…"
          className="flex-1 rounded-xl border border-[#D4AF37]/35 bg-[#F7F1E4]/95 px-4 py-2.5 text-sm text-[#073C30] placeholder:text-[#073C30]/50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-[#041B14] hover:bg-[#E6C665] disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
          {busy ? 'Replying…' : 'Send'}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  );
}
