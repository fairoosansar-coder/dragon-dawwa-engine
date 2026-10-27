import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PodcastScriptPlayer } from './components/PodcastScriptPlayer.tsx';
import { ArchBanner, StarDivider } from './ds/ornaments.tsx';
import { EngineFrame } from './EngineFrame.tsx';
import { useDossier } from './DossierContext.tsx';
import { useApp } from '../lib/store.tsx';
import { stopAudio } from '../lib/audio.ts';

export default function Roundtable() {
  const { t, config } = useApp();
  const d = useDossier();
  if (!d.displayed) {
    return (
      <EngineFrame className="space-y-6">
        <p data-testid="roundtable-empty" className="rounded-2xl bg-[#f6efe2] px-4 py-3 text-sm text-[#1c1915]">
          No podcast is loaded for this content language. Open a saved research item, or generate again. The previous episode is not played in its place.
        </p>
      </EngineFrame>
    );
  }
  const s = d.displayed.agent_6_synthesis;
  useEffect(() => stopAudio(), []);
  return (
    <EngineFrame className="space-y-6">
      <ArchBanner
        compact
        title="Your listening space"
        arabic="مجلس العلم"
        subtitle="Listen to AI-generated research discussions with Gemini voices. Read the report alongside the conversation."
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-[var(--surface-panel)] p-4">
        <p className="min-w-0 flex-1 text-sm text-slate-300">
          <span className="font-semibold text-amber-300">{s.final_status}</span>
          {' · '}
          <span className="line-clamp-2">{d.displayed.query_hadith}</span>
        </p>
        <a
          href="#/hadith/research"
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden /> {t.openDossier}
        </a>
      </div>
      <StarDivider label="مجلس العلم" />
      <PodcastScriptPlayer
        key={`${d.displayed.query_hadith}-${d.displayed.content_language ?? d.lang}`}
        script={s.podcast_script}
        executiveReport={s.executive_report_markdown}
        onShare={() => void d.share()}
        neuralVoice={config == null || config.ai === true}
        language={d.displayed.content_language ?? d.lang}
        audioReady={d.audioReady}
        savedClips={d.savedClips}
        onClip={d.rememberClip}
      />
    </EngineFrame>
  );
}
