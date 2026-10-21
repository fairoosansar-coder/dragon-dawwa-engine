import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, Printer, Save, Sparkles, Trash2 } from 'lucide-react';
import {
  ASSET_CATEGORIES,
  calculateZakah,
  LIABILITY_CATEGORIES,
  WEIGHT_UNITS,
  ZAKAH_ENGINE_VERSION,
  ZAKAH_PROFILES,
  zakatAlFitr,
  type AssetCategory,
  type AssetEntry,
  type HawlAnswer,
  type Issue,
  type LiabilityCategory,
  type LiabilityEntry,
  type RateInput,
  type ResultLine,
  type WeightUnit,
  type ZakahInput,
  type ZakahResult,
} from '../../shared/spiritual/zakah.ts';
import { CURRENCIES } from '../../shared/spiritual/decimal.ts';
import type { ZakahAssist, ZakahExplanation, ZakahSuggestion } from '../../shared/spiritual/assistantTypes.ts';
import { todayIn } from '../../shared/spiritual/calendar.ts';
import { findTopic } from '../../shared/spiritual/catalog.ts';
import { postJson } from '../../lib/api.ts';
import { fmt, type SpKey, type SpStrings } from '../../lib/i18nSpiritual.ts';
import { formatAmount, formatInstant, formatIso, spHref } from '../../lib/spiritualFormat.ts';
import {
  deviceTimeZone,
  downloadText,
  KEYS,
  newId,
  setQuestionPrefill,
  useLocal,
  useSavedCalculations,
  useSp,
} from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Field, inputClass, Panel, PanelTitle, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';
import { SourceList } from '../../components/spiritual/sources.tsx';
import { useSpiritualStatus } from '../../components/spiritual/StudyAssistant.tsx';

const TOTAL_STEPS = 12;
const KARATS = [24, 22, 21, 18, 14, 10, 9];
const MONEY_STEP: Partial<Record<AssetCategory, number>> = { cash: 6, bank: 6, gold: 7, silver: 7, 'trade-inventory': 8, receivables: 8 };
const OTHER_CATEGORIES = ASSET_CATEGORIES.filter(c => !(c in MONEY_STEP));
const stepOfCategory = (c: AssetCategory | LiabilityCategory) => MONEY_STEP[c as AssetCategory] ?? ((LIABILITY_CATEGORIES as string[]).includes(c) ? 10 : 9);

interface Draft {
  step: number;
  ack: boolean;
  profileId: string;
  currency: string;
  valuationDate: string;
  hawl: HawlAnswer | '';
  gold: RateInput;
  silver: RateInput;
  fx: Record<string, RateInput>;
  assets: AssetEntry[];
  liabilities: LiabilityEntry[];
  result: ZakahResult | null;
  fitr: { people: string; perPerson: string; currency: string; authority: string };
}

function localDateTime(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const emptyRate = (): RateInput => ({ value: '', asOf: localDateTime(), source: '', karat: 24 });

function newDraft(): Draft {
  return {
    step: 1,
    ack: false,
    profileId: '',
    currency: 'LKR',
    valuationDate: todayIn(deviceTimeZone()),
    hawl: '',
    gold: emptyRate(),
    silver: emptyRate(),
    fx: {},
    assets: [],
    liabilities: [],
    result: null,
    fitr: { people: '1', perPerson: '', currency: 'LKR', authority: '' },
  };
}

function toInput(d: Draft): ZakahInput {
  const profile = ZAKAH_PROFILES.find(p => p.id === d.profileId);
  // datetime-local values carry no offset; converting here pins them to the device's zone. Invalid values pass through for the engine to report.
  const rate = (r: RateInput): RateInput => {
    const t = Date.parse(r.asOf);
    return { ...r, value: r.value.trim(), asOf: Number.isFinite(t) ? new Date(t).toISOString() : r.asOf, source: r.source.trim() || 'manual' };
  };
  const fx: Record<string, RateInput> = {};
  for (const [code, r] of Object.entries(d.fx)) if (r.value.trim()) fx[code] = rate(r);
  return {
    profileId: d.profileId,
    profileVersion: profile?.version ?? '',
    currency: d.currency,
    valuationDate: d.valuationDate,
    rates: {
      ...(d.gold.value.trim() ? { gold: rate(d.gold) } : {}),
      ...(d.silver.value.trim() ? { silver: rate(d.silver) } : {}),
      ...(Object.keys(fx).length ? { fx } : {}),
    },
    assets: d.assets,
    liabilities: d.liabilities,
    hawl: (d.hawl || '') as HawlAnswer,
  };
}

/** Renders an engine issue in the reader's language, translating the codes it carries as parameters. */
export function issueText(issue: Issue, s: SpStrings): string {
  const tpl = (s as Record<string, string>)[`iss_${issue.code}`] ?? issue.code;
  const params: Record<string, string> = { ...(issue.params ?? {}) };
  const word = (v: string) => (v === 'gold' ? s.zkGold : v === 'silver' ? s.zkSilver : v.startsWith('fx:') ? v.slice(3) : v);
  if (params.rate) params.rate = word(params.rate);
  if (params.metal) params.metal = word(params.metal);
  if (params.category) params.category = (s as Record<string, string>)[`cat_${params.category}`] ?? params.category;
  return fmt(tpl, params);
}

const catName = (s: SpStrings, c: string) => (s as Record<string, string>)[`cat_${c}`] ?? c;

/* ---------- Small pieces ---------- */

function CurrencySelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={e => onChange(e.target.value)}>
      {CURRENCIES.map(c => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

function RateFields({ id, rate, onChange, metal, hint }: { id: string; rate: RateInput; onChange: (r: RateInput) => void; metal: boolean; hint?: string }) {
  const { s } = useSp();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={metal ? (id === 'gold' ? s.zkGoldPrice : s.zkSilverPrice) : s.zkAmount} htmlFor={`${id}-v`} hint={hint}>
        <input id={`${id}-v`} inputMode="decimal" className={inputClass} value={rate.value} onChange={e => onChange({ ...rate, value: e.target.value })} />
      </Field>
      {metal && (
        <Field label={s.zkPriceKarat} htmlFor={`${id}-k`}>
          <select id={`${id}-k`} className={inputClass} value={rate.karat ?? 24} onChange={e => onChange({ ...rate, karat: Number(e.target.value) })}>
            {KARATS.map(k => (
              <option key={k} value={k}>
                {k}K
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={s.zkAsOf} htmlFor={`${id}-t`}>
        <input id={`${id}-t`} type="datetime-local" className={inputClass} value={rate.asOf} onChange={e => onChange({ ...rate, asOf: e.target.value })} />
      </Field>
      <Field label={s.zkRateSource} htmlFor={`${id}-s`}>
        <input
          id={`${id}-s`}
          className={inputClass}
          value={rate.source}
          placeholder={s.zkRateSourcePlaceholder}
          maxLength={120}
          onChange={e => onChange({ ...rate, source: e.target.value })}
        />
      </Field>
    </div>
  );
}

function AssetEditor({
  categories,
  draft,
  update,
  kind,
}: {
  categories: AssetCategory[];
  draft: Draft;
  update: (fn: (d: Draft) => Draft) => void;
  kind: 'money' | 'metal' | 'other';
}) {
  const { s } = useSp();
  const [adding, setAdding] = useState<AssetCategory>(categories[0]);
  const entries = draft.assets.filter(a => categories.includes(a.category));
  const patch = (id: string, p: Partial<AssetEntry>) => update(d => ({ ...d, assets: d.assets.map(a => (a.id === id ? { ...a, ...p } : a)), result: null }));
  const remove = (id: string) => update(d => ({ ...d, assets: d.assets.filter(a => a.id !== id), result: null }));
  const add = () =>
    update(d => ({
      ...d,
      result: null,
      assets: [...d.assets, kind === 'metal' ? { id: newId(), category: adding, weight: '', unit: 'g', karat: 22 } : { id: newId(), category: adding, amount: '' }],
    }));
  const sameLabel = (e: AssetEntry) => {
    const key = (e.label ?? '').trim().toLowerCase();
    return key !== '' && draft.assets.some(o => o.id !== e.id && (o.label ?? '').trim().toLowerCase() === key);
  };

  return (
    <div className="space-y-3">
      {entries.length === 0 && <p className="text-sm text-ink/60">{s.zkNoEntries}</p>}
      {entries.map(e => (
        <fieldset key={e.id} className="rounded-2xl border border-emerald/10 bg-ivory/60 p-4">
          <legend className="px-1 text-sm font-semibold text-emerald">{catName(s, e.category)}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={s.zkLabel} htmlFor={`${e.id}-l`}>
              <input id={`${e.id}-l`} className={inputClass} maxLength={80} value={e.label ?? ''} onChange={ev => patch(e.id, { label: ev.target.value })} />
            </Field>
            {kind === 'metal' ? (
              <>
                <Field label={s.zkWeight} htmlFor={`${e.id}-w`}>
                  <input id={`${e.id}-w`} inputMode="decimal" className={inputClass} value={e.weight ?? ''} onChange={ev => patch(e.id, { weight: ev.target.value })} />
                </Field>
                <Field label={s.zkUnit} htmlFor={`${e.id}-u`}>
                  <select id={`${e.id}-u`} className={inputClass} value={e.unit ?? 'g'} onChange={ev => patch(e.id, { unit: ev.target.value as WeightUnit })}>
                    {(Object.keys(WEIGHT_UNITS) as WeightUnit[]).map(u => (
                      <option key={u} value={u}>
                        {s[`unit_${u}` as SpKey]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={s.zkKarat} htmlFor={`${e.id}-k`}>
                  <select id={`${e.id}-k`} className={inputClass} value={e.karat ?? 24} onChange={ev => patch(e.id, { karat: Number(ev.target.value) })}>
                    {KARATS.map(k => (
                      <option key={k} value={k}>
                        {k}K
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label={s.zkAmount} htmlFor={`${e.id}-a`}>
                  <input id={`${e.id}-a`} inputMode="decimal" className={inputClass} value={e.amount ?? ''} onChange={ev => patch(e.id, { amount: ev.target.value })} />
                </Field>
                <Field label={s.zkEntryCurrency} htmlFor={`${e.id}-c`}>
                  <CurrencySelect id={`${e.id}-c`} value={e.currency ?? draft.currency} onChange={v => patch(e.id, { currency: v === draft.currency ? undefined : v })} />
                </Field>
              </>
            )}
            <div className="flex items-end">
              <SpButton variant="danger" onClick={() => remove(e.id)} aria-label={`${s.remove}: ${catName(s, e.category)}`}>
                <Trash2 className="h-4 w-4" aria-hidden /> {s.remove}
              </SpButton>
            </div>
          </div>
          {kind === 'other' && (
            <p className="mt-2 text-xs text-gilt-deep">{e.category === 'personal-property' ? s.zkNotCounted : s.zkNeedsSpecialist}</p>
          )}
          {sameLabel(e) && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(e.distinctConfirmed)} onChange={ev => patch(e.id, { distinctConfirmed: ev.target.checked })} />
              {s.zkDistinct}
            </label>
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        {categories.length > 1 && (
          <select aria-label={s.zkAddEntry} className={`${inputClass} w-auto`} value={adding} onChange={e => setAdding(e.target.value as AssetCategory)}>
            {categories.map(c => (
              <option key={c} value={c}>
                {catName(s, c)}
              </option>
            ))}
          </select>
        )}
        <SpButton variant="soft" onClick={add}>
          + {categories.length > 1 ? s.zkAddEntry : `${s.zkAddEntry}: ${catName(s, categories[0])}`}
        </SpButton>
      </div>
    </div>
  );
}

function LiabilityEditor({ draft, update }: { draft: Draft; update: (fn: (d: Draft) => Draft) => void }) {
  const { s } = useSp();
  const [adding, setAdding] = useState<LiabilityCategory>('debts-due-now');
  const patch = (id: string, p: Partial<LiabilityEntry>) =>
    update(d => ({ ...d, liabilities: d.liabilities.map(a => (a.id === id ? { ...a, ...p } : a)), result: null }));
  return (
    <div className="space-y-3">
      {draft.liabilities.length === 0 && <p className="text-sm text-ink/60">{s.zkNoEntries}</p>}
      {draft.liabilities.map(e => (
        <fieldset key={e.id} className="rounded-2xl border border-emerald/10 bg-ivory/60 p-4">
          <legend className="px-1 text-sm font-semibold text-emerald">{catName(s, e.category)}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={s.zkLabel} htmlFor={`${e.id}-l`}>
              <input id={`${e.id}-l`} className={inputClass} maxLength={80} value={e.label ?? ''} onChange={ev => patch(e.id, { label: ev.target.value })} />
            </Field>
            <Field label={s.zkAmount} htmlFor={`${e.id}-a`}>
              <input id={`${e.id}-a`} inputMode="decimal" className={inputClass} value={e.amount} onChange={ev => patch(e.id, { amount: ev.target.value })} />
            </Field>
            <Field label={s.zkEntryCurrency} htmlFor={`${e.id}-c`}>
              <CurrencySelect id={`${e.id}-c`} value={e.currency ?? draft.currency} onChange={v => patch(e.id, { currency: v === draft.currency ? undefined : v })} />
            </Field>
            <div className="flex items-end">
              <SpButton variant="danger" onClick={() => update(d => ({ ...d, liabilities: d.liabilities.filter(x => x.id !== e.id), result: null }))}>
                <Trash2 className="h-4 w-4" aria-hidden /> {s.remove}
              </SpButton>
            </div>
          </div>
          {e.category === 'long-term-debt' && <p className="mt-2 text-xs text-gilt-deep">{s.zkNeedsSpecialist}</p>}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <select aria-label={s.zkAddEntry} className={`${inputClass} w-auto`} value={adding} onChange={e => setAdding(e.target.value as LiabilityCategory)}>
          {LIABILITY_CATEGORIES.map(c => (
            <option key={c} value={c}>
              {catName(s, c)}
            </option>
          ))}
        </select>
        <SpButton variant="soft" onClick={() => update(d => ({ ...d, result: null, liabilities: [...d.liabilities, { id: newId(), category: adding, amount: '' }] }))}>
          + {s.zkAddEntry}
        </SpButton>
      </div>
    </div>
  );
}

/* ---------- AI entry suggestions ---------- */

function AssistPanel({ draft, update }: { draft: Draft; update: (fn: (d: Draft) => Draft) => void }) {
  const { s, lang } = useSp();
  const status = useSpiritualStatus();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ZakahAssist | null>(null);
  const [added, setAdded] = useState<number[]>([]);

  if (status.data && !status.data.ai) return <Callout tone="info">{s.zkAssistOff}</Callout>;

  async function go() {
    setBusy(true);
    setError(null);
    setAdded([]);
    try {
      setData(await postJson<ZakahAssist>('/api/spiritual/zakah/assist', { text, lang }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function accept(sg: ZakahSuggestion, i: number) {
    const currency = sg.currency && CURRENCIES.includes(sg.currency) && sg.currency !== draft.currency ? sg.currency : undefined;
    update(d => {
      if (sg.kind === 'liability') {
        return { ...d, result: null, liabilities: [...d.liabilities, { id: newId(), category: sg.category as LiabilityCategory, label: sg.label, amount: sg.amount ?? '', currency }] };
      }
      const metal = sg.category === 'gold' || sg.category === 'silver';
      const unit = sg.unit && Object.hasOwn(WEIGHT_UNITS, sg.unit) ? (sg.unit as WeightUnit) : 'g';
      const entry: AssetEntry = metal
        ? { id: newId(), category: sg.category as AssetCategory, label: sg.label, weight: sg.weight ?? '', unit, karat: sg.karat ?? 24 }
        : { id: newId(), category: sg.category as AssetCategory, label: sg.label, amount: sg.amount ?? '', currency };
      return { ...d, result: null, assets: [...d.assets, entry] };
    });
    setAdded(a => [...a, i]);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/70">{s.zkAssistHint}</p>
      <label htmlFor="zk-assist" className="sr-only">
        {s.zkAssistTitle}
      </label>
      <textarea id="zk-assist" rows={3} maxLength={1500} className={inputClass} placeholder={s.zkAssistPlaceholder} value={text} onChange={e => setText(e.target.value)} />
      <p className="text-xs text-ink/55">{s.zkAssistDisclosure}</p>
      <SpButton variant="soft" disabled={busy || !text.trim()} onClick={go}>
        <Sparkles className="h-4 w-4" aria-hidden /> {busy ? s.loading : s.zkAssistGo}
      </SpButton>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {data && (
        <div className="space-y-3" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-lapis">{s.aiNote}</p>
          {data.discarded > 0 && <Callout tone="caution">{fmt(s.zkAssistDiscarded, { n: data.discarded })}</Callout>}
          <ul className="space-y-2">
            {data.suggestions.map((sg, i) => (
              <li key={i} className="rounded-2xl border border-lapis/15 bg-lapis/5 p-3 text-sm">
                <p className="font-semibold text-emerald">{catName(s, sg.category)}</p>
                <p>
                  {sg.label}
                  {sg.amount && ` · ${sg.amount}${sg.currency ? ` ${sg.currency}` : ''}`}
                  {sg.weight && ` · ${sg.weight} ${sg.unit ?? 'g'}${sg.karat ? ` · ${sg.karat}K` : ''}`}
                </p>
                <p className="mt-1 text-xs text-ink/60">{fmt(s.zkAssistQuote, { quote: sg.quote })}</p>
                <SpButton variant={added.includes(i) ? 'ghost' : 'soft'} className="mt-2" disabled={added.includes(i)} onClick={() => accept(sg, i)}>
                  {added.includes(i) ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden /> {s.zkAssistAdded}
                    </>
                  ) : (
                    s.zkAssistAdd
                  )}
                </SpButton>
              </li>
            ))}
          </ul>
          {data.followUpQuestions.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-emerald">{s.zkAssistFollowUp}</p>
              <ul className="ml-5 list-disc text-sm">
                {data.followUpQuestions.map(q => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {data.terms.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-emerald">{s.zkAssistTerms}</p>
              <dl className="text-sm">
                {data.terms.map(t => (
                  <div key={t.term} className="mt-1">
                    <dt className="font-medium">{t.term}</dt>
                    <dd className="text-ink/75">{t.explanation}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Result ---------- */

function Lines({ title, lines, currency, showReason }: { title: string; lines: ResultLine[]; currency: string; showReason?: boolean }) {
  const { s, lang } = useSp();
  if (!lines.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-emerald">{title}</h3>
      <ul className="divide-y divide-emerald/10 rounded-2xl border border-emerald/10 bg-white">
        {lines.map(l => (
          <li key={l.entryId} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block font-medium">{l.label || catName(s, l.category)}</span>
              {l.label && <span className="block text-xs text-ink/55">{catName(s, l.category)}</span>}
              {l.basis && <span className="block font-mono text-xs text-ink/55">{l.basis}</span>}
              {showReason && l.reason && <span className="block text-xs text-gilt-deep">{(s as Record<string, string>)[l.reason] ?? l.reason}</span>}
            </span>
            {l.value && <span className="font-mono tabular-nums">{formatAmount(lang, l.value, currency)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResultView({ result, actions }: { result: ZakahResult; actions?: ReactNode }) {
  const { s, lang } = useSp();
  const cur = result.currency;
  const row = (label: string, value: ReactNode) => (
    <div className="flex flex-wrap justify-between gap-2 py-1.5">
      <dt className="text-ink/70">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
  const statusText =
    result.status === 'below-nisab'
      ? s.zkBelowNisab
      : result.status === 'hawl-incomplete'
        ? s.zkHawlIncomplete
        : result.status === 'hawl-unresolved'
          ? s.zkHawlUnresolved
          : null;
  const hawlLabel = { yes: s.zkHawlYes, no: s.zkHawlNo, unsure: s.zkHawlUnsure }[result.hawl] ?? '';
  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-emerald px-5 py-6 text-ivory">
        <p className="text-sm text-ivory/80">{result.status === 'due' ? s.zkDue : s.zkNotDue}</p>
        <p className="mt-1 font-display text-4xl font-bold tabular-nums">{formatAmount(lang, result.zakahDue, cur)}</p>
        {statusText && <p className="mt-3 text-sm text-ivory/90">{statusText}</p>}
        {result.conditionalAmount && <p className="mt-1 font-display text-2xl font-semibold text-gilt tabular-nums">{formatAmount(lang, result.conditionalAmount, cur)}</p>}
      </div>
      <Callout tone="caution">{s.zkUnreviewed}</Callout>
      <dl className="divide-y divide-emerald/10 text-sm">
        {row(s.zkTotalAssets, formatAmount(lang, result.totals.assets, cur))}
        {row(s.zkTotalLiab, formatAmount(lang, result.totals.liabilities, cur))}
        {row(s.zkNet, formatAmount(lang, result.totals.net, cur))}
        {result.nisab &&
          row(
            s.zkNisab,
            <>
              {formatAmount(lang, result.nisab.threshold, cur)} · {result.nisab.met ? s.zkMet : s.zkNotMet}
              <span className="block text-xs font-normal text-ink/60">
                {fmt(s.zkNisabBasis, { grams: result.nisab.grams, metal: result.nisab.basis === 'gold' ? s.zkGold : s.zkSilver })}
              </span>
            </>,
          )}
        {row(s.zkHawl, hawlLabel)}
        {row(s.zkRate, `${(Number(result.rate) * 100).toString()}%`)}
        {row(s.zkRounding, fmt(s.zkRoundingVal, { n: result.precision }))}
        {row(s.zkCalcDate, formatIso(lang, result.valuationDate))}
        {row(s.zkCalculated, formatInstant(lang, result.calculatedAt))}
      </dl>
      <p className="text-xs text-ink/55">
        {fmt(s.zkEngine, { e: result.engineVersion || ZAKAH_ENGINE_VERSION, id: result.profile.id, v: result.profile.version })} ·{' '}
        {s[result.profile.nameKey as SpKey] ?? result.profile.nameKey} ·{' '}
        {fmt(s.zkProfileReview, { status: result.profile.review.status === 'approved' ? (result.profile.review.reviewer ?? '') : s.zkReviewPending })}
      </p>
      <Lines title={s.zkIncluded} lines={result.included} currency={cur} />
      <Lines title={s.zkExcluded} lines={result.excluded} currency={cur} showReason />
      <Lines title={s.zkLiabApplied} lines={result.liabilitiesApplied} currency={cur} />
      <Lines title={s.zkLiabNotApplied} lines={result.liabilitiesNotApplied} currency={cur} showReason />
      {result.unresolved.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-emerald">{s.zkUnresolved}</h3>
          <ul className="ml-5 list-disc text-sm">
            {result.unresolved.map((i, k) => (
              <li key={k}>{issueText(i, s)}</li>
            ))}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gilt-deep">{s.zkWarnings}</h3>
          <ul className="ml-5 list-disc text-sm">
            {result.warnings.map((i, k) => (
              <li key={k}>{issueText(i, s)}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-emerald">{s.zkAssumptions}</h3>
        <ul className="ml-5 list-disc text-sm">
          {result.assumptions.map(a => (
            <li key={a}>{s[a as SpKey] ?? a}</li>
          ))}
        </ul>
      </div>
      {actions}
      <div className="sp-no-print">
        <h3 className="mb-2 text-sm font-semibold text-emerald">{s.zkSources}</h3>
        <SourceList refs={result.sources} compact />
      </div>
    </div>
  );
}

function ExplainPanel({ result }: { result: ZakahResult }) {
  const { s, lang } = useSp();
  const status = useSpiritualStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ZakahExplanation | null>(null);
  if (!result.ok || !result.status || (status.data && !status.data.ai)) return null;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      setData(
        await postJson<ZakahExplanation>('/api/spiritual/zakah/explain', {
          profileId: result.profile.id,
          profileVersion: result.profile.version,
          status: result.status,
          nisabMet: result.nisab?.met ?? false,
          hawl: result.hawl,
          includedCategories: [...new Set(result.included.map(l => l.category))],
          excluded: result.excluded.map(l => ({ category: l.category, reason: l.reason })),
          liabilitiesNotApplied: [...new Set(result.liabilitiesNotApplied.map(l => l.category))],
          unresolved: [...new Set(result.unresolved.map(i => i.code))],
          lang,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sp-no-print space-y-2 rounded-2xl border border-lapis/15 bg-lapis/5 p-4">
      <SpButton variant="soft" disabled={busy} onClick={go}>
        <Sparkles className="h-4 w-4" aria-hidden /> {busy ? s.zkExplaining : s.zkExplain}
      </SpButton>
      <p className="text-xs text-ink/60">{s.zkExplainDisclosure}</p>
      {error && (
        <p role="alert" className="text-sm text-red-900">
          {error}
        </p>
      )}
      {data && (
        <div aria-live="polite" className="space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-lapis">{s.zkExplainNote}</p>
          {data.paragraphs.map((p, i) => (
            <p key={i} lang={lang} className="leading-relaxed">
              {p}
            </p>
          ))}
          {data.scholarQuestions.length > 0 && (
            <ul className="ml-5 list-disc">
              {data.scholarQuestions.map(q => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FitrPanel({ draft, update }: { draft: Draft; update: (fn: (d: Draft) => Draft) => void }) {
  const { s, lang } = useSp();
  const f = draft.fitr;
  const set = (p: Partial<Draft['fitr']>) => update(d => ({ ...d, fitr: { ...d.fitr, ...p } }));
  const out = f.perPerson.trim() ? zakatAlFitr(Number(f.people), f.perPerson, f.currency) : null;
  return (
    <Panel>
      <PanelTitle sub={s.zfHint}>{s.zfTitle}</PanelTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.zfPeople} htmlFor="zf-people">
          <input id="zf-people" type="number" min={1} max={100} className={inputClass} value={f.people} onChange={e => set({ people: e.target.value })} />
        </Field>
        <Field label={s.zfPerPerson} htmlFor="zf-pp">
          <input id="zf-pp" inputMode="decimal" className={inputClass} value={f.perPerson} onChange={e => set({ perPerson: e.target.value })} />
        </Field>
        <Field label={s.zkCurrency} htmlFor="zf-cur">
          <CurrencySelect id="zf-cur" value={f.currency} onChange={v => set({ currency: v })} />
        </Field>
        <Field label={s.zfAuthority} htmlFor="zf-auth">
          <input id="zf-auth" className={inputClass} maxLength={120} value={f.authority} onChange={e => set({ authority: e.target.value })} />
        </Field>
      </div>
      {out && (
        <p className="mt-4 text-sm" aria-live="polite">
          {'total' in out ? (
            <>
              {s.zfTotal}: <span className="font-display text-2xl font-bold text-emerald tabular-nums">{formatAmount(lang, out.total, f.currency)}</span>
            </>
          ) : (
            <span className="text-red-900">{out.error === 'people-invalid' ? s.zfPeople : (s[`iss_${out.error}` as SpKey] ?? out.error)}</span>
          )}
        </p>
      )}
    </Panel>
  );
}

/* ---------- The wizard ---------- */

export default function ZakahCalculatorView() {
  const { s, lang } = useSp();
  const [stored, setStored] = useLocal<Draft | null>(KEYS.zakahDraft, null, { session: true });
  const draft = stored ?? newDraft();
  const update = (fn: (d: Draft) => Draft) => setStored(prev => fn(prev ?? newDraft()));
  const [, setSaved] = useSavedCalculations();
  const [saveName, setSaveName] = useState('');
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    document.title = `${s.zkTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  const step = draft.step;
  const go = (n: number) => {
    update(d => ({ ...d, step: Math.min(TOTAL_STEPS, Math.max(1, n)) }));
    document.getElementById('zk-step')?.focus();
  };
  const stepTitles = Array.from({ length: TOTAL_STEPS }, (_, i) => s[`zkS${i + 1}` as SpKey]);
  const canAdvance = step === 1 ? draft.ack : step === 2 ? Boolean(draft.profileId) : true;
  const profile = ZAKAH_PROFILES.find(p => p.id === draft.profileId);

  const foreign = useMemo(
    () => [...new Set([...draft.assets, ...draft.liabilities].map(e => e.currency).filter((c): c is string => Boolean(c) && c !== draft.currency))],
    [draft.assets, draft.liabilities, draft.currency],
  );

  function calculate() {
    const result = calculateZakah(toInput(draft), new Date().toISOString());
    update(d => ({ ...d, result, step: 12 }));
  }

  function errorStep(i: Issue): number {
    if (/^(rate|metal-rate|nisab-rate|fx)/.test(i.code)) return 5;
    if (i.code === 'valuation-date-invalid' || i.code === 'currency-unsupported') return i.entryId ? 6 : 3;
    if (i.code === 'hawl-missing') return 4;
    const entry = [...draft.assets, ...draft.liabilities].find(e => e.id === i.entryId);
    return entry ? stepOfCategory(entry.category) : 11;
  }

  function save() {
    if (!draft.result?.ok) return;
    setSaved(list => [
      { id: newId(), name: saveName.trim() || formatIso(lang, draft.valuationDate), savedAt: new Date().toISOString(), input: toInput(draft), result: draft.result! },
      ...list,
    ]);
    setSavedMsg(true);
  }

  function askScholar() {
    const r = draft.result;
    const lines = [
      `${s.zkTitle} — ${profile ? s[profile.nameKey as SpKey] : ''}`,
      r?.status ? `${s.zkResultTitle}: ${r.status === 'due' ? s.zkDue : s.zkNotDue}` : '',
      ...(r?.unresolved ?? []).map(i => `• ${issueText(i, s)}`),
      ...(r?.excluded ?? []).map(l => `• ${catName(s, l.category)}: ${(s as Record<string, string>)[l.reason ?? ''] ?? ''}`),
    ].filter(Boolean);
    setQuestionPrefill({ topic: 'zakah', question: '', context: lines.join('\n') });
    window.location.hash = spHref('questions');
  }

  const r = draft.result;

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref('zakah'), label: findTopic('zakah')!.title[lang] }, { label: s.zkTitle }]} />
      <SectionBand title={s.zkTitle} subtitle={s.zkIntro} topic="zakah" arabic="الزَّكَاة" />

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <nav aria-label={s.zkTitle} className="sp-no-print">
          <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {stepTitles.map((t, i) => {
              const n = i + 1;
              const reachable = n === 1 || (draft.ack && (n === 2 || Boolean(draft.profileId)));
              return (
                <li key={n} className="shrink-0">
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-current={n === step ? 'step' : undefined}
                    onClick={() => go(n)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition disabled:opacity-40 ${n === step ? 'bg-emerald text-ivory' : 'text-emerald hover:bg-emerald/5'}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${n === step ? 'bg-gilt text-emerald-deep' : 'bg-emerald/10'}`}>{n}</span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{t}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          <Panel>
            <p className="text-xs font-semibold uppercase tracking-wider text-gilt-deep">{fmt(s.zkStep, { n: step, total: TOTAL_STEPS })}</p>
            <h2 id="zk-step" tabIndex={-1} className="mb-4 mt-1 font-display text-2xl font-bold text-emerald focus:outline-none">
              {stepTitles[step - 1]}
            </h2>

            {step === 1 && (
              <div className="space-y-3">
                <Callout tone="privacy">{s.zkPrivacy}</Callout>
                <Callout tone="caution">{s.zkUnreviewed}</Callout>
                <Callout tone="info">{s.zkNoPayments}</Callout>
                <label className="flex items-start gap-3 rounded-2xl bg-ivory px-4 py-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={draft.ack} onChange={e => update(d => ({ ...d, ack: e.target.checked }))} />
                  {s.zkAcknowledge}
                </label>
              </div>
            )}

            {step === 2 && (
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm text-ink/70">{s.zkMethodHint}</legend>
                {ZAKAH_PROFILES.map(p => (
                  <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${draft.profileId === p.id ? 'border-emerald bg-emerald/5' : 'border-emerald/15'}`}>
                    <input type="radio" name="zk-profile" className="mt-1" checked={draft.profileId === p.id} onChange={() => update(d => ({ ...d, profileId: p.id, result: null }))} />
                    <span>
                      <span className="block font-semibold text-emerald">{s[p.nameKey as SpKey]}</span>
                      <span className="block text-xs text-ink/60">
                        {p.id} · v{p.version} · {fmt(s.zkProfileReview, { status: p.review.status === 'approved' ? (p.review.reviewer ?? '') : s.zkReviewPending })}
                      </span>
                    </span>
                  </label>
                ))}
                {!draft.profileId && <p className="text-sm text-gilt-deep">{s.zkChooseMethod}</p>}
              </fieldset>
            )}

            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={s.zkDate} hint={s.zkDateHint} htmlFor="zk-date">
                  <input id="zk-date" type="date" className={inputClass} value={draft.valuationDate} onChange={e => update(d => ({ ...d, valuationDate: e.target.value, result: null }))} />
                </Field>
                <Field label={s.zkCurrency} htmlFor="zk-cur">
                  <CurrencySelect id="zk-cur" value={draft.currency} onChange={v => update(d => ({ ...d, currency: v, fitr: { ...d.fitr, currency: v }, result: null }))} />
                </Field>
              </div>
            )}

            {step === 4 && (
              <fieldset>
                <legend className="mb-3 font-medium">{s.zkHawlQ}</legend>
                <div className="flex flex-wrap gap-2">
                  {(['yes', 'no', 'unsure'] as const).map(v => (
                    <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm ${draft.hawl === v ? 'border-emerald bg-emerald text-ivory' : 'border-emerald/20 text-emerald'}`}>
                      <input type="radio" name="zk-hawl" className="sr-only" checked={draft.hawl === v} onChange={() => update(d => ({ ...d, hawl: v, result: null }))} />
                      {{ yes: s.zkHawlYes, no: s.zkHawlNo, unsure: s.zkHawlUnsure }[v]}
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-sm text-ink/65">{s.zkHawlHint}</p>
              </fieldset>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <Callout tone="info">{s.zkRatesHint}</Callout>
                {(['gold', 'silver'] as const).map(m => (
                  <div key={m}>
                    <h3 className="mb-2 font-semibold text-emerald">{m === 'gold' ? s.zkGoldPrice : s.zkSilverPrice}</h3>
                    {profile?.nisab.basis === m && <p className="mb-2 text-xs font-semibold text-gilt-deep">{fmt(s.zkNeededRate, { metal: m === 'gold' ? s.zkGold : s.zkSilver })}</p>}
                    <RateFields id={m} metal rate={draft[m]} onChange={rate => update(d => ({ ...d, [m]: rate, result: null }))} />
                  </div>
                ))}
                <div>
                  <h3 className="mb-1 font-semibold text-emerald">{s.zkFx}</h3>
                  <p className="mb-3 text-sm text-ink/65">{fmt(s.zkFxHint, { cur: draft.currency })}</p>
                  <div className="space-y-4">
                    {[...new Set([...foreign, ...Object.keys(draft.fx)])].map(code => (
                      <div key={code} className="rounded-2xl bg-ivory/60 p-3">
                        <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                          1 {code} = ? {draft.currency}
                          <button
                            type="button"
                            className="text-xs text-red-800"
                            onClick={() =>
                              update(d => {
                                const fx = { ...d.fx };
                                delete fx[code];
                                return { ...d, fx, result: null };
                              })
                            }
                          >
                            {s.remove}
                          </button>
                        </p>
                        <RateFields id={`fx-${code}`} metal={false} rate={draft.fx[code] ?? emptyRate()} onChange={rate => update(d => ({ ...d, fx: { ...d.fx, [code]: rate }, result: null }))} />
                      </div>
                    ))}
                  </div>
                  <select
                    aria-label={s.zkAddFx}
                    className={`${inputClass} mt-3 w-auto`}
                    value=""
                    onChange={e => e.target.value && update(d => ({ ...d, fx: { ...d.fx, [e.target.value]: emptyRate() } }))}
                  >
                    <option value="">+ {s.zkAddFx}</option>
                    {CURRENCIES.filter(c => c !== draft.currency && !(c in draft.fx)).map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 6 && <AssetEditor kind="money" categories={['cash', 'bank']} draft={draft} update={update} />}
            {step === 7 && <AssetEditor kind="metal" categories={['gold', 'silver']} draft={draft} update={update} />}
            {step === 8 && <AssetEditor kind="money" categories={['trade-inventory', 'receivables']} draft={draft} update={update} />}
            {step === 9 && (
              <div className="space-y-3">
                <Callout tone="info">{s.zkOtherHint}</Callout>
                <AssetEditor kind="other" categories={OTHER_CATEGORIES} draft={draft} update={update} />
              </div>
            )}
            {step === 10 && (
              <div className="space-y-3">
                <Callout tone="info">{s.zkLiabHint}</Callout>
                <LiabilityEditor draft={draft} update={update} />
              </div>
            )}

            {step === 11 && (
              <div className="space-y-4 text-sm">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-ivory px-4 py-2">
                    <dt className="text-xs text-ink/60">{s.zkS2}</dt>
                    <dd className="font-medium">{profile ? s[profile.nameKey as SpKey] : '—'}</dd>
                  </div>
                  <div className="rounded-2xl bg-ivory px-4 py-2">
                    <dt className="text-xs text-ink/60">{s.zkS3}</dt>
                    <dd className="font-medium">
                      {formatIso(lang, draft.valuationDate)} · {draft.currency}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-ivory px-4 py-2">
                    <dt className="text-xs text-ink/60">{s.zkHawl}</dt>
                    <dd className="font-medium">{draft.hawl ? { yes: s.zkHawlYes, no: s.zkHawlNo, unsure: s.zkHawlUnsure }[draft.hawl] : '—'}</dd>
                  </div>
                  <div className="rounded-2xl bg-ivory px-4 py-2">
                    <dt className="text-xs text-ink/60">{s.zkS5}</dt>
                    <dd className="font-medium">
                      {s.zkGold}: {draft.gold.value || '—'} · {s.zkSilver}: {draft.silver.value || '—'}
                    </dd>
                  </div>
                </dl>
                <ul className="divide-y divide-emerald/10 rounded-2xl border border-emerald/10">
                  {[...draft.assets, ...draft.liabilities].length === 0 && <li className="px-4 py-3 text-ink/60">{s.zkNoEntries}</li>}
                  {[...draft.assets, ...draft.liabilities].map(e => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <span>
                        <span className="font-medium">{e.label || catName(s, e.category)}</span>
                        {e.label && <span className="ml-2 text-xs text-ink/55">{catName(s, e.category)}</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-xs">
                          {'weight' in e && e.weight ? `${e.weight} ${e.unit ?? 'g'} · ${e.karat ?? 24}K` : `${e.amount ?? ''} ${e.currency ?? draft.currency}`}
                        </span>
                        <button type="button" className="text-xs text-lapis underline" onClick={() => go(stepOfCategory(e.category))}>
                          {s.edit}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <SpButton onClick={calculate}>{s.zkCalculate}</SpButton>
              </div>
            )}

            {step === 12 && !r && (
              <div className="space-y-3">
                <p className="text-sm text-ink/70">{s.zkNoEntries}</p>
                <SpButton onClick={calculate}>{s.zkCalculate}</SpButton>
              </div>
            )}
            {step === 12 && r && !r.ok && (
              <div role="alert" className="space-y-3">
                <h3 className="font-semibold text-red-900">{s.zkErrors}</h3>
                <ul className="space-y-2">
                  {r.errors.map((i, k) => (
                    <li key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-900">
                      {issueText(i, s)}
                      <button type="button" className="text-xs font-semibold underline" onClick={() => go(errorStep(i))}>
                        {stepTitles[errorStep(i) - 1]} →
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {step === 12 && r?.ok && (
              <ResultView
                result={r}
                actions={
                  <div className="sp-no-print space-y-4">
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label={s.zkSaveName} htmlFor="zk-name">
                        <input id="zk-name" className={inputClass} maxLength={80} value={saveName} onChange={e => setSaveName(e.target.value)} />
                      </Field>
                      <SpButton onClick={save}>
                        <Save className="h-4 w-4" aria-hidden /> {s.zkSave}
                      </SpButton>
                    </div>
                    {savedMsg && (
                      <p role="status" className="text-sm text-emerald">
                        {s.zkSaved}{' '}
                        <a className="underline" href={spHref('zakah/calculations')}>
                          {s.scTitle}
                        </a>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <SpButton
                        variant="soft"
                        onClick={() => downloadText(`zakah-${r.valuationDate}.json`, JSON.stringify({ input: toInput(draft), result: r }, null, 2), 'application/json')}
                      >
                        <Download className="h-4 w-4" aria-hidden /> {s.zkExport}
                      </SpButton>
                      <SpButton variant="soft" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" aria-hidden /> {s.zkPrint}
                      </SpButton>
                      <SpButton variant="soft" onClick={askScholar}>
                        {s.zkAskScholar}
                      </SpButton>
                      <SpButton
                        variant="danger"
                        onClick={() => {
                          setStored(null);
                          setSavedMsg(false);
                          setSaveName('');
                        }}
                      >
                        {s.zkStartOver}
                      </SpButton>
                    </div>
                    <ExplainPanel result={r} />
                  </div>
                }
              />
            )}

            <div className="sp-no-print mt-6 flex justify-between gap-2 border-t border-emerald/10 pt-4">
              <SpButton variant="ghost" disabled={step === 1} onClick={() => go(step - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden /> {s.previous}
              </SpButton>
              {step < 11 && (
                <SpButton disabled={!canAdvance} onClick={() => go(step + 1)}>
                  {s.next} <ChevronRight className="h-4 w-4" aria-hidden />
                </SpButton>
              )}
            </div>
          </Panel>

          {step >= 6 && step <= 10 && (
            <Panel className="sp-no-print">
              <PanelTitle as="h3">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-gilt-deep" aria-hidden /> {s.zkAssistTitle}
                </span>
              </PanelTitle>
              <AssistPanel draft={draft} update={update} />
            </Panel>
          )}

          <div className="sp-no-print">
            <FitrPanel draft={draft} update={update} />
          </div>
        </div>
      </div>
    </div>
  );
}
