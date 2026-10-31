const MARKS = {
  shahadah: '/assets/icon-shahadah.jpg',
  salah: '/assets/icon-salah.jpg',
  zakah: '/assets/icon-zakah.jpg',
  sawm: '/assets/icon-sawm.jpg',
  hajj: '/assets/icon-hajj.jpg',
  prayerTimes: '/assets/icon-prayer-times.jpg',
  qibla: '/assets/icon-qibla.jpg',
  zakahCalc: '/assets/icon-zakah-calc.jpg',
  fastingCalendar: '/assets/icon-fasting-calendar.jpg',
  dua: '/assets/icon-dua.jpg',
  library: '/assets/icon-library.jpg',
  checklist: '/assets/icon-checklist.jpg',
  knowledge: '/assets/icon-knowledge.jpg',
  quran: '/assets/icon-quran.jpg',
  hadith: '/assets/icon-hadith.jpg',
  books: '/assets/icon-books.jpg',
  worship: '/assets/icon-worship.jpg',
  podcast: '/assets/icon-podcast.jpg',
  discover: '/assets/icon-discover.jpg',
  deepen: '/assets/icon-deepen.jpg',
  prophet: '/assets/icon-prophet.jpg',
  saved: '/assets/icon-saved.jpg',
} as const;

export type StudioMarkName = keyof typeof MARKS;

export function StudioMark({ name, className = '' }: { name: StudioMarkName; className?: string }) {
  return <img src={MARKS[name]} alt="" draggable={false} className={`bg-[#064936] object-cover ${className}`} />;
}
