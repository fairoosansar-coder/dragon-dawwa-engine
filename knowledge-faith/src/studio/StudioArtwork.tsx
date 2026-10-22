import type { ProgrammeFamily, ProgrammeFamilyId } from '../shared/studio/contracts.ts';

/**
 * Restrained Islamic geometric star and classic radio dial artwork for Dragon Dawwa Studio.
 * Uses deep saturated emerald (#064936), warm ivory (#faf6ec), and gold details (#c9a14e).
 */
export function ProgrammeMedallion({
  familyId,
  channelNumber,
  dialFrequency,
  size = 'lg',
}: {
  familyId: ProgrammeFamilyId;
  channelNumber: string;
  dialFrequency: string;
  size?: 'sm' | 'lg';
}) {
  const isLarge = size === 'lg';
  const bgTone =
    familyId === 'bayan-lessons' || familyId === 'research-room'
      ? 'from-[#064936] via-[#07533f] to-[#172720]'
      : familyId === 'hadith-lens' || familyId === 'faith-discovery'
        ? 'from-[#172720] via-[#064936] to-[#244875]'
        : 'from-[#064936] via-[#07533f] to-[#064936]';

  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-between overflow-hidden rounded-3xl border border-gold/60 bg-gradient-to-br ${bgTone} text-sand shadow-sm ${
        isLarge ? 'h-36 w-36 p-4 sm:h-44 sm:w-44' : 'h-16 w-16 p-2'
      }`}
      aria-hidden="true"
    >
      {/* Subtle 8-point Khatam geometric star ornament */}
      <svg
        viewBox="0 0 120 120"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
        fill="none"
        stroke="#c9a14e"
        strokeWidth="1.2"
      >
        <circle cx="60" cy="60" r="52" strokeDasharray="2 4" />
        <circle cx="60" cy="60" r="42" />
        <rect x="28" y="28" width="64" height="64" />
        <rect x="28" y="28" width="64" height="64" transform="rotate(45 60 60)" />
        <circle cx="60" cy="60" r="16" />
      </svg>

      <div className="relative z-10 flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
        <span>{channelNumber}</span>
        {isLarge && <span>{dialFrequency} MHz</span>}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <span className={`font-display font-bold tracking-wider text-gold ${isLarge ? 'text-2xl sm:text-3xl' : 'text-xs'}`}>
          {dialFrequency}
        </span>
        {isLarge && (
          <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-sand/80">
            Dragon Dawwa
          </span>
        )}
      </div>

      {isLarge && (
        <div className="relative z-10 flex w-full items-center justify-center gap-1">
          <span className="h-px flex-1 bg-gold/40" />
          <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
          <span className="h-px flex-1 bg-gold/40" />
        </div>
      )}
    </div>
  );
}

/**
 * Classic Radio Dial / Channel Tuning Scale for the 7 Programme Families.
 * Keeps interface labels in English and allows tuning directly between families.
 */
export function RadioDialTuner({
  families,
  activeFamilyId,
  onSelectFamily,
}: {
  families: ProgrammeFamily[];
  activeFamilyId: ProgrammeFamilyId;
  onSelectFamily: (id: ProgrammeFamilyId) => void;
}) {
  return (
    <nav
      aria-label="Studio programme channels"
      className="rounded-3xl border border-gold/50 bg-[#064936] px-4 py-3 text-sand shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gold/25 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rotate-45 bg-gold" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Programme Dial · 7 Studio Channels
          </span>
        </div>
        <span className="text-[11px] text-sand/75">
          Select a channel to tune programme family
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
        {families.map(family => {
          const active = family.id === activeFamilyId;
          return (
            <button
              key={family.id}
              type="button"
              onClick={() => onSelectFamily(family.id)}
              aria-pressed={active}
              className={`group flex min-w-[148px] shrink-0 flex-col items-start rounded-2xl border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-gold bg-[#faf6ec] text-[#172720] shadow-xs'
                  : 'border-gold/25 bg-[#07533f]/70 text-sand hover:border-gold/60 hover:bg-[#07533f]'
              }`}
            >
              <div className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em]">
                <span className={active ? 'text-[#064936]' : 'text-gold'}>{family.channelNumber}</span>
                <span className={`font-mono ${active ? 'text-[#064936]' : 'text-gold/90'}`}>{family.dialFrequency}</span>
              </div>
              <span className={`mt-1 line-clamp-1 font-display text-sm font-bold ${active ? 'text-[#064936]' : 'text-sand'}`}>
                {family.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
