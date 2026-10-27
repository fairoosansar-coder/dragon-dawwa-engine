import { RubElHizb } from '../engine/ds/ornaments.tsx';

export function BookCover({ title, image, essential }: { title: string; image: string | null; essential?: boolean }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-gold/50 bg-pine shadow-sm">
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-between bg-gradient-to-b from-pine to-moss px-3 py-4 text-center">
          <RubElHizb size={26} />
          <p className="line-clamp-5 font-display text-sm leading-snug text-sand">{title}</p>
          <span className="text-[10px] uppercase tracking-[0.16em] text-sand/70">Dragon Dawwa</span>
        </div>
      )}
      {essential && (
        <span className="absolute left-2 top-2 rounded-full border border-gold bg-sand/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pine">
          Essential
        </span>
      )}
    </div>
  );
}
