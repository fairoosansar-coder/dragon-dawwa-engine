import React from 'react';
import type { DragonDawwaAnalysis } from '../types/hadith.ts';
import type { SupportedLanguage } from '../utils/localization.ts';
import { attachAgent7ToAnalysis } from '../utils/agent7SourceResearch.ts';
import {
  evidenceCounts,
  linkBetween,
  publishedAuthenticity,
  reportIdFor,
  sourcedNarratorChain,
  type EvidenceCounts,
} from '../utils/reportPresentation.ts';
import { authenticityAndLaw, bindReport, splitNarration } from '../utils/reportBinding.ts';
import { reportIdentity } from '../../shared/research/revision.ts';
import { HumanVerification } from './HumanVerification.tsx';
import type { SourceTakhrij } from '../types/hadith.ts';
import { usesHadithAuthentication } from '../categories.ts';

const AGENTS = [
  { n: '01', accent: '#0f6e56', persona: 'Dr. Tariq al-Mansoor', role: 'Takhrij and textual variants' },
  { n: '02', accent: '#0e7490', persona: 'Dr. Layla al-Qasimi', role: 'Transmission and isnad continuity' },
  { n: '03', accent: '#6d28d9', persona: 'Sheikh Imran al-Hasani', role: 'Rijal and narrator criticism' },
  { n: '04', accent: '#b45309', persona: 'Dr. Zainab al-Mubarak', role: 'Shawahid, matn, and defect screening' },
  { n: '05', accent: '#3730a3', persona: 'Sheikh Yusuf al-Azhari', role: 'Attributed scholarly assessments' },
  { n: '06', accent: '#8a6a2f', persona: 'Executive synthesis', role: 'Consensus, executive findings, and the full roundtable' },
  { n: '07', accent: '#9f1239', persona: 'Dr. Amina al-Kindi', role: 'Source research' },
] as const;

function reportWhen(iso?: string): string {
  if (!iso) return 'Not recorded on this dossier';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded on this dossier';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date) + ' Gulf (UTC+4)';
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
    <section id={`hr-section-${n}`} className="hr-section" style={{ ['--hr-accent' as string]: accent }} data-testid={testId}>
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

const LANG_NAME: Record<SupportedLanguage, string> = { en: 'English', ta: 'Tamil', si: 'Sinhala' };

function translationOf(source: SourceTakhrij, lang: SupportedLanguage): string {
  const wording = source.exact_wording || '';
  const english = source.exact_wording_english || '';
  if (lang === 'ta' && /[\u0B80-\u0BFF]/.test(wording)) return wording;
  if (lang === 'si' && /[\u0D80-\u0DFF]/.test(wording)) return wording;
  if (lang === 'en') return english || wording;
  return english || wording;
}

function arabicOf(source: SourceTakhrij): string {
  if (source.exact_wording_arabic) return source.exact_wording_arabic;
  if (/[\u0600-\u06FF]/.test(source.exact_wording)) return source.exact_wording;
  return '';
}

const SUNNAH_COLLECTIONS: { pattern: RegExp; slug: string }[] = [
  { pattern: /bukhari|bukhārī/i, slug: 'bukhari' },
  { pattern: /muslim/i, slug: 'muslim' },
  { pattern: /nasa['’]?i/i, slug: 'nasai' },
  { pattern: /abu da'?ud|abi da'?ud|abū dāwūd/i, slug: 'abudawud' },
  { pattern: /tirmidhi|tirmidhī/i, slug: 'tirmidhi' },
  { pattern: /ibn majah|ibn mājah/i, slug: 'ibnmajah' },
];

function sourceHref(source: SourceTakhrij, lang: SupportedLanguage): string | null {
  const id = source.hadith_number.match(/(\d+)/);
  if (!id) return null;
  if (/hadeethenc/i.test(source.collection)) return `https://hadeethenc.com/${lang}/browse/hadith/${id[1]}`;
  const sunnah = SUNNAH_COLLECTIONS.find(item => item.pattern.test(source.collection));
  if (sunnah) return `https://sunnah.com/${sunnah.slug}:${id[1]}`;
  return null;
}

export const HadithReportPaper: React.FC<{
  analysis: DragonDawwaAnalysis;
  currentLanguage?: SupportedLanguage;
  readerName?: string;
}> = ({ analysis, currentLanguage = 'en', readerName }) => {
  const [reviewLabel, setReviewLabel] = React.useState('Awaiting human verification');
  if (!usesHadithAuthentication(analysis.research_category)) {
    return (
      <article className="hadith-report-paper" lang={currentLanguage}>
        <header className="hr-header">
          <p className="hr-brand">DRAGON DAWWA · By Aegis Intelligence</p>
          <h1 className="hr-title">{analysis.research_category} Research Report</h1>
          <p className="hr-question">{analysis.query_hadith}</p>
          {readerName && <p>{readerName}</p>}
        </header>
        <section className="hr-section" lang={currentLanguage}>
          <h2>Executive Report</h2>
          <p className="whitespace-pre-wrap">{analysis.agent_6_synthesis.executive_report_markdown}</p>
        </section>
        <section className="hr-section" lang={currentLanguage}>
          <h2>Podcast Script</h2>
          <p className="whitespace-pre-wrap">{analysis.agent_6_synthesis.podcast_script}</p>
        </section>
      </article>
    );
  }
  const enriched = bindReport(
    analysis.agent_7_source_research ? analysis : attachAgent7ToAnalysis(analysis, currentLanguage),
  );
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
  const identity = reportIdentity(enriched, reportId, currentLanguage);
  const when = reportWhen(enriched.generated_at);
  const sequence = a2.narrator_sequence ?? [];
  const showTransmissionMap = sourcedNarratorChain(sequence, a2.chain_links ?? []);
  const claims = authenticityAndLaw(enriched);
  const languageName = LANG_NAME[currentLanguage] ?? currentLanguage;

  return (
    <article className="hadith-report-paper" lang={currentLanguage} data-testid="hadith-report-paper">
      <header className="hr-header">
        <p className="hr-brand">DRAGON DAWWA · By Aegis Intelligence</p>
        <h1 className="hr-title">Complete Hadith Research Report</h1>
        <p className="hr-verify-chip">
          <strong data-testid="human-review-status">{reviewLabel}</strong>
          <a href="#hr-section-signoff">View human review</a>
        </p>
        <div className="hr-meta">
          <span>Date<strong>{when}</strong></span>
          <span>Language<strong>{languageName}</strong></span>
          <span>Report ID<strong>{reportId}</strong></span>
          <span>Revision<strong>{identity.revision}</strong></span>
          {enriched.research_job_id ? <span>Job<strong>{enriched.research_job_id}</strong></span> : null}
          {readerName ? <span>Reader<strong>{readerName}</strong></span> : null}
        </div>
        <p className="hr-question" lang={currentLanguage}>{enriched.query_hadith}</p>
      </header>

      <nav className="hr-contents" aria-label="Contents">
        {AGENTS.map(agent => (
          <a key={agent.n} href={`#hr-section-${agent.n}`}>{agent.n} {agent.role}</a>
        ))}
        <a href="#hr-section-completeness">Research completeness</a>
        <a href="#hr-section-signoff">Human verification</a>
      </nav>

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
        <p className="hr-block-label">Authenticity of the narration</p>
        <p className="hr-prose">{claims.authenticity}</p>
        <p className="hr-block-label">Legal conclusions drawn from it</p>
        <p className="hr-prose">{claims.law}</p>
        <p className="hr-block-label">Recorded synthesis</p>
        <p className="hr-prose">{a6.consensus_and_disagreements}</p>
      </div>

      <div className="hr-query">
        <p className="hr-block-label">Researched narration</p>
        <p lang={currentLanguage}>{enriched.query_hadith}</p>
      </div>

      <Section n={AGENTS[0].n} accent={AGENTS[0].accent} kicker={`Agent 1 · ${AGENTS[0].persona}`} title={AGENTS[0].role}>
        <p className="hr-prose">{a1.variants_summary}</p>
        {a1.sources.map((src, i) => {
          const arabic = arabicOf(src);
          const parts = splitNarration(arabic);
          const href = sourceHref(src, currentLanguage);
          return (
            <article className="hr-source-card" data-testid="narration-source-card" key={`${src.collection}-${src.hadith_number}-${i}`}>
              <p className="hr-source-ref"><strong>{src.collection}</strong> · {src.hadith_number}</p>
              {parts.chain ? (
                <>
                  <p className="hr-block-label">Narrator chain</p>
                  <p className="hr-arabic" lang="ar">{parts.chain}</p>
                </>
              ) : null}
              {parts.text ? (
                <>
                  <p className="hr-block-label">Narration text</p>
                  <p className="hr-arabic" lang="ar">{parts.text}</p>
                </>
              ) : null}
              <p className="hr-block-label">Translation ({languageName})</p>
              <p className="hr-prose" lang={currentLanguage}>{translationOf(src, currentLanguage)}</p>
              <p className="hr-block-label">Wording differences</p>
              <p className="hr-prose">{src.wording_differences || 'None recorded for this source.'}</p>
              <p className="hr-block-label">Source link</p>
              {href ? <p><a href={href}>Source link</a></p> : <p className="hr-note">None recorded for this source.</p>}
            </article>
          );
        })}
      </Section>

      <Section n={AGENTS[1].n} accent={AGENTS[1].accent} kicker={`Agent 2 · ${AGENTS[1].persona}`} title={AGENTS[1].role}>
        <p className="hr-prose"><strong>Chain status. </strong>{a2.overall_chain_status}</p>
        <h3 className="hr-block-label">Transmission map</h3>
        {showTransmissionMap ? (
          <>
            <p className="hr-note">This map is the narrator chain. It is separate from the narration text. Every step has a cited connection.</p>
            <div className="hr-chain" data-testid="hadith-transmission-diagram">
              {sequence.map((name, i) => {
                const next = sequence[i + 1];
                const link = next ? linkBetween(name, next, a2.chain_links) : undefined;
                return (
                  <React.Fragment key={`${name}-${i}`}>
                    <div className="hr-node">
                      <strong>{name}</strong>
                    </div>
                    {next && link ? (
                      <div className="hr-link">
                        {`${link.transmission_mode} · ${link.connection_status}. ${link.historical_reasoning}`}
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        ) : (
          <p className="hr-note" data-testid="hadith-transmission-absent">No sourced narrator chain was recorded, so no transmission map is drawn.</p>
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
          <table className="hr-table hr-compare">
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
            {a7.attributed_opinions.map((op, i) => (
              <article className="hr-source-card" key={`${op.author_or_source}-${i}`}>
                <p className="hr-source-ref"><strong>{op.author_or_source}</strong></p>
                <p className="hr-prose">{op.opinion_text}</p>
                {op.reference.startsWith('http') ? <p><a href={op.reference}>Source link</a></p> : <p>{op.reference}</p>}
              </article>
            ))}
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
        <section id="hr-section-completeness" className="hr-section" data-testid="hadith-research-completeness">
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

      <HumanVerification
        jobId={enriched.research_job_id}
        question={enriched.query_hadith}
        reportId={reportId}
        revision={identity.revision}
        language={currentLanguage}
        languageLabel={languageName}
        generatedAt={enriched.generated_at ?? ''}
        onStatus={setReviewLabel}
      />
      <p className="hr-designed">Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies</p>
    </article>
  );
};
