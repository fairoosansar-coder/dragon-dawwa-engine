import { useEffect } from 'react';
import { QuranApp } from './ds/quranApp.tsx';
import { EngineFrame } from './EngineFrame.tsx';
import { useApp } from '../lib/store.tsx';
import { stopAudio } from '../lib/audio.ts';

export default function QuranStudyEdition() {
  const { t, lang } = useApp();
  useEffect(() => stopAudio(), []);
  return (
    <>
      <p className="mb-4 text-sm text-ink/70">{t.quranStudyHint}</p>
      <EngineFrame>
        <QuranApp language={lang} dataUrl="/data/quran-en.json" />
      </EngineFrame>
    </>
  );
}
