import type { AgentContribution, CoverageNote, EvidencePassage, ResearchDossierView, ResearchJobView } from '../contracts/v1.ts';

export interface ReportChartRow {
  label: string;
  count: number;
}

export interface ReportModel {
  question: string;
  language: string;
  scope: string;
  teams: string[];
  agentsRan: AgentContribution[];
  agentsIdle: AgentContribution[];
  passages: EvidencePassage[];
  claims: ResearchDossierView['claims'];
  disagreements: string[];
  unresolved: string[];
  unavailable: CoverageNote[];
  incomplete: CoverageNote[];
  insufficient: CoverageNote[];
  otherNotes: CoverageNote[];
  chain: string[] | null;
  chart: ReportChartRow[];
  verificationNote: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chainFromPassages(passages: readonly EvidencePassage[]): string[] | null {
  for (const passage of passages) {
    if (passage.source.provider !== 'HadeethEnc') continue;
    const raw = passage.locator;
    const parts = raw
      .split(/\s+(?:from|عن|←|->|➔)\s+/i)
      .map(part => part.replace(/\s+/g, ' ').trim())
      .filter(part => part.length > 1 && !/^hadeethenc\b/i.test(part));
    if (parts.length >= 2) return parts;
  }
  return null;
}

export function buildReportModel(job: ResearchJobView, dossier: ResearchDossierView | null): ReportModel {
  const agents = job.agents ?? [];
  const passages = dossier?.passages ?? [];
  const coverage = job.coverage ?? [];
  const counts = new Map<string, number>();
  for (const passage of passages) counts.set(passage.source.provider, (counts.get(passage.source.provider) ?? 0) + 1);
  return {
    question: job.question,
    language: job.language,
    scope: job.assignment?.scope ?? 'knowledge',
    teams: job.assignment?.teams ?? [],
    agentsRan: agents.filter(agent => agent.status === 'ran'),
    agentsIdle: agents.filter(agent => agent.status !== 'ran'),
    passages,
    claims: dossier?.claims ?? [],
    disagreements: dossier?.disagreements ?? [],
    unresolved: dossier?.unresolved ?? [],
    unavailable: coverage.filter(note => note.kind === 'source_unavailable' || note.kind === 'language_unavailable'),
    incomplete: coverage.filter(note => note.kind === 'budget_exhausted'),
    insufficient: coverage.filter(note => note.kind === 'no_relevant_evidence'),
    otherNotes: coverage.filter(
      note => !['source_unavailable', 'language_unavailable', 'budget_exhausted', 'no_relevant_evidence'].includes(note.kind),
    ),
    chain: chainFromPassages(passages),
    chart: [...counts.entries()].map(([label, count]) => ({ label, count })),
    verificationNote: dossier?.verificationNote ?? '',
  };
}

function section(title: string, tone: string, body: string): string {
  return `<section class="block ${tone}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function paragraphs(lines: readonly string[]): string {
  if (!lines.length) return '<p class="muted">None recorded.</p>';
  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
}

/** The file the reader downloads. The on-screen report is built from the same model. */
export function renderReportHtml(model: ReportModel): string {
  const agents = model.agentsRan
    .map(agent => `<article class="agent"><h3>${escapeHtml(agent.role)}</h3><p>${escapeHtml(agent.detail)}</p></article>`)
    .join('');
  const idle = model.agentsIdle
    .map(agent => `<li><strong>${escapeHtml(agent.role)}</strong> — ${escapeHtml(agent.status === 'unavailable' ? 'attempted, source unavailable' : 'did not run')}. ${escapeHtml(agent.detail)}</li>`)
    .join('');
  const passages = model.passages
    .map(passage => {
      const arabic = passage.arabic ? `<p class="arabic" dir="rtl" lang="ar">${escapeHtml(passage.arabic)}</p>` : '';
      return `<article class="passage"><h3>${escapeHtml(passage.locator)}</h3><p class="meta">${escapeHtml(passage.source.provider)} · ${escapeHtml(passage.source.title)}</p>${arabic}<p>${escapeHtml(passage.text)}</p>${passage.context ? `<p class="context">${escapeHtml(passage.context)}</p>` : ''}<p class="meta">${escapeHtml(passage.source.canonicalUrl)}</p></article>`;
    })
    .join('');
  const chart = model.chart
    .map(row => {
      const width = Math.max(8, Math.min(100, row.count * 24));
      return `<div class="bar-row"><span>${escapeHtml(row.label)} (${row.count})</span><span class="bar" style="width:${width}%"></span></div>`;
    })
    .join('');
  const chain = model.chain
    ? `<ol class="chain">${model.chain.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ol>`
    : '<p class="muted">No narrator chain was printed on the opened records, so no chain map is drawn.</p>';
  const claims = model.claims.map(claim => `${claim.support}: ${claim.claim} — ${claim.note}${claim.passageIds.length ? ` (${claim.passageIds.join(', ')})` : ''}`);
  return `<!DOCTYPE html>
<html lang="${escapeHtml(model.language)}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(model.question)}</title>
<style>
  body { margin: 0; background: #faf6ec; color: #172720; font: 16px/1.55 Inter, "Noto Sans Tamil", "Noto Sans Sinhala", sans-serif; }
  main { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; }
  h1, h2, h3 { font-family: Fraunces, Georgia, serif; color: #064936; }
  .hero { background: #064936; color: #faf6ec; border-radius: 24px; padding: 24px; }
  .hero h1, .hero p { color: #faf6ec; }
  .block { margin-top: 16px; border-radius: 20px; padding: 18px; }
  .parchment { background: #f4ecd8; border: 1px solid rgba(6,73,54,.12); }
  .gold { background: #fff; border: 1px solid #c9a14e; }
  .lapis { background: #fff; border-left: 6px solid #244875; }
  .gap { background: #fff7ea; border: 1px solid #c9a14e; }
  .agent, .passage { margin-top: 12px; }
  .arabic { font-family: "Amiri Quran", "Scheherazade New", serif; font-size: 1.4rem; }
  .meta, .muted, .context { color: #637069; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .bar { display: block; height: 12px; border-radius: 999px; background: linear-gradient(90deg, #07533f, #c9a14e); }
  .chain { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
  .chain li { background: #064936; color: #faf6ec; border-radius: 999px; padding: 6px 12px; }
</style>
</head>
<body>
<main>
  <header class="hero">
    <p>DRAGON DAWWA · full research report</p>
    <h1>${escapeHtml(model.question)}</h1>
    <p>Language: ${escapeHtml(model.language)}. Scope: ${escapeHtml(model.scope)}. Teams: ${escapeHtml(model.teams.join(', ') || '—')}.</p>
  </header>
  ${section('Agents who contributed', 'gold', agents || '<p class="muted">No assigned agent recorded a contribution.</p>')}
  ${section('Agents who did not produce a finding', 'parchment', idle ? `<ul>${idle}</ul>` : '<p class="muted">Every assigned role that was attempted is listed above.</p>')}
  ${section('Narrator chain', 'lapis', chain)}
  ${section('Evidence chart', 'gold', chart || '<p class="muted">No passage was kept.</p>')}
  ${section('Supporting sources', 'lapis', passages || '<p class="muted">No passage was kept.</p>')}
  ${section('Claims', 'parchment', paragraphs(claims))}
  ${section('Disagreements', 'gold', paragraphs(model.disagreements))}
  ${section('Unresolved', 'parchment', paragraphs(model.unresolved))}
  ${section('Sources that could not be reached', 'gap', paragraphs(model.unavailable.map(note => note.detail)))}
  ${section('Incomplete research', 'gap', paragraphs(model.incomplete.map(note => note.detail)))}
  ${section('Evidence that does not yet support an answer', 'gap', paragraphs(model.insufficient.map(note => note.detail)))}
  ${section('Other notes', 'parchment', paragraphs(model.otherNotes.map(note => note.detail)))}
  ${model.verificationNote ? section('How to read this report', 'parchment', `<p>${escapeHtml(model.verificationNote)}</p>`) : ''}
</main>
</body>
</html>`;
}
