import { lazy, Suspense, useEffect } from 'react';
import type { ViewProps } from '../../App.tsx';
import { Loading } from '../../components/ui.tsx';
import { findGuide, findTopic, type TopicId } from '../../shared/spiritual/catalog.ts';
import { migrateSpiritualStorage, useSp } from '../../lib/spiritualStore.ts';

const SpiritualHub = lazy(() => import('./SpiritualHub.tsx'));
const TopicView = lazy(() => import('./TopicView.tsx'));
const GuideReader = lazy(() => import('./GuideReader.tsx'));
const PrayerTimesView = lazy(() => import('./PrayerTimesView.tsx'));
const QiblaView = lazy(() => import('./QiblaView.tsx'));
const SalahLearnView = lazy(() => import('./SalahLearnView.tsx'));
const ZakahCalculatorView = lazy(() => import('./ZakahCalculatorView.tsx'));
const SavedCalculationsView = lazy(() => import('./SavedCalculationsView.tsx'));
const ZakahRecipientsView = lazy(() => import('./ZakahRecipientsView.tsx'));
const FastingCalendarView = lazy(() => import('./FastingCalendarView.tsx'));
const FastingPlannerView = lazy(() => import('./FastingPlannerView.tsx'));
const ChecklistView = lazy(() => import('./ChecklistView.tsx'));
const DuaDhikrView = lazy(() => import('./DuaDhikrView.tsx'));
const QuestionsView = lazy(() => import('./QuestionsView.tsx'));
const SavedView = lazy(() => import('./SavedView.tsx'));
const EditorialDeskView = lazy(() => import('./EditorialDeskView.tsx'));

function Resolve({ parts }: { parts: string[] }) {
  const [first, second] = parts;
  if (!first) return <SpiritualHub />;
  switch (first) {
    case 'saved':
      return <SavedView />;
    case 'questions':
      return <QuestionsView />;
    case 'dua-dhikr':
      return <DuaDhikrView />;
    case 'calendar':
      return <FastingCalendarView mode="calendar" />;
    case 'editorial':
      return <EditorialDeskView />;
    case 'guide': {
      const found = second ? findGuide(second) : undefined;
      return found ? <GuideReader slug={found.guide.slug} /> : <SpiritualHub />;
    }
  }
  const topic = findTopic(first);
  if (!topic) return <SpiritualHub />;
  const tool = `${first}/${second ?? ''}`;
  switch (tool) {
    case 'salah/times':
      return <PrayerTimesView />;
    case 'salah/qibla':
      return <QiblaView />;
    case 'salah/learn':
      return <SalahLearnView />;
    case 'zakah/calculator':
      return <ZakahCalculatorView />;
    case 'zakah/calculations':
      return <SavedCalculationsView />;
    case 'zakah/recipients':
      return <ZakahRecipientsView />;
    case 'fasting/calendar':
      return <FastingCalendarView mode="fasting" />;
    case 'fasting/planner':
      return <FastingPlannerView />;
    case 'hajj/checklist':
      return <ChecklistView kind="hajj" />;
    case 'umrah/checklist':
      return <ChecklistView kind="umrah" />;
  }
  return <TopicView id={topic.id as TopicId} />;
}

export default function SpiritualSection({ sub, segments }: ViewProps) {
  const { s } = useSp();
  const parts = segments ?? (sub ?? '').split('/').filter(Boolean);
  const path = parts.join('/');

  useEffect(() => {
    migrateSpiritualStorage();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<Loading label={s.loading} />}>
        <Resolve parts={parts} />
      </Suspense>
    </div>
  );
}
