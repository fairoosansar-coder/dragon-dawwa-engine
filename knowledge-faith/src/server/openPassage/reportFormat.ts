import type {Lang} from '../../shared/sources.ts';
import {reportCopy} from '../../shared/openPassageLanguage.ts';
export interface OpenPassageSource {
  linkOnly?:boolean;
  id: string;
  locator: string;
  text: string;
  provider: string;
  canonicalUrl: string;
  publishedGrade?: string | null;
}

export interface OpenPassageSection {
  title: string;
  summary: string;
  points: string[];
  citations: string[];
}

export interface OpenPassageTurn {
  castSpeaker?: string;
  voiceRole?:'host'|'guest';
  speaker: string;
  text: string;
}

export interface OpenPassageReport {
  language?:Lang;
  question: string;
  status: string;
  full: boolean;
  summary: string;
  sections: OpenPassageSection[];
  sources: OpenPassageSource[];
  limit: string;
  turns: OpenPassageTurn[];
  markdown: string;
  revision: string;
  reportOrigin?: string;
}

/** Only present an opened source as a citation, never a role's default label. */
export function finalizeOpenPassageReport(
  report: Omit<OpenPassageReport, 'markdown' | 'revision'> & { revision?: string },
): OpenPassageReport {
  const revision =
    report.revision ||
    `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const c=reportCopy(report.language??'en');
  let md = `# ${report.question}\n\nOpen Passage | ${report.status}\n\n${c.revision}: ${revision}\n\n## ${c.answer}\n\n${report.summary}`;
  const sections = report.sections.map(section => {
    const blob = [section.summary, ...section.points, ...section.citations].join(' ');
    const citations = report.sources
      .filter(source => {
        const key = source.id.includes(':') ? source.id.split(':').slice(1).join(':') : source.id;
        try {
          return new RegExp(`(?<!\\d)${escapeRegExp(key)}(?!\\d)`).test(blob);
        } catch {
          return blob.includes(key);
        }
      })
      .map(source => source.locator);
    md += `\n\n## ${section.title}\n\n${section.summary}\n\n${section.points.map(p => `- ${p}`).join('\n')}\n\n${!report.language||report.language==='en'?'Opened references identified in this section':c.references}: ${citations.join('; ') || c.none}`;
    return { ...section, citations };
  });
  md += `\n\n## ${c.sources}\n\n${
    report.sources.length
      ? report.sources
          .map(
            s =>
              `### ${s.locator}\n${s.text}\n\n${s.provider} · ${s.canonicalUrl}`,
          )
          .join('\n\n')
      : c.noSource
  }`;
  md += `\n\n## ${c.limits}\n\n${report.limit}\n\n## ${c.transcript}\n\n${report.turns
    .map(t => `${t.speaker}: ${t.text}`)
    .join('\n\n')}\n\n${c.credit}\n`;
  return { ...report, sections, markdown: md, revision };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
