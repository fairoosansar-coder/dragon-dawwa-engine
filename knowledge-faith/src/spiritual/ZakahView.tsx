import { useMemo, useState } from 'react';
import { postJson } from '../lib/api.ts';
import { useStored } from '../lib/store.tsx';
import { ZAKAH_PROFILE } from './zakahProfile.ts';
import { calculateZakah, type ZakahAssetInput, type ZakahInput, type ZakahSuccess, type ZakahSuggestion } from './zakah.ts';
import { Banner, Field, PageBack, Panel, control, reasonText, useSp } from './chrome.tsx';

const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'INR', 'MYR'];
const CATEGORIES = [...ZAKAH_PROFILE.enabled, ...ZAKAH_PROFILE.specialist, 'zakat_al_fitr'];

interface Row {
  id: string;
  category: string;
  label: string;
  amount: string;
  currency: string;
  fx: string;
  weight: string;
  unit: 'g' | 'oz';
  purityMode: 'karat' | 'fineness';
  purity: string;
}

interface Liability {
  id: string;
  label: string;
  amount: string;
}

interface SavedCalc {
  id: string;
  at: string;
  input: ZakahInput;
  result: ZakahSuccess;
}

function blankRow(): Row {
  return { id: crypto.randomUUID(), category: 'cash', label: '', amount: '', currency: '', fx: '', weight: '', unit: 'g', purityMode: 'karat', purity: '24' };
}

function toInput(row: Row, base: string): ZakahAssetInput {
  const metal = row.category === 'gold' || row.category === 'silver';
  return {
    id: row.id,
    category: row.category,
    dedupeKey: row.label.trim(),
    amount: metal ? undefined : row.amount,
    currency: row.currency || base,
    manualFx: row.currency && row.currency !== base ? row.fx : undefined,
    weight: metal ? row.weight : undefined,
    weightUnit: metal ? row.unit : undefined,
    purityMode: metal ? row.purityMode : undefined,
    purity: metal ? row.purity : undefined,
  };
}

export function ZakahCalculator({ segments }: { segments: string[] }) {
  const { s, config } = useSp();
  const [currency, setCurrency] = useState('LKR');
  const [valuationDate, setValuationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priceDate, setPriceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gold, setGold] = useState('');
  const [silver, setSilver] = useState('');
  const [acceptStale, setAcceptStale] = useState(false);
  const [hawl, setHawl] = useState<ZakahInput['hawl']>('unknown');
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<ZakahSuccess | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useStored<SavedCalc[]>('kf-zakah-saves', []);
  const [description, setDescription] = useState('');
  const [suggestion, setSuggestion] = useState<ZakahSuggestion | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const input = useMemo<ZakahInput>(
    () => ({
      currency,
      valuationDate,
      goldPricePerGram: gold || undefined,
      silverPricePerGram: silver || undefined,
      priceEnteredOn: priceDate,
      acceptStale,
      hawl,
      assets: rows.map(row => toInput(row, currency)),
      liabilities: liabilities.map(item => ({ id: item.id, dedupeKey: item.label.trim(), amount: item.amount })),
    }),
    [currency, valuationDate, gold, silver, priceDate, acceptStale, hawl, rows, liabilities],
  );

  function calculate() {
    const next = calculateZakah(input);
    if (!next.ok) {
      setResult(null);
      setErrors(next.errors);
      return;
    }
    setErrors([]);
    setResult(next);
  }

  async function suggest() {
    setAiBusy(true);
    setAiError(null);
    try {
      setSuggestion(await postJson<ZakahSuggestion>('/api/spiritual/zakah-draft', { description }));
    } catch (error) {
      setSuggestion(null);
      setAiError((error as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  function addSuggested(category: string) {
    setRows(current => [...current, { ...blankRow(), category }]);
  }

  function save() {
    if (!result || !ack) return;
    const record: SavedCalc = { id: crypto.randomUUID(), at: new Date().toISOString(), input, result };
    setSaved(items => [record, ...items]);
  }

  function download(kind: 'json' | 'txt') {
    if (!result) return;
    const body = kind === 'json' ? JSON.stringify({ input, result }, null, 2) : summaryText(result);
    const blob = new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = kind === 'json' ? 'zakah-educational-preview.json' : 'zakah-educational-preview.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.scopeTitle}</h1>
        <p className="mt-2">{s.scopeBody}</p>
        <Banner>
          {s.notReviewed} · {s.profile} {ZAKAH_PROFILE.id} {ZAKAH_PROFILE.version}
        </Banner>
        <p className="mt-3 text-sm">{s.guest}</p>
        <p className="mt-2 text-sm">{s.fitr}</p>
      </Panel>
      <Panel>
        <h2 className="font-display text-2xl font-bold text-dd-emerald">1–4. {s.currency}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={s.currency}>
            <select className={control} value={currency} onChange={event => setCurrency(event.target.value)}>
              {CURRENCIES.map(code => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </Field>
          <Field label={s.valueDate}>
            <input className={control} type="date" value={valuationDate} onChange={event => setValuationDate(event.target.value)} />
          </Field>
          <Field label={s.goldPrice}>
            <input className={control} inputMode="decimal" value={gold} onChange={event => setGold(event.target.value)} />
          </Field>
          <Field label={s.silverPrice}>
            <input className={control} inputMode="decimal" value={silver} onChange={event => setSilver(event.target.value)} />
          </Field>
          <Field label={s.priceDate}>
            <input className={control} type="date" value={priceDate} onChange={event => setPriceDate(event.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-sm">{s.manualPrice}</p>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={acceptStale} onChange={event => setAcceptStale(event.target.checked)} />
          {s.acceptStale}
        </label>
        <h3 className="mt-4 font-semibold">{s.assumptions}</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
          {ZAKAH_PROFILE.sources.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.aiTitle}</h2>
        <p className="mt-2 text-sm">{s.aiBody}</p>
        {config && !config.ai && <Banner>{s.aiOff}</Banner>}
        <textarea className={`${control} mt-3 w-full`} rows={3} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} disabled={config ? !config.ai : false} />
        <button type="button" className="mt-3 min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory disabled:opacity-50" disabled={!description.trim() || aiBusy || config?.ai === false} onClick={() => void suggest()}>
          {aiBusy ? s.loading : s.aiButton}
        </button>
        {aiError && <p className="mt-2 text-sm">{aiError}</p>}
        {suggestion && (
          <div className="mt-3 space-y-2">
            <p className="text-sm">{s.specialist}</p>
            <div className="flex flex-wrap gap-2">
              {suggestion.categories.map(category => (
                <button key={category} type="button" className="min-h-11 rounded-full bg-dd-gold/30 px-3" onClick={() => addSuggested(category)}>
                  {s.addRow}: {category}
                </button>
              ))}
              {suggestion.specialist.map(category => (
                <button key={category} type="button" className="min-h-11 rounded-full bg-white px-3" onClick={() => addSuggested(category)}>
                  {category}
                </button>
              ))}
            </div>
            <ul className="list-disc pl-5 text-sm">
              {suggestion.questions.map(question => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
      <Panel>
        <h2 className="font-display text-2xl font-bold text-dd-emerald">5–7. {s.assets}</h2>
        <p className="mt-2 text-sm">{s.dup}</p>
        <div className="mt-4 space-y-4">
          {rows.map(row => (
            <AssetRow key={row.id} row={row} base={currency} onChange={next => setRows(items => items.map(item => (item.id === row.id ? next : item)))} onRemove={() => setRows(items => items.filter(item => item.id !== row.id))} />
          ))}
        </div>
        <button type="button" className="mt-3 min-h-11 rounded-full bg-white px-4" onClick={() => setRows(items => [...items, blankRow()])}>
          {s.addRow}
        </button>
        <h3 className="mt-6 font-semibold">{s.liability}</h3>
        {liabilities.map(item => (
          <div key={item.id} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input className={control} placeholder={s.label} value={item.label} onChange={event => setLiabilities(list => list.map(row => (row.id === item.id ? { ...row, label: event.target.value } : row)))} />
            <input className={control} inputMode="decimal" placeholder={s.amount} value={item.amount} onChange={event => setLiabilities(list => list.map(row => (row.id === item.id ? { ...row, amount: event.target.value } : row)))} />
            <button type="button" className="min-h-11 rounded-full px-3" onClick={() => setLiabilities(list => list.filter(row => row.id !== item.id))}>
              {s.remove}
            </button>
          </div>
        ))}
        <button type="button" className="mt-3 min-h-11 rounded-full bg-white px-4" onClick={() => setLiabilities(list => [...list, { id: crypto.randomUUID(), label: '', amount: '' }])}>
          {s.addRow}
        </button>
      </Panel>
      <Panel>
        <h2 className="font-display text-2xl font-bold text-dd-emerald">8–10. {s.hawl}</h2>
        <fieldset className="mt-3 space-y-2">
          <legend className="text-sm">{s.hawl}</legend>
          {(
            [
              ['complete', s.hawlYes],
              ['incomplete', s.hawlNo],
              ['unknown', s.hawlUnknown],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="hawl" checked={hawl === value} onChange={() => setHawl(value)} />
              {label}
            </label>
          ))}
        </fieldset>
        <h3 className="mt-4 font-semibold">{s.review}</h3>
        <ul className="mt-2 text-sm">
          {rows.map(row => (
            <li key={row.id}>
              {row.label || s.label}: {row.category} {row.amount || row.weight}
            </li>
          ))}
          {liabilities.map(item => (
            <li key={item.id}>
              {s.liability}: {item.label} {item.amount}
            </li>
          ))}
        </ul>
        <label className="mt-4 flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} />
          {s.ack}
        </label>
        <button type="button" className="mt-3 min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory disabled:opacity-50" disabled={!ack} onClick={calculate}>
          {s.calculate}
        </button>
        {errors.length > 0 && <p className="mt-3 text-sm">{errors.join(', ')}</p>}
      </Panel>
      {result && ack && (
        <Panel>
          <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.due}</h2>
          <p className="text-sm">{s.notReviewed}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums">{result.dueMinor ? `${result.currency} ${result.dueMinor}` : s.noDue}</p>
          <p className="text-sm">
            {s.profile} {result.profileVersion} · {result.valuationDate}
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt>{s.included}</dt>
              <dd>{result.included.map(item => `${item.category} ${item.minor}`).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>{s.excluded}</dt>
              <dd>{result.excluded.map(item => `${item.category}: ${reasonText(s, item.reason)}`).join('; ') || '—'}</dd>
            </div>
            <div>
              <dt>{s.liability}</dt>
              <dd>{result.liabilityMinor}</dd>
            </div>
            <div>
              <dt>{s.nisab}</dt>
              <dd>
                {result.nisabMinor ?? '—'} ({result.nisabBasis ?? '—'})
              </dd>
            </div>
            <div>
              <dt>{s.rate}</dt>
              <dd>{result.rate}</dd>
            </div>
            <div>
              <dt>{s.rounding}</dt>
              <dd>{result.rounding}</dd>
            </div>
            <div>
              <dt>{s.hawl}</dt>
              <dd>{result.hawl}</dd>
            </div>
          </dl>
          {result.stale && <p className="mt-3 text-sm">{s.stale}</p>}
          {result.unresolved.length > 0 && (
            <p className="mt-2 text-sm">
              {s.unresolved}: {result.unresolved.join(', ')}
            </p>
          )}
          {result.warnings.length > 0 && (
            <p className="mt-2 text-sm">
              {s.warnings}: {result.warnings.join(', ')}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" onClick={save}>
              {s.saveCalc}
            </button>
            <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => download('json')}>
              {s.exportJson}
            </button>
            <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => download('txt')}>
              {s.exportText}
            </button>
            <a className="inline-flex min-h-11 items-center rounded-full bg-white px-4" href="#/spiritual/questions">
              {s.questions}
            </a>
          </div>
          <p className="mt-3 text-xs">
            {s.savedCalcs}: {saved.length}
          </p>
        </Panel>
      )}
    </div>
  );
}

function AssetRow({ row, base, onChange, onRemove }: { row: Row; base: string; onChange: (row: Row) => void; onRemove: () => void }) {
  const { s } = useSp();
  const metal = row.category === 'gold' || row.category === 'silver';
  return (
    <div className="rounded-2xl border border-dd-emerald/10 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={s.label}>
          <input className={control} value={row.label} onChange={event => onChange({ ...row, label: event.target.value })} />
        </Field>
        <Field label={s.assets}>
          <select className={control} value={row.category} onChange={event => onChange({ ...row, category: event.target.value })}>
            {CATEGORIES.map(category => (
              <option key={category} value={category}>
                {category}
                {ZAKAH_PROFILE.enabled.includes(category as (typeof ZAKAH_PROFILE.enabled)[number]) ? '' : ` — ${s.specialist}`}
              </option>
            ))}
          </select>
        </Field>
        {metal ? (
          <>
            <Field label={s.weight}>
              <input className={control} inputMode="decimal" value={row.weight} onChange={event => onChange({ ...row, weight: event.target.value })} />
            </Field>
            <Field label={s.unit}>
              <select className={control} value={row.unit} onChange={event => onChange({ ...row, unit: event.target.value as 'g' | 'oz' })}>
                <option value="g">{s.grams}</option>
                <option value="oz">{s.ounces}</option>
              </select>
            </Field>
            <Field label={s.purity}>
              <select className={control} value={row.purityMode} onChange={event => onChange({ ...row, purityMode: event.target.value as 'karat' | 'fineness' })}>
                <option value="karat">{s.karat}</option>
                <option value="fineness">{s.fineness}</option>
              </select>
            </Field>
            <Field label={row.purityMode === 'karat' ? s.karat : s.fineness}>
              <input className={control} inputMode="decimal" value={row.purity} onChange={event => onChange({ ...row, purity: event.target.value })} />
            </Field>
          </>
        ) : (
          <>
            <Field label={s.amount}>
              <input className={control} inputMode="decimal" value={row.amount} onChange={event => onChange({ ...row, amount: event.target.value })} />
            </Field>
            <Field label={s.currency}>
              <input className={control} value={row.currency} placeholder={base} onChange={event => onChange({ ...row, currency: event.target.value.toUpperCase().slice(0, 8) })} />
            </Field>
            {row.currency && row.currency !== base && (
              <Field label={s.fx}>
                <input className={control} inputMode="decimal" value={row.fx} onChange={event => onChange({ ...row, fx: event.target.value })} />
              </Field>
            )}
          </>
        )}
      </div>
      <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={onRemove}>
        {s.remove}
      </button>
    </div>
  );
}

function summaryText(result: ZakahSuccess): string {
  return [
    'Educational preview — not a reviewed ruling',
    `${result.profileId} ${result.profileVersion}`,
    `${result.currency} ${result.dueMinor ?? 'no amount'}`,
    `Net ${result.netMinor}`,
    `Nisab ${result.nisabMinor ?? 'unresolved'}`,
    `Hawl ${result.hawl}`,
    `Excluded ${result.excluded.map(item => `${item.id} ${item.reason}`).join('; ')}`,
    result.assumptions.join('\n'),
  ].join('\n');
}

export function SavedCalculations({ segments }: { segments: string[] }) {
  const { s } = useSp();
  const [saved, setSaved] = useStored<SavedCalc[]>('kf-zakah-saves', []);
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.savedCalcs}</h1>
        <p className="mt-2 text-sm">{s.guest}</p>
        {!saved.length && <p className="mt-4">{s.savedEmpty}</p>}
        <ul className="mt-4 space-y-3">
          {saved.map(item => (
            <li key={item.id} className="rounded-2xl border border-dd-emerald/10 p-4">
              <p className="font-semibold">
                {item.result.currency} {item.result.dueMinor ?? s.noDue}
              </p>
              <p className="text-xs">
                {item.at} · {item.result.profileVersion} · {s.notReviewed}
              </p>
              <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={() => setSaved(list => list.filter(row => row.id !== item.id))}>
                {s.delete}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
