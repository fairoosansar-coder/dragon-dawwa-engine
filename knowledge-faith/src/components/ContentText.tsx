import { contentSegments } from '../shared/research/report.ts';

/** English document chrome around a run of Tamil, Sinhala, Arabic, or English text. */
export function ContentText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {contentSegments(text).map((segment, index) => (
        <span key={`${segment.lang}-${index}`} lang={segment.lang} dir={segment.dir}>
          {segment.text}
        </span>
      ))}
    </span>
  );
}
