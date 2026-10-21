import { useEffect } from 'react';
import { SP } from './i18n.ts';
import { Hub } from './Hub.tsx';
import { GuideView } from './GuideView.tsx';
import { PrayerTimesView, QiblaView } from './PrayerQibla.tsx';
import { SavedCalculations, ZakahCalculator } from './ZakahView.tsx';
import { FastingCalendar, OccasionView } from './FastingView.tsx';
import { NamesView } from './NamesView.tsx';
import { Checklist, DuaLibrary, Questions, SavedView, TopicsIndex } from './Support.tsx';
import { WorshipLibrary } from './WorshipLibrary.tsx';
import { SLOTS, type SlotId } from './content.ts';

function isSlot(value: string | undefined): value is SlotId {
  return Boolean(value && (SLOTS as readonly string[]).includes(value));
}

export default function SpiritualSection({ segments = [] }: { segments?: string[] }) {
  const [root, a, b] = segments;
  useEffect(() => {
    document.title = `${SP.en.title} · ${SP.en.brand}`;
  }, []);

  let view = <Hub />;
  if (root === 'shahadah') view = <GuideView segments={['shahadah']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'names') view = <NamesView segments={segments} />;
  else if (root === 'salah' && a === 'times') view = <PrayerTimesView segments={segments} />;
  else if (root === 'salah' && a === 'qibla') view = <QiblaView segments={segments} />;
  else if (root === 'salah' && a === 'learn') view = <GuideView segments={['salah', 'learn']} anchor={isSlot(b) ? b : undefined} />;
  else if (root === 'salah' && a === 'purification') view = <GuideView segments={['salah', 'purification']} anchor={isSlot(b) ? b : undefined} />;
  else if (root === 'salah' && a === 'topics' && b) view = <GuideView segments={['salah', 'topics', b]} anchor={isSlot(segments[3]) ? segments[3] : undefined} />;
  else if (root === 'salah' && a === 'topics') view = <TopicsIndex segments={segments} />;
  else if (root === 'salah') view = <GuideView segments={['salah']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'zakah' && a === 'calculator') view = <ZakahCalculator segments={segments} />;
  else if (root === 'zakah' && a === 'calculations') view = <SavedCalculations segments={segments} />;
  else if (root === 'zakah' && a === 'recipients') view = <GuideView segments={['zakah', 'recipients']} anchor={isSlot(b) ? b : undefined} />;
  else if (root === 'zakah') view = <GuideView segments={['zakah']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'fasting' && a === 'calendar') view = <FastingCalendar segments={segments} mode="calendar" />;
  else if (root === 'fasting' && a === 'planner') view = <FastingCalendar segments={segments} mode="planner" />;
  else if (root === 'fasting' && a === 'occasions' && b) view = <OccasionView segments={segments} id={b} />;
  else if (root === 'fasting') view = <GuideView segments={['fasting']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'hajj' && a === 'checklist') view = <Checklist segments={segments} kind="hajj" />;
  else if (root === 'hajj') view = <GuideView segments={['hajj']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'umrah' && a === 'checklist') view = <Checklist segments={segments} kind="umrah" />;
  else if (root === 'umrah') view = <GuideView segments={['umrah']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'library') view = <WorshipLibrary topicId={a} />;
  else if (root === 'dua-dhikr') view = <DuaLibrary segments={segments} />;
  else if (root === 'akhlaq') view = <GuideView segments={['akhlaq']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'new-muslim') view = <GuideView segments={['new-muslim']} anchor={isSlot(a) ? a : undefined} />;
  else if (root === 'calendar') view = <FastingCalendar segments={segments} mode="calendar" />;
  else if (root === 'saved') view = <SavedView segments={segments} />;
  else if (root === 'questions') view = <Questions segments={segments} />;
  else if (root) view = <GuideView segments={segments} />;

  return <div className="dd-spiritual">{view}</div>;
}
