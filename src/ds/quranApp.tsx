// QuranApp — composes the Quran pages: Home, Read (Mushaf e-book), Search, Ayah Study, My Quran.
// Word, phrase and ayah selection, reader settings, translations, tafsir and morphology follow the Quran.ai reader.
import React from 'react';
import { QuranProvider, QuranProviderProps, useQ, QuranSubNav, QuranHome, QuranReader, MyQuranCollection, QuranAudioPlayer, SourcesDrawer } from './quran';
import { AyahStudy, WordSheet } from './quranStudy';
import { QuranBook, QuranSearch, ShareAyahSheet, AyahSheet } from './quranBook';

export interface QuranAppProps extends QuranProviderProps {
  readerState?: 'loading' | 'error' | 'missing'; tafsirState?: 'loading' | 'unavailable';
  collectionTab?: 'bookmarks' | 'notes' | 'submissions' | 'progress'; drawerOpen?: boolean;
  searchQuery?: string; searchFilters?: React.ComponentProps<typeof QuranSearch>['initialFilters'];
}
const Views: React.FC<Omit<QuranAppProps, keyof QuranProviderProps>> = ({ readerState, tafsirState, collectionTab, drawerOpen, searchQuery, searchFilters }) => {
  const q = useQ();
  React.useEffect(() => { if (drawerOpen) q.setDrawer(true); }, []);
  return (
    <div className="space-y-5">
      <QuranSubNav />
      {q.view === 'home' && <QuranHome />}
      {q.view === 'book' && <QuranBook />}
      {q.view === 'reader' && <QuranReader forceState={readerState} />}
      {q.view === 'search' && <QuranSearch initialQuery={searchQuery} initialFilters={searchFilters} />}
      {q.view === 'study' && <AyahStudy tafsirState={tafsirState} />}
      {q.view === 'collection' && <MyQuranCollection initialTab={collectionTab} />}
      {q.view !== 'book' && (q.view === 'reader' || q.view === 'study' || q.audio.ref) && <QuranAudioPlayer />}
      {q.view !== 'book' && <AyahSheet />}
      <WordSheet />
      <SourcesDrawer />
      <ShareAyahSheet />
    </div>
  );
};
export const QuranApp: React.FC<QuranAppProps> = ({ readerState, tafsirState, collectionTab, drawerOpen, searchQuery, searchFilters, ...p }) => (
  <QuranProvider {...p}><Views readerState={readerState} tafsirState={tafsirState} collectionTab={collectionTab} drawerOpen={drawerOpen} searchQuery={searchQuery} searchFilters={searchFilters} /></QuranProvider>
);
