import { useEffect, useState } from 'react';
import { Copy, Download, Save, Trash2 } from 'lucide-react';
import { TOPICS } from '../../shared/spiritual/catalog.ts';
import { formatInstant, spHref } from '../../lib/spiritualFormat.ts';
import { downloadText, newId, useQuestionPrefill, useQuestions, useSp, type QuestionDraft } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Field, inputClass, Panel, PanelTitle, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';

type Form = Omit<QuestionDraft, 'id' | 'updatedAt'>;
const EMPTY: Form = { topic: '', question: '', context: '', school: '' };

export default function QuestionsView() {
  const { s, lang } = useSp();
  const [drafts, setDrafts] = useQuestions();
  const [prefill, setPrefill] = useQuestionPrefill();
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${s.qTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  useEffect(() => {
    if (!prefill) return;
    setForm({ ...EMPTY, topic: prefill.topic, question: prefill.question, context: prefill.context });
    setEditing(null);
    setPrefill(null);
  }, [prefill, setPrefill]);

  const topicName = (id: string) => TOPICS.find(t => t.id === id)?.title[lang] ?? s.qGeneral;
  const asText = () => {
    const lines = [`${s.qTopic}: ${topicName(form.topic)}`];
    if (form.school.trim()) lines.push(`${s.qSchool}: ${form.school.trim()}`);
    lines.push('', `${s.qQuestion}:`, form.question.trim());
    if (form.context.trim()) lines.push('', `${s.qContext}:`, form.context.trim());
    return lines.join('\n');
  };

  function save() {
    const now = new Date().toISOString();
    if (editing) setDrafts(list => list.map(d => (d.id === editing ? { ...d, ...form, updatedAt: now } : d)));
    else {
      const id = newId();
      setDrafts(list => [{ id, ...form, updatedAt: now }, ...list]);
      setEditing(id);
    }
    setStatus(s.qDraftSaved);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText());
      setStatus(s.copied);
    } catch {
      setStatus(null);
    }
  }

  const set = (p: Partial<Form>) => {
    setForm(f => ({ ...f, ...p }));
    setStatus(null);
  };
  const empty = !form.question.trim();

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { label: s.qTitle }]} />
      <SectionBand title={s.qTitle} topic="new-muslim" />
      <div className="mb-6">
        <Callout tone="caution">{s.qNotSent}</Callout>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.qTopic} htmlFor="q-topic">
                <select id="q-topic" className={inputClass} value={form.topic} onChange={e => set({ topic: e.target.value })}>
                  <option value="">{s.qGeneral}</option>
                  {TOPICS.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title[lang]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={s.qSchool} htmlFor="q-school">
                <input id="q-school" className={inputClass} maxLength={80} value={form.school} onChange={e => set({ school: e.target.value })} />
              </Field>
            </div>
            <Field label={s.qQuestion} htmlFor="q-question">
              <textarea
                id="q-question"
                rows={5}
                maxLength={3000}
                className={inputClass}
                placeholder={s.qQuestionPlaceholder}
                value={form.question}
                onChange={e => set({ question: e.target.value })}
              />
            </Field>
            <Field label={s.qContext} htmlFor="q-context">
              <textarea
                id="q-context"
                rows={5}
                maxLength={5000}
                className={inputClass}
                placeholder={s.qContextPlaceholder}
                value={form.context}
                onChange={e => set({ context: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SpButton disabled={empty} onClick={save}>
                <Save className="h-4 w-4" aria-hidden /> {s.qSaveDraft}
              </SpButton>
              <SpButton variant="soft" disabled={empty} onClick={copy}>
                <Copy className="h-4 w-4" aria-hidden /> {s.copy}
              </SpButton>
              <SpButton variant="soft" disabled={empty} onClick={() => downloadText('question-for-a-scholar.txt', asText())}>
                <Download className="h-4 w-4" aria-hidden /> {s.qDownload}
              </SpButton>
              <SpButton
                variant="ghost"
                onClick={() => {
                  setForm(EMPTY);
                  setEditing(null);
                  setStatus(null);
                }}
              >
                {s.qNew}
              </SpButton>
            </div>
            {status && (
              <p role="status" className="text-sm text-emerald">
                {status}
              </p>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelTitle as="h3">{s.qDrafts}</PanelTitle>
          {drafts.length === 0 ? (
            <p className="text-sm text-ink/60">{s.qNoDrafts}</p>
          ) : (
            <ul className="space-y-2">
              {drafts.map(d => (
                <li key={d.id} className={`rounded-2xl px-4 py-3 text-sm ${editing === d.id ? 'bg-emerald/10 ring-1 ring-emerald/30' : 'bg-ivory/70'}`}>
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => {
                      setForm({ topic: d.topic, question: d.question, context: d.context, school: d.school });
                      setEditing(d.id);
                      setStatus(null);
                    }}
                  >
                    <span className="block text-xs text-ink/55">
                      {topicName(d.topic)} · {formatInstant(lang, d.updatedAt)}
                    </span>
                    <span className="mt-1 line-clamp-2 block font-medium">{d.question || '—'}</span>
                  </button>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-red-800"
                    onClick={() => {
                      setDrafts(list => list.filter(x => x.id !== d.id));
                      if (editing === d.id) setEditing(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> {s.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
