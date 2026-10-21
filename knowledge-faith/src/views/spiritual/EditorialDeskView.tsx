import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { LogOut } from 'lucide-react';
import { LANGS, type Lang } from '../../shared/sources.ts';
import { ALL_GUIDES, findGuide, PROSE_SECTIONS, type GuideSectionId } from '../../shared/spiritual/catalog.ts';
import type { Action, EditorUser, GuideRevision, PublicationState, ReviewKind } from '../../shared/spiritual/governance.ts';
import { fmt, type SpKey } from '../../lib/i18nSpiritual.ts';
import { formatInstant, spHref } from '../../lib/spiritualFormat.ts';
import { KEYS, useLocal, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Field, inputClass, Panel, PanelTitle, Pill, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';
import { useSpiritualStatus } from '../../components/spiritual/StudyAssistant.tsx';

type Rev = GuideRevision & { allowedActions: Action[] };
interface ListItem {
  slug: string;
  revisions: { rev: number; state: PublicationState; updatedAt: string; allowedActions: Action[] }[];
}
interface Report {
  id: string;
  slug: string;
  section: string;
  lang: Lang;
  message: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

const STAGE_REVIEW: Partial<Record<PublicationState, ReviewKind>> = {
  'source-check': 'source',
  'religious-review': 'religious',
  'language-review': 'language',
};
const REVIEW_ROLE = { source: 'source-checker', religious: 'religious-reviewer', language: 'language-reviewer' } as const;

function useEditorApi(token: string) {
  return useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      const res = await fetch(`/api/editorial${path}`, {
        method: init.method ?? 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? `Request failed (${res.status})`), { status: res.status });
      return body as T;
    },
    [token],
  );
}

function GuideEditor({ slug, user, api, onChanged }: { slug: string; user: EditorUser; api: ReturnType<typeof useEditorApi>; onChanged: () => void }) {
  const { s, lang: uiLang } = useSp();
  const [record, setRecord] = useState<{ slug: string; revisions: Rev[] } | null>(null);
  const [revNo, setRevNo] = useState<number | null>(null);
  const [lang, setLang] = useState<Lang>(uiLang);
  const [form, setForm] = useState<Pick<GuideRevision, 'sections' | 'translationEdition' | 'interpretiveTradition' | 'changeNote' | 'notes'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [review, setReview] = useState<{ decision: 'approved' | 'changes-requested'; notes: string; lang: Lang }>({ decision: 'approved', notes: '', lang: 'en' });
  const def = findGuide(slug)!;

  const load = useCallback(
    async (keepRev?: number) => {
      setError(null);
      try {
        const r = await api<{ slug: string; revisions: Rev[] }>(`/guides/${slug}`);
        setRecord(r);
        const chosen = r.revisions.find(x => x.rev === keepRev) ?? r.revisions[r.revisions.length - 1];
        setRevNo(chosen.rev);
        setForm({
          sections: structuredClone(chosen.sections),
          translationEdition: { ...chosen.translationEdition },
          interpretiveTradition: chosen.interpretiveTradition,
          changeNote: chosen.changeNote,
          notes: chosen.notes,
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [api, slug],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rev = record?.revisions.find(r => r.rev === revNo);
  if (error && !record)
    return (
      <p role="alert" className="text-sm text-red-900">
        {error}
      </p>
    );
  if (!record || !rev || !form) return <p className="text-sm text-ink/60">{s.loading}</p>;

  const editable = rev.state === 'draft' && user.roles.includes('author');
  const stageKind = STAGE_REVIEW[rev.state];
  const canReview = stageKind && user.roles.includes(REVIEW_ROLE[stageKind]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
      await load(rev!.rev);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const setSection = (id: GuideSectionId, text: string) => setForm(f => f && { ...f, sections: { ...f.sections, [id]: { ...f.sections[id], [lang]: text } } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-emerald">{def.guide.title[uiLang]}</h2>
          <p className="text-xs text-ink/60">
            {slug} · {fmt(s.revision, { n: rev.rev })} · {s.edState}: <strong>{s[`state_${rev.state}`]}</strong> · {fmt(s.writtenBy, { name: rev.author.name })}
          </p>
        </div>
        <select aria-label={s.edHistory} className={`${inputClass} w-auto`} value={rev.rev} onChange={e => void load(Number(e.target.value))}>
          {record.revisions.map(r => (
            <option key={r.rev} value={r.rev}>
              {fmt(s.revision, { n: r.rev })} · {s[`state_${r.state}`]}
            </option>
          ))}
        </select>
      </div>

      <Callout tone="info" title={s.edBrief}>
        {def.guide.brief}
      </Callout>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-2xl bg-emerald/10 px-4 py-3 text-sm text-emerald">
          {message}
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-emerald">{s.edActions}</p>
        <div className="flex flex-wrap gap-2">
          {rev.allowedActions.map(a => (
            <SpButton
              key={a}
              variant={a === 'request-changes' || a === 'withdraw' ? 'danger' : 'primary'}
              onClick={() => void run(() => api(`/guides/${slug}/revisions/${rev.rev}/transitions`, { method: 'POST', body: { action: a } }), s[`action_${a}`])}
            >
              {s[`action_${a}`]}
            </SpButton>
          ))}
          {user.roles.includes('author') && (rev.state === 'published' || rev.state === 'withdrawn') && (
            <SpButton variant="soft" onClick={() => void run(() => api(`/guides/${slug}/revisions`, { method: 'POST' }), s.edNewRevision)}>
              {s.edNewRevision}
            </SpButton>
          )}
        </div>
        {rev.allowedActions.length === 0 && <p className="mt-1 text-xs text-ink/60">{s.edNoActions}</p>}
      </div>

      <div role="group" aria-label={s.guideLanguage} className="flex gap-2">
        {LANGS.map(l => (
          <Pill key={l} active={lang === l} onClick={() => setLang(l)}>
            {s[`langName_${l}`]}
          </Pill>
        ))}
      </div>

      <div className="space-y-4">
        {PROSE_SECTIONS.map(id => (
          <Field key={id} label={s[`sec_${id}` as SpKey]} htmlFor={`ed-${id}`}>
            {editable ? (
              <textarea
                id={`ed-${id}`}
                lang={lang}
                rows={id === 'steps' || id === 'faq' ? 8 : 4}
                maxLength={20000}
                className={inputClass}
                value={form.sections[id]?.[lang] ?? ''}
                onChange={e => setSection(id, e.target.value)}
              />
            ) : (
              <p id={`ed-${id}`} lang={lang} className="min-h-10 whitespace-pre-wrap rounded-xl bg-ivory/60 px-3 py-2 text-sm">
                {rev.sections[id]?.[lang] || '—'}
              </p>
            )}
          </Field>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={fmt(s.edTranslationEdition, { lang: s[`langName_${lang}`] })} htmlFor="ed-edition">
            <input
              id="ed-edition"
              disabled={!editable}
              maxLength={300}
              className={inputClass}
              value={form.translationEdition[lang] ?? ''}
              onChange={e => setForm(f => f && { ...f, translationEdition: { ...f.translationEdition, [lang]: e.target.value } })}
            />
          </Field>
          <Field label={s.edTradition} htmlFor="ed-tradition">
            <input
              id="ed-tradition"
              disabled={!editable}
              maxLength={300}
              className={inputClass}
              value={form.interpretiveTradition}
              onChange={e => setForm(f => f && { ...f, interpretiveTradition: e.target.value })}
            />
          </Field>
        </div>
        <Field label={s.edChangeNote} htmlFor="ed-change">
          <input id="ed-change" disabled={!editable} maxLength={1000} className={inputClass} value={form.changeNote} onChange={e => setForm(f => f && { ...f, changeNote: e.target.value })} />
        </Field>
        <Field label={s.edNotes} htmlFor="ed-notes">
          <textarea id="ed-notes" disabled={!editable} rows={3} maxLength={5000} className={inputClass} value={form.notes} onChange={e => setForm(f => f && { ...f, notes: e.target.value })} />
        </Field>
        {editable && (
          <SpButton onClick={() => void run(() => api(`/guides/${slug}/revisions/${rev.rev}`, { method: 'PATCH', body: form }), s.edSaved)}>{s.edSaveDraft}</SpButton>
        )}
      </div>

      {canReview && stageKind && (
        <form
          className="space-y-3 rounded-2xl border border-lapis/20 bg-lapis/5 p-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run(
              () =>
                api(`/guides/${slug}/revisions/${rev.rev}/reviews`, {
                  method: 'POST',
                  body: { kind: stageKind, decision: review.decision, notes: review.notes, ...(stageKind === 'language' ? { lang: review.lang } : {}) },
                }),
              s.edRecord,
            ).then(() => setReview(r => ({ ...r, notes: '' })));
          }}
        >
          <p className="font-semibold text-emerald">
            {s.edReview}: {s[`review_${stageKind}`]}
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill active={review.decision === 'approved'} onClick={() => setReview(r => ({ ...r, decision: 'approved' }))}>
              {s.edApprove}
            </Pill>
            <Pill active={review.decision === 'changes-requested'} onClick={() => setReview(r => ({ ...r, decision: 'changes-requested' }))}>
              {s.edRequestChanges}
            </Pill>
            {stageKind === 'language' && (
              <select aria-label={s.guideLanguage} className={`${inputClass} w-auto`} value={review.lang} onChange={e => setReview(r => ({ ...r, lang: e.target.value as Lang }))}>
                {LANGS.map(l => (
                  <option key={l} value={l}>
                    {s[`langName_${l}`]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Field label={s.edReviewNotes} htmlFor="ed-review-notes">
            <textarea id="ed-review-notes" rows={3} maxLength={2000} className={inputClass} value={review.notes} onChange={e => setReview(r => ({ ...r, notes: e.target.value }))} />
          </Field>
          <SpButton type="submit">{s.edRecord}</SpButton>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-emerald">{s.edReviews}</p>
          {rev.reviews.length === 0 ? (
            <p className="text-sm text-ink/60">{s.notReviewedYet}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rev.reviews.map(r => (
                <li key={r.id} className="rounded-xl bg-ivory/70 px-3 py-2">
                  <span className="font-medium">
                    {s[`review_${r.kind}`]}
                    {r.lang ? ` (${s[`langName_${r.lang}`]})` : ''} · {r.decision === 'approved' ? s.edApprove : s.edRequestChanges}
                  </span>
                  <span className="block text-xs text-ink/60">
                    {r.reviewer.name}
                    {r.reviewer.credential ? ` — ${r.reviewer.credential}` : ''} · {formatInstant(uiLang, r.date)} · #{r.round}
                  </span>
                  {r.notes && <span className="mt-1 block whitespace-pre-wrap text-xs">{r.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-emerald">{s.edHistory}</p>
          <ol className="space-y-1 text-xs text-ink/70">
            {rev.history.map((h, i) => (
              <li key={i}>
                {formatInstant(uiLang, h.at)} · {h.by} · {h.action} ({s[`state_${h.from}`]} → {s[`state_${h.to}`]})
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Reports({ api }: { api: ReturnType<typeof useEditorApi> }) {
  const { s, lang } = useSp();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Report[]>('/reports')
      .then(setReports)
      .catch((e: Error) => setError(e.message));
  }, [api]);
  useEffect(load, [load]);
  if (error) return <p role="alert" className="text-sm text-red-900">{error}</p>;
  if (!reports) return <p className="text-sm text-ink/60">{s.loading}</p>;
  if (!reports.length) return <p className="text-sm text-ink/60">{s.edNoReports}</p>;
  return (
    <ul className="space-y-2">
      {reports.map(r => (
        <li key={r.id} className={`rounded-2xl px-4 py-3 text-sm ${r.status === 'open' ? 'bg-vellum' : 'bg-ivory/50 text-ink/60'}`}>
          <p className="text-xs text-ink/60">
            {findGuide(r.slug)?.guide.title[lang] ?? r.slug} · {s[`sec_${r.section}` as SpKey] ?? r.section} · {s[`langName_${r.lang}`]} · {formatInstant(lang, r.createdAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{r.message}</p>
          {r.status === 'open' && (
            <SpButton
              variant="soft"
              className="mt-2"
              onClick={() =>
                api(`/reports/${r.id}/resolve`, { method: 'POST' })
                  .then(load)
                  .catch((e: Error) => setError(e.message))
              }
            >
              {s.edResolve}
            </SpButton>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function EditorialDeskView() {
  const { s, lang } = useSp();
  const status = useSpiritualStatus();
  const [token, setToken] = useLocal<string>(KEYS.editorToken, '', { session: true });
  const api = useEditorApi(token);
  const [draftToken, setDraftToken] = useState('');
  const [user, setUser] = useState<EditorUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'guides' | 'reports'>('guides');
  const [list, setList] = useState<ListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    document.title = `${s.edTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    api<EditorUser>('/me')
      .then(u => {
        setUser(u);
        setError(null);
      })
      .catch((e: Error & { status?: number }) => {
        setError(e.message);
        if (e.status === 401) setToken('');
      });
  }, [token, api, setToken]);

  const loadList = useCallback(() => {
    api<ListItem[]>('/guides')
      .then(setList)
      .catch((e: Error) => setError(e.message));
  }, [api]);
  useEffect(() => {
    if (user) loadList();
  }, [user, loadList]);

  const rows = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    return (list ?? [])
      .map(item => ({ item, def: findGuide(item.slug), latest: item.revisions[item.revisions.length - 1] }))
      .filter(r => r.def && (!needle || `${r.item.slug} ${r.def.guide.title[lang]}`.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => ALL_GUIDES.findIndex(g => g.guide.slug === a.item.slug) - ALL_GUIDES.findIndex(g => g.guide.slug === b.item.slug));
  }, [list, filter, lang]);

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setToken(draftToken.trim());
    setDraftToken('');
  };

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { label: s.edTitle }]} />
      <SectionBand title={s.edTitle}>
        {user && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-ivory/90">
            <span>
              {user.name} · {fmt(s.edRoles, { roles: user.roles.map(r => s[`role_${r}`]).join(', ') })}
            </span>
            <button type="button" onClick={() => setToken('')} className="inline-flex items-center gap-1 rounded-full bg-ivory/15 px-3 py-1 hover:bg-ivory/25">
              <LogOut className="h-4 w-4" aria-hidden /> {s.edSignOut}
            </button>
          </div>
        )}
      </SectionBand>

      {status.data && !status.data.editorial ? (
        <Callout tone="info">{s.edNotConfigured}</Callout>
      ) : !user ? (
        <Panel className="max-w-lg">
          <PanelTitle as="h3">{s.edSignIn}</PanelTitle>
          <form onSubmit={signIn} className="space-y-3">
            <Field label={s.edToken} htmlFor="ed-token">
              <input id="ed-token" type="password" autoComplete="off" className={inputClass} value={draftToken} onChange={e => setDraftToken(e.target.value)} />
            </Field>
            <SpButton type="submit" disabled={!draftToken.trim()}>
              {s.edSignInBtn}
            </SpButton>
            {error && (
              <p role="alert" className="text-sm text-red-900">
                {error}
              </p>
            )}
          </form>
        </Panel>
      ) : (
        <div>
          <div role="tablist" className="mb-4 flex gap-2">
            <Pill active={tab === 'guides'} onClick={() => setTab('guides')}>
              {s.edGuides}
            </Pill>
            <Pill active={tab === 'reports'} onClick={() => setTab('reports')}>
              {s.edReports}
            </Pill>
          </div>
          {tab === 'reports' ? (
            <Panel>
              <Reports api={api} />
            </Panel>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
              <Panel>
                <label htmlFor="ed-filter" className="sr-only">
                  {s.edFilter}
                </label>
                <input id="ed-filter" type="search" className={inputClass} placeholder={s.edFilter} value={filter} onChange={e => setFilter(e.target.value)} />
                <ul className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto">
                  {rows.map(({ item, def, latest }) => (
                    <li key={item.slug}>
                      <button
                        type="button"
                        aria-current={selected === item.slug}
                        onClick={() => setSelected(item.slug)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm ${selected === item.slug ? 'bg-emerald text-ivory' : 'hover:bg-emerald/5'}`}
                      >
                        <span className="block font-medium">{def!.guide.title[lang]}</span>
                        <span className="block text-xs opacity-70">
                          {s[`state_${latest.state}`]}
                          {latest.allowedActions.length > 0 && ' · •'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel>
                {selected ? (
                  <GuideEditor key={selected} slug={selected} user={user} api={api} onChanged={loadList} />
                ) : (
                  <p className="text-sm text-ink/60">{s.edFilter}</p>
                )}
              </Panel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
