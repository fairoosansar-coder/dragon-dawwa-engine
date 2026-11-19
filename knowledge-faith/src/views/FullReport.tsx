import { ContentText } from '../components/ContentText.tsx';
import type { ReportModel } from '../shared/research/report.ts';

export function FullReport({ model }: { model: ReportModel }) {
  const max = Math.max(1, ...model.chart.map(row => row.count));
  const hadithOpened = model.passages.some(passage => passage.source.contentType === 'hadith');
  const limitations = [
    ...model.unresolved,
    ...(!model.chain && hadithOpened ? ['No narrator chain was printed on the opened records, so no chain map is drawn.'] : []),
  ];
  return (
    <article className="space-y-4" lang="en" aria-label="Full report" data-full-report>
      <header className="rounded-3xl bg-pine px-5 py-6 text-sand sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">DRAGON DAWWA</p>
        <h2 className="mt-2 font-display text-3xl font-bold leading-tight"><ContentText text={model.question} /></h2>
        <p className="mt-3 text-sm text-sand/85">
          {model.language} · {model.scope}
          {model.teams.length ? ` · ${model.teams.join(', ')}` : ''}
        </p>
      </header>

      {model.answer && (
        <section className="rounded-3xl border border-gold bg-white p-5" data-research-answer>
          <h3 className="font-display text-xl font-bold text-pine">Answer</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"><ContentText text={model.answer} /></p>
          {model.answerArabic && (
            <p className="mt-3 font-arabic text-2xl leading-loose" dir="rtl" lang="ar">
              {model.answerArabic}
            </p>
          )}
        </section>
      )}

      <section className="rounded-3xl border-l-4 border-lapis bg-white p-5">
        <h3 className="font-display text-xl font-bold text-pine">Supporting sources</h3>
        <div className="mt-3 space-y-4">
          {model.passages.map(passage => (
            <article key={passage.id} className="rounded-2xl bg-sand px-4 py-3">
              <h4 className="font-semibold text-pine">{passage.locator}</h4>
              <p className="text-xs text-muted">
                {passage.source.provider} · {passage.source.title}
                {passage.publishedGrade ? ` · ${passage.publishedGrade}` : ''}
              </p>
              {passage.arabic && (
                <p className="mt-2 font-arabic text-2xl leading-loose" dir="rtl" lang="ar">
                  {passage.arabic}
                </p>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"><ContentText text={passage.text} /></p>
              {passage.context && <p className="mt-2 whitespace-pre-wrap text-sm text-muted"><ContentText text={passage.context} /></p>}
              <p className="mt-2 break-all text-xs text-muted">{passage.source.canonicalUrl}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-parchment p-5">
        <h3 className="font-display text-xl font-bold text-pine">Claims</h3>
        {model.claims.map(claim => (
          <p key={claim.claim} className="mt-2 text-sm leading-relaxed">
            <span className="font-semibold text-pine">{claim.support}. </span>
            <ContentText text={`${claim.claim} — ${claim.note}`} />
            {claim.passageIds.length ? ` (${claim.passageIds.join(', ')})` : ''}
          </p>
        ))}
      </section>

      <section className="rounded-3xl border border-gold bg-white p-5">
        <h3 className="font-display text-xl font-bold text-pine">Disagreements</h3>
        {model.disagreements.length === 0 && <p className="mt-2 text-sm text-muted">None recorded.</p>}
        {model.disagreements.map(line => (
          <p key={line} className="mt-2 text-sm leading-relaxed"><ContentText text={line} /></p>
        ))}
      </section>

      <section className="rounded-3xl bg-parchment p-5">
        <h3 className="font-display text-xl font-bold text-pine">Limitations</h3>
        {limitations.length === 0 && <p className="mt-2 text-sm text-muted">None recorded.</p>}
        {limitations.map(line => (
          <p key={line} className="mt-2 text-sm leading-relaxed"><ContentText text={line} /></p>
        ))}
      </section>

      {model.chain && (
        <section className="rounded-3xl border-l-4 border-lapis bg-white p-5">
          <h3 className="font-display text-xl font-bold text-pine">Transmission map</h3>
          <ol className="mt-4 flex flex-wrap items-center gap-2">
            {model.chain.map((name, index) => (
              <li key={`${name}-${index}`} className="flex items-center gap-2">
                <span className="rounded-full bg-pine px-3 py-1 text-sm text-sand"><ContentText text={name} /></span>
                {index < model.chain!.length - 1 && <span aria-hidden className="text-gold">➔</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
      <details className="rounded-3xl border border-pine/10 bg-parchment p-5" data-research-activity>
        <summary className="cursor-pointer font-display text-xl font-bold text-pine">Research activity</summary>
        <div className="mt-4 space-y-4">
          <section>
            <h3 className="font-display text-xl font-bold text-pine">Evidence chart</h3>
            {model.chart.length === 0 && <p className="mt-2 text-sm text-muted">No passage was kept.</p>}
            <ul className="mt-4 space-y-3">
              {model.chart.map(row => (
                <li key={row.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span>{row.count}</span>
                  </div>
                  <span className="block h-3 rounded-full bg-gold/30">
                    <span className="block h-3 rounded-full bg-gradient-to-r from-moss to-gold" style={{ width: `${Math.max(12, (row.count / max) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <Gap title="Sources that could not be reached" lines={model.unavailable.map(note => note.detail)} />
          <Gap title="Incomplete research" lines={model.incomplete.map(note => note.detail)} />
          <Gap title="Evidence that does not yet support an answer" lines={model.insufficient.map(note => note.detail)} />
          <Gap title="Other notes" lines={model.otherNotes.map(note => note.detail)} />
          {model.verificationNote && <p className="text-sm leading-relaxed text-muted">{model.verificationNote}</p>}
        </div>
      </details>

      <section className="rounded-3xl border border-gold bg-white p-5">
        <h3 className="font-display text-xl font-bold text-pine">Agents who contributed</h3>
        {model.agentsRan.length === 0 && <p className="mt-2 text-sm text-muted">No assigned agent recorded a contribution.</p>}
        <div className="mt-3 space-y-3">
          {model.agentsRan.map(agent => (
            <article key={agent.id} className="rounded-2xl bg-parchment px-4 py-3">
              <h4 className="font-semibold text-pine">{agent.role}</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed"><ContentText text={agent.detail} /></p>
            </article>
          ))}
        </div>
      </section>

      {model.agentsIdle.length > 0 && (
        <section className="rounded-3xl border border-pine/10 bg-parchment p-5">
          <h3 className="font-display text-xl font-bold text-pine">Assigned agents who did not produce a finding</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {model.agentsIdle.map(agent => (
              <li key={agent.id}>
                <span className="font-semibold text-pine">{agent.role}</span>
                <span className="text-muted"> — {agent.status === 'unavailable' ? 'attempted, source unavailable' : 'did not run'}. </span>
                <ContentText text={agent.detail} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Gap({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <section className="rounded-3xl border border-gold/60 bg-[#fff7ea] p-5">
      <h3 className="font-display text-xl font-bold text-pine">{title}</h3>
      {lines.map(line => (
        <p key={line} className="mt-2 text-sm leading-relaxed"><ContentText text={line} /></p>
      ))}
    </section>
  );
}
