/**
 * Parallel.ai controls every category except Hadith & Authentication.
 * The Task API runs one task, not seven model calls. This module loads the
 * domain map, asks that one task to cover the seven agents, and lets the
 * existing research engine open each agent's source target.
 * The broadcast script is written afterwards from the agents that ran.
 */

import type { DomainAgentResult, DragonDawwaAnalysis } from '../../engine/types/hadith.ts';
import { scriptMatchesLanguage } from '../../engine/utils/contentLanguage.ts';
import { scrubVanakkam } from '../../engine/utils/tamilGreeting.ts';
import type { EvidencePassage } from '../../shared/contracts/v1.ts';
import type { Lang } from '../../shared/sources.ts';
import {
  assignmentForDomain,
  parallelTaskInput,
  resolveDomainConfig,
  SPEAKER_LABEL,
  SPEAKER_PERSONA,
  type DomainAgentConfig,
  type DomainResearchConfig,
  type EvidenceKind,
} from './agentConfig.ts';
import { agentsThatRan, writeBroadcastScript, type BroadcastAgent } from './broadcastScript.ts';
import type { ResearchPorts, ResearchRun } from './engine.ts';
import { findCompletedResearch, storedAnalysisJson, type LookupOptions } from '../researchIdempotency.ts';
import type { ParallelAgentReport, ParallelConsult } from './parallelTask.ts';

export const PARALLEL_DISPATCH_NOTE =
  'Parallel.ai runs one task for the seven configured agents. That task does not start seven separate model calls. The research engine opens each configured source, and the same Parallel task returns the web citations.';

export interface OrchestratorDeps {
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  pollMs?: number;
  ports?: ResearchPorts;
  lookup?: typeof findCompletedResearch;
  lookupOptions?: LookupOptions;
  runResearch?: (input: {
    question: string;
    language: Lang;
    ports: ResearchPorts;
    assignment: ReturnType<typeof assignmentForDomain>;
    parallel: {
      apiKey?: string | null;
      fetchImpl?: typeof fetch;
      pollMs?: number;
      taskInput?: string;
      agents?: { id: string; role: string; goal: string; sourceTarget: string }[];
    };
  }) => Promise<ResearchRun>;
}

export interface DomainAgentRecord extends BroadcastAgent, DomainAgentResult {}

function clip(text: string, max = 360): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function passagesFor(kind: EvidenceKind, passages: readonly EvidencePassage[]): EvidencePassage[] {
  switch (kind) {
    case 'quran-arabic':
      return passages.filter(passage =>
        passage.source.provider === 'QuranEnc'
        && Boolean(passage.arabic?.trim())
        && passage.role !== 'commentary'
        && !passage.context?.startsWith('Neighbouring'),
      );
    case 'quran-translation':
      return passages.filter(passage =>
        (passage.source.provider === 'QuranEnc' || passage.source.provider === 'AlQuran')
        && passage.role === 'translation'
        && Boolean(passage.text.trim())
        && !passage.context?.startsWith('Neighbouring'),
      );
    case 'quran-context':
      return passages.filter(passage => passage.context?.startsWith('Neighbouring'));
    case 'tafsir':
      return passages.filter(passage => passage.role === 'commentary' && passage.source.provider !== 'Parallel');
    case 'alquran':
      return passages.filter(passage => passage.source.provider === 'AlQuran');
    case 'books':
      return passages.filter(passage => passage.source.provider === 'IslamHouse' || passage.source.contentType === 'book');
    case 'hadeethenc':
      return passages.filter(passage => passage.source.provider === 'HadeethEnc');
    case 'hadith-api':
      return passages.filter(passage => passage.source.provider === 'hadith-api');
    case 'parallel':
      return passages.filter(passage => passage.source.provider === 'Parallel' && passage.text.trim().length > 20);
    case 'chronology':
      return passages.filter(passage => /\b\d{1,4}\s*(?:AH|BH|CE)\b|\bHijrah\b|\bhijra\b/i.test(`${passage.text} ${passage.context ?? ''}`));
    case 'historians':
      return passages.filter(passage => /Ibn Ishaq|Ibn Hisham|al-Tabari|al-Waqidi|Ibn Kathir/i.test(`${passage.text} ${passage.context ?? ''} ${passage.source.title}`));
    case 'variants': {
      const primary = passages.filter(passage => passage.source.provider !== 'Parallel' && !passage.context?.startsWith('Neighbouring'));
      return primary.length >= 2 ? primary.slice(0, 2) : [];
    }
    case 'opened-sources':
      return passages.filter(passage => passage.source.provider !== 'Parallel' && passage.text.trim().length > 0);
    case 'aggregated':
      return [];
    default:
      return [];
  }
}

function quotePassage(passage: EvidencePassage): string {
  const body = [passage.arabic?.trim(), passage.text.trim()].filter(Boolean).join(' ');
  const url = passage.source.canonicalUrl?.trim();
  return `${passage.locator}: ${clip(body)}${url ? ` (${url})` : ''}`;
}

function dedupePassages(passages: readonly EvidencePassage[]): EvidencePassage[] {
  const seen = new Set<string>();
  const kept: EvidencePassage[] = [];
  for (const passage of passages) {
    const key = passage.id || `${passage.source.canonicalUrl}\n${passage.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(passage);
  }
  return kept;
}

function sourceFromPassage(passage: EvidencePassage): { title: string; url: string; excerpt: string } {
  return {
    title: passage.source.title || passage.locator,
    url: passage.source.canonicalUrl,
    excerpt: clip(passage.text || passage.arabic || passage.locator, 280),
  };
}

function recordFrom(agent: DomainAgentConfig, finding: string, sources: DomainAgentRecord['sources'], status: 'ran' | 'not_run'): DomainAgentRecord {
  return {
    id: agent.id,
    role: agent.role,
    persona: SPEAKER_PERSONA[agent.speaker],
    speaker: SPEAKER_LABEL[agent.speaker],
    goal: agent.goal,
    sourceTarget: agent.sourceTarget,
    status,
    finding: status === 'ran' ? finding : '',
    sources: status === 'ran' ? sources : [],
  };
}

function reconciliationFinding(language: Lang, roles: string): string {
  if (language === 'ta') {
    return `ஓடிய முகவர்கள்: ${roles}. நிறுவப்பட்டது அவர்கள் திறந்த மூலத்திலிருந்து மேற்கோள் காட்டியது மட்டும். திறக்கப்படாதது சேர்க்கப்படவில்லை. இது ஒரு ஹதீஸ் தரம் அல்ல.`;
  }
  if (language === 'si') {
    return `ක්‍රියාත්මක වූ නියෝජිතයන්: ${roles}. පිහිටුවා ඇත්තේ ඔවුන් විවෘත මූලාශ්‍රයෙන් උපුටා දැක්වූ දේ පමණි. නොවිවෘත දේ එකතු කළේ නැත. මෙය හදීස් ශ්‍රේණියක් නොවේ.`;
  }
  return `The agents who ran were ${roles}. What is established is only what they quoted from the opened sources. What was not opened was not added. This is not a hadith grade.`;
}

export function buildDomainAgents(
  config: DomainResearchConfig,
  passages: readonly EvidencePassage[],
  reports: readonly ParallelAgentReport[],
  language: Lang = 'en',
): DomainAgentRecord[] {
  const byId = new Map(reports.map(report => [report.id, report]));
  const built = config.agents.map(agent => {
    if (agent.evidence.includes('aggregated')) {
      return recordFrom(agent, '', [], 'not_run');
    }
    const local = dedupePassages(agent.evidence.flatMap(kind => passagesFor(kind, passages))).slice(0, 3);
    const report = byId.get(agent.id);
    const parts = [
      local.length ? local.map(quotePassage).join(' ') : '',
      report?.status === 'ran' ? report.finding : '',
    ].filter(Boolean);
    const sources = [
      ...local.map(sourceFromPassage),
      ...(report?.status === 'ran' ? report.sources : []),
    ].filter(source => source.url && source.excerpt);
    const finding = clip(parts.join(' '), 1100);
    const ran = Boolean(finding) && (local.length > 0 || report?.status === 'ran');
    return recordFrom(agent, finding, sources, ran ? 'ran' : 'not_run');
  });
  const specialists = built.filter(agent => !config.agents.find(item => item.id === agent.id)?.evidence.includes('aggregated') && agent.status === 'ran');
  return built.map(agent => {
    const defined = config.agents.find(item => item.id === agent.id);
    if (!defined?.evidence.includes('aggregated')) return agent;
    if (!specialists.length) return agent;
    const roles = specialists.map(item => item.role).join(', ');
    return recordFrom(
      defined,
      reconciliationFinding(language, roles),
      specialists.flatMap(item => item.sources).slice(0, 8),
      'ran',
    );
  });
}

function executiveReport(config: DomainResearchConfig, agents: readonly DomainAgentRecord[], parallel: ParallelConsult | null): string {
  const ran = agents.filter(agent => agent.status === 'ran');
  const idle = agents.filter(agent => agent.status !== 'ran');
  const sources = ran.flatMap(agent => agent.sources.map(source => `- ${source.title} — ${source.url}`));
  const uniqueSources = [...new Set(sources)];
  return [
    '## Category',
    config.label,
    '',
    '## Dispatch',
    PARALLEL_DISPATCH_NOTE,
    parallel?.runId ? `Parallel run: ${parallel.runId}.` : 'No Parallel run id was returned.',
    parallel?.status === 'credentials_missing' ? 'Parallel credentials were missing, so the web task did not run. Local sources that opened are still quoted.' : '',
    '',
    '## Agents that ran',
    ran.length ? ran.map(agent => `- ${agent.role} (${agent.persona}): ${agent.finding}`).join('\n') : '- None.',
    '',
    '## Agents that did not run',
    idle.length ? idle.map(agent => `- ${agent.role}`).join('\n') : '- None.',
    '',
    '## Sources',
    uniqueSources.length ? uniqueSources.join('\n') : '- No source URL was opened.',
    '',
    '---',
    '*Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies*',
  ].filter(line => line !== undefined).join('\n');
}

function analysisFrom(
  config: DomainResearchConfig,
  query: string,
  language: Lang,
  agents: DomainAgentRecord[],
  parallel: ParallelConsult | null,
): DragonDawwaAnalysis {
  const script = writeBroadcastScript({ question: query, language, agents });
  const report = executiveReport(config, agents, parallel);
  const spoken = `${script}\n${report}`;
  const dossier: DragonDawwaAnalysis = {
    app_name: 'Dragon Dawwa',
    version: '2.5 Enterprise Engine',
    platform_owner: 'Prime Dragon Technologies (Pvt) Ltd',
    designed_and_created_by: 'Aegis Intelligence Pvt Ltd, Sri Lanka',
    query_hadith: query,
    generated_at: new Date().toISOString(),
    research_category: config.label,
    domain_agents: agents,
    parallel_run_id: parallel?.runId ?? null,
    agent_1_takhrij: { sources: [], variants_summary: 'Hadith authentication did not run.' },
    agent_2_isnad: { narrator_sequence: [], chain_links: [], overall_chain_status: 'Not run' },
    agent_3_rijal: { narrators: [] },
    agent_4_shawahid_matn: { supporting_reports: [], hidden_defects_ilal: [], contradictions: [] },
    agent_5_scholars_verdict: { gradings: [] },
    agent_6_synthesis: {
      final_status: 'Not a hadith grade',
      purity_confidence_score: 0,
      consensus_and_disagreements: 'Only disagreements present in the agents that ran are included. None were added.',
      executive_report_markdown: report,
      podcast_script: script,
    },
  };
  if (scriptMatchesLanguage(spoken, language)) dossier.content_language = language;
  return scrubVanakkam(dossier);
}

async function defaultRun(input: Parameters<NonNullable<OrchestratorDeps['runResearch']>>[0]): Promise<ResearchRun> {
  const { executeResearch } = await import('./engine.ts');
  const { defaultResearchPorts } = await import('./ports.ts');
  return executeResearch({ ...input, ports: input.ports ?? defaultResearchPorts() });
}

export async function orchestrateDomainResearch(input: {
  category: string;
  query: string;
  language: Lang;
  deps?: OrchestratorDeps;
}): Promise<DragonDawwaAnalysis> {
  const config = resolveDomainConfig(input.category);
  if (!config || config.controller !== 'parallel') {
    throw new Error('This category has no Parallel research agents configured. Hadith authentication was not run.');
  }
  const question = input.query.trim();
  if (!question) throw new Error('A question is required. No research was run.');

  const lookup = input.deps?.lookup ?? findCompletedResearch;
  const saved = await lookup(
    { question, category: config.label, language: input.language },
    input.deps?.lookupOptions ?? {},
  );
  const stored = saved ? storedAnalysisJson(saved) : null;
  if (stored && stored.agent_6_synthesis && typeof stored.agent_6_synthesis === 'object') {
    return stored as unknown as DragonDawwaAnalysis;
  }

  const runResearch = input.deps?.runResearch ?? defaultRun;
  const ports = input.deps?.ports ?? (await import('./ports.ts')).defaultResearchPorts();
  const run = await runResearch({
    question,
    language: input.language,
    ports,
    assignment: assignmentForDomain(config),
    parallel: {
      apiKey: input.deps?.apiKey,
      fetchImpl: input.deps?.fetchImpl,
      pollMs: input.deps?.pollMs ?? 8_000,
      taskInput: parallelTaskInput(config, question, input.language),
      agents: config.agents.map(agent => ({
        id: agent.id,
        role: agent.role,
        goal: agent.goal,
        sourceTarget: agent.sourceTarget,
      })),
    },
  });
  if (run.job.status === 'cancelled') throw new Error('Research was cancelled. An unfinished result was not marked as a completed answer.');
  const agents = buildDomainAgents(config, run.dossier.passages, run.parallelConsult?.agentReports ?? [], input.language);
  if (!agentsThatRan(agents).some(agent => !config.agents.find(item => item.id === agent.id)?.evidence.includes('aggregated'))) {
    throw new Error('The research engine and Parallel returned no sourced agent findings. An empty result was not marked as a completed answer.');
  }
  return analysisFrom(config, question, input.language, agents, run.parallelConsult ?? null);
}
