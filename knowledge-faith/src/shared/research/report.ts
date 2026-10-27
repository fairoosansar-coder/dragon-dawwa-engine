import type { AgentContribution, CoverageNote, EvidencePassage, ResearchAnswer, ResearchDossierView, ResearchJobView } from '../contracts/v1.ts';

export interface ReportChartRow {
  label: string;
  count: number;
}

export interface ReportModel {
  question: string;
  language: string;
  scope: string;
  teams: string[];
  answer: string | null;
  answerArabic: string | null;
  citationIds: string[];
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
  investigation: 'complete' | 'partial' | 'blocked' | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ARABIC_MARKS = /[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g;

function namesInIsnad(arabic: string): string[] | null {
  const bare = arabic.replace(ARABIC_MARKS, '').replace(/ـ/g, ' ').replace(/\s+/g, ' ').trim();
  const cut = bare.search(/(?:^|\s)قال(?:\s|$)/);
  const head = (cut === -1 ? bare : bare.slice(0, cut)).replace(/رض[ىي] الله عنه/g, ' ');
  const parts = head
    .split(/\s*(?:حدثنا|حدثني|أخبرنا|اخبرنا|أنبأنا|انبأنا|عن(?!ه))\s*/)
    .map(part => part.replace(/[،,]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(part => part.length > 1);
  return parts.length >= 2 ? parts : null;
}

/** Narrator names printed on the opened record. Nothing is added when the record has no chain. */
const QURAN_CHAIN = /surah|ayah|\bverse\b|qur[’']?an|குர்ஆன்|வசனம்|سورة|denies faith|work has become worthless|al-ma['’]?idah/i;

export function transmissionNames(passage: Pick<EvidencePassage, 'arabic' | 'locator' | 'source'>): string[] | null {
  if (passage.source.contentType === 'quran') return null;
  const fromArabic = passage.arabic ? namesInIsnad(passage.arabic) : null;
  if (fromArabic && fromArabic.length >= 2) {
    if (fromArabic.some(part => part.length > 48 || QURAN_CHAIN.test(part))) return null;
    return fromArabic;
  }
  if (passage.source.provider !== 'HadeethEnc' && passage.source.provider !== 'hadith-api') return null;
  const parts = passage.locator
    .split(/\s+(?:from|عن|←|->|➔)\s+/i)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(part => part.length > 1 && !/^hadeethenc\b/i.test(part) && !/^hadith-api\b/i.test(part));
  if (parts.some(part => part.length > 48 || QURAN_CHAIN.test(part))) return null;
  return parts.length >= 2 ? parts : null;
}

function chainFromPassages(passages: readonly EvidencePassage[]): string[] | null {
  let best: string[] | null = null;
  for (const passage of passages) {
    const names = transmissionNames(passage);
    if (names && (!best || names.length > best.length)) best = names;
  }
  return best;
}

function writtenAnswer(answer: ResearchAnswer | null | undefined, passages: readonly EvidencePassage[]): { answer: string | null; arabic: string | null; citationIds: string[] } {
  const paragraphs = (answer?.paragraphs ?? []).filter(paragraph => {
    const text = paragraph.text.trim();
    if (!text) return false;
    if (paragraph.citations.length > 0 || text.startsWith('Word occurrence.')) return true;
    return /stays open|not treated as|selected language|provider failure|not answered|was not opened|source did not respond/i.test(text);
  });
  const fallback = evidencedAnswer(passages);
  if (!paragraphs.length) return { ...fallback, citationIds: passages.map(passage => passage.id) };
  const citationIds = [...new Set(paragraphs.flatMap(paragraph => paragraph.citations))];
  const arabic = passages.find(passage => citationIds.includes(passage.id) && passage.arabic)?.arabic ?? fallback.arabic;
  return { answer: paragraphs.map(paragraph => paragraph.text.trim()).join('\n\n'), arabic, citationIds };
}

function evidencedAnswer(passages: readonly EvidencePassage[]): { answer: string | null; arabic: string | null } {
  if (!passages.length) return { answer: null, arabic: null };
  const hadiths = passages.filter(passage => passage.source.contentType === 'hadith');
  const study = hadiths.filter(passage => passage.source.provider === 'hadith-api');
  const lead = study[0] ?? hadiths[0] ?? passages[0];
  const refs = (hadiths.length ? hadiths : [lead]).map(passage => `${passage.locator} (${passage.source.provider})`).join('; ');
  const grades = [...new Set(hadiths.map(passage => passage.publishedGrade).filter((grade): grade is string => Boolean(grade)))];
  return {
    answer: [
      `Retrieved: ${refs}.`,
      grades.length ? `Grade printed by the source: ${grades.join('; ')}.` : null,
      `The source text says: “${lead.text.trim()}”`,
    ]
      .filter(Boolean)
      .join(' '),
    arabic: lead.arabic,
  };
}

export function buildReportModel(job: ResearchJobView, dossier: ResearchDossierView | null): ReportModel {
  const agents = job.agents ?? [];
  const passages = dossier?.passages ?? [];
  const coverage = job.coverage ?? [];
  const counts = new Map<string, number>();
  for (const passage of passages) counts.set(passage.source.provider, (counts.get(passage.source.provider) ?? 0) + 1);
  const retrievalFailed = passages.length === 0 && (job.status === 'done' || job.status === 'error');
  const failureNotes = coverage.filter(note =>
    ['source_unavailable', 'language_unavailable', 'budget_exhausted', 'no_relevant_evidence'].includes(note.kind),
  );
  const answer = writtenAnswer(dossier?.answer, passages);
  return {
    question: job.question,
    language: job.language,
    scope: job.assignment?.scope ?? 'knowledge',
    teams: job.assignment?.teams ?? [],
    answer: answer.answer,
    answerArabic: answer.arabic,
    citationIds: answer.citationIds,
    agentsRan: agents.filter(agent => agent.status === 'ran'),
    agentsIdle: agents.filter(agent => agent.status !== 'ran'),
    passages,
    claims: dossier?.claims ?? [],
    disagreements: dossier?.disagreements ?? [],
    unresolved: dossier?.unresolved ?? [],
    unavailable: retrievalFailed ? [] : coverage.filter(note => note.kind === 'source_unavailable' || note.kind === 'language_unavailable'),
    incomplete: retrievalFailed ? failureNotes : coverage.filter(note => note.kind === 'budget_exhausted'),
    insufficient: retrievalFailed ? [] : coverage.filter(note => note.kind === 'no_relevant_evidence'),
    otherNotes: coverage.filter(
      note => !['source_unavailable', 'language_unavailable', 'budget_exhausted', 'no_relevant_evidence'].includes(note.kind),
    ),
    chain: chainFromPassages(passages),
    chart: [...counts.entries()].map(([label, count]) => ({ label, count })),
    verificationNote: dossier?.verificationNote ?? '',
    investigation: job.investigation ?? null,
  };
}

function section(title: string, tone: string, body: string): string {
  return `<section class="block ${tone}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function paragraphs(lines: readonly string[]): string {
  if (!lines.length) return '<p class="muted">None recorded.</p>';
  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
}

function gapSection(title: string, lines: readonly string[]): string {
  if (!lines.length) return '';
  return section(title, 'gap', paragraphs(lines));
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
      return `<article class="passage"><h3>${escapeHtml(passage.locator)}</h3><p class="meta">${escapeHtml(passage.source.provider)} · ${escapeHtml(passage.source.title)}</p>${arabic}<p lang="${escapeHtml(model.language)}">${escapeHtml(passage.text)}</p>${passage.context ? `<p class="context">${escapeHtml(passage.context)}</p>` : ''}<p class="meta">${escapeHtml(passage.source.canonicalUrl)}</p></article>`;
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
    : '';
  const claims = model.claims.map(claim => `${claim.support}: ${claim.claim} — ${claim.note}${claim.passageIds.length ? ` (${claim.passageIds.join(', ')})` : ''}`);
  const answer = model.answer
    ? section(
        'Answer',
        'gold',
        `<p lang="${escapeHtml(model.language)}">${escapeHtml(model.answer)}</p>${model.answerArabic ? `<p class="arabic" dir="rtl" lang="ar">${escapeHtml(model.answerArabic)}</p>` : ''}`,
      )
    : '';
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
    <p>Language: ${escapeHtml(model.language)}. Scope: ${escapeHtml(model.scope)}. Teams: ${escapeHtml(model.teams.join(', ') || '—')}.${model.investigation ? ` Investigation: ${escapeHtml(model.investigation)}.` : ''}</p>
  </header>
  ${answer}
  ${section('Claims', 'parchment', paragraphs(claims))}
  ${section('Supporting sources', 'lapis', passages || '<p class="muted">No passage was kept.</p>')}
  ${section('Evidence chart', 'gold', chart || '<p class="muted">No passage was kept.</p>')}
  ${section('Disagreements', 'gold', paragraphs(model.disagreements))}
  ${section('Unresolved', 'parchment', paragraphs(model.unresolved))}
  ${chain ? section('Transmission map', 'lapis', chain) : ''}
  <details class="block parchment" data-research-activity>
    <summary>Research activity</summary>
    ${gapSection('Sources that could not be reached', model.unavailable.map(note => note.detail))}
    ${gapSection('Incomplete research', model.incomplete.map(note => note.detail))}
    ${gapSection('Evidence that does not yet support an answer', model.insufficient.map(note => note.detail))}
    ${model.otherNotes.length ? section('Other notes', 'parchment', paragraphs(model.otherNotes.map(note => note.detail))) : ''}
    ${model.verificationNote ? section('How to read this report', 'parchment', `<p>${escapeHtml(model.verificationNote)}</p>`) : ''}
  </details>
  ${section('Agents who contributed', 'gold', agents || '<p class="muted">No assigned agent recorded a contribution.</p>')}
  ${section('Agents who did not produce a finding', 'parchment', idle ? `<ul>${idle}</ul>` : '<p class="muted">Every assigned role that was attempted is listed above.</p>')}
</main>
</body>
</html>`;
}
