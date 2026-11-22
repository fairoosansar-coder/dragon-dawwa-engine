export interface OpenPassageSource {
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
  speaker: string;
  text: string;
}

export interface OpenPassageReport {
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
  let md = `# ${report.question}\n\nOpen Passage | ${report.status}\n\nRevision: ${revision}\n\n## Plain-language answer\n\n${report.summary}`;
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
    md += `\n\n## ${section.title}\n\n${section.summary}\n\n${section.points.map(p => `- ${p}`).join('\n')}\n\nOpened references identified in this section: ${citations.join('; ') || 'None identified.'}`;
    return { ...section, citations };
  });
  md += `\n\n## Opened sources\n\n${
    report.sources.length
      ? report.sources
          .map(
            s =>
              `### ${s.locator}\n${s.text}\n\n${s.provider} · ${s.canonicalUrl}`,
          )
          .join('\n\n')
      : 'No matching source was opened.'
  }`;
  md += `\n\n## Scope and limitations\n\n${report.limit}\n\n## Podcast transcript\n\n${report.turns
    .map(t => `${t.speaker}: ${t.text}`)
    .join('\n\n')}\n\nFree to readers. Supported by Aegis Intelligence.\n`;
  return { ...report, sections, markdown: md, revision };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
