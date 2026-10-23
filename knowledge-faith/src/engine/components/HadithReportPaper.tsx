import React from 'react';
import type { DragonDawwaAnalysis } from '../types/hadith.ts';
import type { SupportedLanguage } from '../utils/localization.ts';
import { attachAgent7ToAnalysis } from '../utils/agent7SourceResearch.ts';
import {
  evidenceCounts,
  linkBetween,
  publishedAuthenticity,
  reportIdFor,
  type EvidenceCounts,
} from '../utils/reportPresentation.ts';

const AGENTS = [
  { n: '01', accent: '#0f6e56', persona: 'Dr. Tariq al-Mansoor', role: 'Takhrij and textual variants' },
  { n: '02', accent: '#0e7490', persona: 'Dr. Layla al-Qasimi', role: 'Transmission and isnad continuity' },
  { n: '03', accent: '#6d28d9', persona: 'Sheikh Imran al-Hasani', role: 'Rijal and narrator criticism' },
  { n: '04', accent: '#b45309', persona: 'Dr. Zainab al-Mubarak', role: 'Shawahid, matn, and defect screening' },
  { n: '05', accent: '#3730a3', persona: 'Sheikh Yusuf al-Azhari', role: 'Attributed scholarly assessments' },
  { n: '06', accent: '#8a6a2f', persona: 'Executive synthesis', role: 'Consensus, executive findings, and the full roundtable' },
  { n: '07', accent: '#9f1239', persona: 'Dr. Amina al-Kindi', role: 'Source research' },
] as const;

function generatedAt(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date()) + ' Gulf (UTC+4)';
}

function Section({
  n,
  accent,
  kicker,
  title,
  testId,
  children,
}: {
  n: string;
  accent: string;
  kicker: string;
  title: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="hr-section" style={{ ['--hr-accent' as string]: accent }} data-testid={testId}>
      <h2>
        <span className="hr-num">{n}</span>
        <span>
          <span className="hr-kicker">{kicker}</span>
          {title}
        </span>
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="hr-note">None recorded.</p>;
  return (
    <ul className="hr-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function EvidenceChart({ counts }: { counts: EvidenceCounts }) {
  const max = Math.max(counts.supporting, counts.conflicting, counts.unresolved, 1);
  const rows: { kind: 'supporting' | 'conflicting' | 'unresolved'; label: string; count: number }[] = [
    { kind: 'supporting', label: 'Supporting', count: counts.supporting },
    { kind: 'conflicting', label: 'Conflicting', count: counts.conflicting },
    { kind: 'unresolved', label: 'Unresolved', count: counts.unresolved },
  ];
  return (
    <div data-testid="hadith-evidence-chart">
      <p className="hr-chart-title">Evidence counts</p>
      {rows.map(row => (
        <div className="hr-chart-row" key={row.kind}>
          <span className="hr-chart-label">{row.label}</span>
          <span className="hr-chart-track" aria-hidden="true">
            <span
              className="hr-chart-fill"
              data-kind={row.kind}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <span className="hr-chart-count">{row.count}</span>
        </div>
      ))}
      <p className="hr-chart-note">
        Supporting counts {counts.supportingReports} shawahid {counts.supportingReports === 1 ? 'note' : 'notes'}
        {' '}and {counts.corroboratingRecords} HadeethEnc {counts.corroboratingRecords === 1 ? 'record' : 'records'} classed as a direct match or a corroborating theme.
        Candidate word matches are not counted as support.
        Conflicting counts contradiction notes that do not state the absence of a conflict
        ({counts.negatedConflicts} of {counts.contradictionNotes} {counts.contradictionNotes === 1 ? 'note states' : 'notes state'} that none was found; every note is printed in section 04).
        Unresolved counts questions left open by source research.
        These counts are not an authenticity grade. Research completeness is listed after the seven sections.
      </p>
    </div>
  );
}

export const HadithReportPaper: React.FC<{
  analysis: DragonDawwaAnalysis;
  currentLanguage?: SupportedLanguage;
  readerName?: string;
}> = ({ analysis, currentLanguage = 'en', readerName }) => {
  const enriched = analysis.agent_7_source_research
    ? analysis
    : attachAgent7ToAnalysis(analysis, currentLanguage);
  const a1 = enriched.agent_1_takhrij;
  const a2 = enriched.agent_2_isnad;
  const a3 = enriched.agent_3_rijal;
  const a4 = enriched.agent_4_shawahid_matn;
  const a5 = enriched.agent_5_scholars_verdict;
  const a6 = enriched.agent_6_synthesis;
  const a7 = enriched.agent_7_source_research;
  const grade = publishedAuthenticity(enriched);
  const counts = evidenceCounts(enriched);
  const reportId = reportIdFor(enriched.query_hadith);
  const when = generatedAt();
  const showArabic = a1.sources.some(s => s.exact_wording_arabic);
  const showEnglish = a1.sources.some(s => s.exact_wording_english);
  const sequence = a2.narrator_sequence ?? [];

  return (
    <article className="hadith-report-paper" lang={currentLanguage} data-testid="hadith-report-paper">
      <header className="hr-header">
        <p className="hr-brand">DRAGON DAWWA · By Aegis Intelligence</p>
        <h1 className="hr-title">Complete Hadith Research Report</h1>
        <div className="hr-meta">
          <span>Date<strong>{when}</strong></span>
          <span>Report ID<strong>{reportId}</strong></span>
          {readerName ? <span>Reader<strong>{readerName}</strong></span> : null}
        </div>
      </header>

      <div className="hr-verdict">
        <div className="hr-ring-wrap">
          <div
            className="hr-ring"
            data-tone={grade.tone}
            data-testid="hadith-authenticity-ring"
            data-purity="withheld"
          >
            <div className="hr-ring-inner">
              <span className="hr-ring-kicker">Published grade</span>
              <strong className="hr-ring-grade">{grade.grade}</strong>
            </div>
          </div>
          <p className="hr-ring-source">{grade.source}</p>
          <p className="hr-withheld">
            A numerical purity percentage is not shown. No documented, validated calculation was supplied with this dossier. A model score is not used as purity.
            {a5.gradings.length > 1
              ? ` This ring repeats the first published grade. All ${a5.gradings.length} attributed assessments are in section 05.`
              : ''}
          </p>
        </div>
        <EvidenceChart counts={counts} />
      </div>

      <div className="hr-status">
        <p className="hr-block-label">Synthesis status</p>
        <p>{a6.final_status}</p>
        <p className="hr-prose">{a6.consensus_and_disagreements}</p>
      </div>

      <div className="hr-query">
        <p className="hr-block-label">Researched narration</p>
        <p lang={currentLanguage}>{enriched.query_hadith}</p>
      </div>

      <Section n={AGENTS[0].n} accent={AGENTS[0].accent} kicker={`Agent 1 · ${AGENTS[0].persona}`} title={AGENTS[0].role}>
        <p className="hr-prose">{a1.variants_summary}</p>
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Reference</th>
                <th>Recorded wording</th>
                {showArabic ? <th>Arabic wording</th> : null}
                {showEnglish ? <th>English wording</th> : null}
                <th>Wording differences</th>
              </tr>
            </thead>
            <tbody>
              {a1.sources.map((src, i) => (
                <tr key={i}>
                  <td>{src.collection}</td>
                  <td>{src.hadith_number}</td>
                  <td>{src.exact_wording}</td>
                  {showArabic ? <td className="hr-arabic" lang="ar">{src.exact_wording_arabic || '—'}</td> : null}
                  {showEnglish ? <td>{src.exact_wording_english || '—'}</td> : null}
                  <td>{src.wording_differences || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={AGENTS[1].n} accent={AGENTS[1].accent} kicker={`Agent 2 · ${AGENTS[1].persona}`} title={AGENTS[1].role}>
        <p className="hr-prose"><strong>Chain status. </strong>{a2.overall_chain_status}</p>
        <div className="hr-chain" data-testid="hadith-transmission-diagram">
          {sequence.map((name, i) => {
            const next = sequence[i + 1];
            const link = next ? linkBetween(name, next, a2.chain_links) : undefined;
            return (
              <React.Fragment key={`${name}-${i}`}>
                <div className="hr-node">
                  <strong>{name}</strong>
                </div>
                {next ? (
                  <div className="hr-link">
                    {link
                      ? `${link.transmission_mode} · ${link.connection_status}. ${link.historical_reasoning}`
                      : 'No connection record was supplied for this step.'}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
        {a2.chain_links.length > 0 && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Student</th>
                  <th>Formula</th>
                  <th>Connection</th>
                  <th>Source-backed note</th>
                </tr>
              </thead>
              <tbody>
                {a2.chain_links.map((link, i) => (
                  <tr key={i}>
                    <td>{link.teacher}</td>
                    <td>{link.student}</td>
                    <td>{link.transmission_mode}</td>
                    <td>{link.connection_status}</td>
                    <td>{link.historical_reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section n={AGENTS[2].n} accent={AGENTS[2].accent} kicker={`Agent 3 · ${AGENTS[2].persona}`} title={AGENTS[2].role}>
        {a3.narrators.map((narrator, i) => (
          <div className="hr-record" key={i} style={{ ['--hr-accent' as string]: AGENTS[2].accent }}>
            <h3>{narrator.narrator_name}</h3>
            <p><strong>Grade. </strong>{narrator.status}</p>
            <BulletList items={narrator.critic_verdicts} />
            {narrator.critic_quotes_translated ? (
              <p className="hr-prose"><strong>Summary. </strong>{narrator.critic_quotes_translated}</p>
            ) : null}
            <p className="hr-prose"><strong>References. </strong>{narrator.citations.join(' · ') || 'None recorded.'}</p>
          </div>
        ))}
      </Section>

      <Section n={AGENTS[3].n} accent={AGENTS[3].accent} kicker={`Agent 4 · ${AGENTS[3].persona}`} title={AGENTS[3].role}>
        {(a4.quranic_corroboration_arabic || a4.quranic_corroboration_english) && (
          <div className="hr-record" style={{ ['--hr-accent' as string]: AGENTS[3].accent }}>
            <p className="hr-block-label">Qur’anic corroboration</p>
            {a4.quranic_corroboration_arabic ? (
              <p className="hr-arabic" lang="ar">{a4.quranic_corroboration_arabic}</p>
            ) : null}
            {a4.quranic_corroboration_english ? <p>{a4.quranic_corroboration_english}</p> : null}
          </div>
        )}
        <h3 className="hr-block-label" style={{ marginTop: '0.9rem' }}>Supporting reports</h3>
        <BulletList items={a4.supporting_reports} />
        <h3 className="hr-block-label" style={{ marginTop: '0.9rem' }}>Hidden defects</h3>
        <BulletList items={a4.hidden_defects_ilal} />
        <h3 className="hr-block-label" style={{ marginTop: '0.9rem' }}>Contradiction notes</h3>
        <BulletList items={a4.contradictions} />
      </Section>

      <Section n={AGENTS[4].n} accent={AGENTS[4].accent} kicker={`Agent 5 · ${AGENTS[4].persona}`} title={AGENTS[4].role}>
        <div className="hr-table-wrap">
          <table className="hr-table">
            <thead>
              <tr>
                <th>Scholar</th>
                <th>Attributed assessment</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {a5.gradings.map((g, i) => (
                <tr key={i}>
                  <td>{g.scholar}</td>
                  <td>{g.grading}</td>
                  <td>{g.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        n={AGENTS[5].n}
        accent={AGENTS[5].accent}
        kicker={`Agent 6 · ${AGENTS[5].persona}`}
        title={AGENTS[5].role}
        testId="print-roundtable-section"
      >
        <p className="hr-block-label">Executive findings</p>
        <div className="hr-pre">{a6.executive_report_markdown}</div>
        <p className="hr-block-label" style={{ marginTop: '1rem' }}>Roundtable transcript</p>
        <div className="hr-transcript">{a6.podcast_script}</div>
      </Section>

      <Section
        n={AGENTS[6].n}
        accent={AGENTS[6].accent}
        kicker={`Agent 7 · ${a7?.persona_name || AGENTS[6].persona}`}
        title={a7?.role_title || AGENTS[6].role}
        testId="print-agent-7-section"
      >
        {a7 ? (
          <>
            <p className="hr-prose">{a7.summary_established}</p>
            {a7.retrieved_records.map(rec => (
              <div className="hr-record" key={rec.id} style={{ ['--hr-accent' as string]: AGENTS[6].accent }}>
                <h3>HadeethEnc #{rec.id} — {rec.title}</h3>
                <p><strong>Match. </strong>{rec.match_status}. {rec.match_reason}</p>
                <p><strong>Published grade. </strong>{rec.published_grade ?? 'Not supplied'}</p>
                <p><strong>Collection. </strong>{rec.collection_attribution ?? 'HadeethEnc'}</p>
                <p><strong>Source. </strong>{rec.source_url}</p>
                {rec.reader_route ? <p><strong>Reader route. </strong>{rec.reader_route}</p> : null}
                {rec.arabic ? <p className="hr-arabic" lang="ar">{rec.arabic}</p> : null}
                <p><strong>Translation ({rec.language.toUpperCase()}). </strong>{rec.translation}</p>
                {rec.explanation ? <p><strong>Published explanation. </strong>{rec.explanation}</p> : null}
                {rec.lessons.length > 0 ? (
                  <>
                    <p className="hr-block-label">Documented lessons</p>
                    <BulletList items={rec.lessons} />
                  </>
                ) : null}
              </div>
            ))}
            <h3 className="hr-block-label" style={{ marginTop: '1rem' }}>Attributed published opinions</h3>
            <div className="hr-table-wrap">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Author or source</th>
                    <th>Opinion</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {a7.attributed_opinions.map((op, i) => (
                    <tr key={i}>
                      <td>{op.author_or_source}</td>
                      <td>{op.opinion_text}</td>
                      <td>{op.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="hr-block-label" style={{ marginTop: '1rem' }}>Agent interpretation</h3>
            <p className="hr-prose">{a7.agent_interpretation}</p>
            <h3 className="hr-block-label" style={{ marginTop: '1rem' }}>Cross-agent responses</h3>
            {a7.responses_to_agents.map((resp, i) => (
              <p className="hr-prose" key={i}>
                <strong>{resp.target_agent}</strong>
                {resp.cited_references.length ? ` [${resp.cited_references.join(', ')}]. ` : '. '}
                {resp.response_text}
              </p>
            ))}
            <h3 className="hr-block-label" style={{ marginTop: '1rem' }}>Unresolved questions</h3>
            <BulletList items={a7.unresolved_questions} />
          </>
        ) : (
          <p className="hr-note">No source-research record was attached to this dossier.</p>
        )}
      </Section>

      {a7 && (
        <section className="hr-section" data-testid="hadith-research-completeness">
          <h2>
            <span className="hr-num">·</span>
            <span>
              <span className="hr-kicker">Separate from authenticity</span>
              Research completeness
            </span>
          </h2>
          <p className="hr-prose">
            This log records how far the source search went. It is not a grade and it is not a purity figure.
          </p>
          <ul className="hr-list">
            <li>Queries run: {a7.research_activity.queries_run.join(' · ') || 'None recorded.'}</li>
            <li>Candidates found: {a7.research_activity.candidates_found}</li>
            <li>Records opened: {a7.research_activity.records_opened.length ? `#${a7.research_activity.records_opened.join(', #')}` : 'None recorded.'}</li>
            <li>Unopened candidates: {a7.research_activity.unopened_count}</li>
            {a7.research_activity.duration_ms > 0 ? <li>Duration: {a7.research_activity.duration_ms} ms</li> : null}
            <li>{a7.research_activity.note}</li>
          </ul>
        </section>
      )}

      <footer className="hr-footer">
        <span>{reportId}</span>
        <span className="hr-page">Page <span className="hr-page-num" /></span>
        <span className="hr-review">Machine-assisted research. Not a published scholarly certification. {when}</span>
      </footer>
      <p className="hr-designed">Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies</p>
    </article>
  );
};
