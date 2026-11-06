import type { Lang } from '../../shared/sources.ts';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

/** One carved plate for the Basmala and its meaning. Every surah header uses this, not a local stack. */
export function BismillahArtwork({ meaning, lang }: { meaning: string; lang: Lang }) {
  return (
    <div data-bismillah-block className="relative mt-3 scroll-mt-28 overflow-hidden rounded-xl border border-[#C9A14E]/70 bg-[#F6F1E4]">
      <img
        src="/assets/geometric-cream.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F6F1E4]/25 via-[#F6F1E4]/88 to-[#F6F1E4]/25" />
      <div className="relative px-3 py-2 text-center sm:px-6 sm:py-2.5">
        <p
          data-bismillah
          lang="ar"
          dir="rtl"
          className="font-['Amiri_Quran','Scheherazade_New',Amiri,serif] text-[1.35rem] leading-[1.7] text-[#123A2E] sm:text-[1.7rem]"
        >
          {BISMILLAH}
        </p>
        {meaning ? (
          <p
            data-bismillah-meaning
            lang={lang}
            className={`mx-auto mt-1 max-w-3xl text-xs leading-snug text-[#1a2744] sm:text-sm ${lang === 'en' ? '' : "font-['Noto_Sans_Tamil','Noto_Sans_Sinhala',sans-serif]"}`}
          >
            {meaning}
          </p>
        ) : null}
      </div>
    </div>
  );
}
