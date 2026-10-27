import { useEffect, useMemo, useRef, useState } from 'react';
import { ContentText } from '../components/ContentText.tsx';
import type { RoundtableLine } from '../shared/research/roundtable.ts';

function stampSeconds(at?: string): number {
  if (!at) return 0;
  const [minutes, seconds] = at.split(':');
  const value = Number(minutes) * 60 + Number(seconds);
  return Number.isFinite(value) ? value : 0;
}

function clock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const whole = Math.floor(safe);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** One player for the episode: play, scrub, speed, and the continuous transcript. */
export function PodcastPlayer({
  episodeId,
  lines,
  audioBase64,
  mimeType,
}: {
  episodeId: string;
  lines: RoundtableLine[];
  audioBase64?: string;
  mimeType?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [active, setActive] = useState(0);
  const src = audioBase64 ? `data:${mimeType || 'audio/wav'};base64,${audioBase64}` : undefined;
  const planned = Math.max(1, ...lines.map(line => stampSeconds(line.at)));
  const scale = duration > 0 ? duration / planned : 1;
  const chapters = useMemo(() => {
    const seen = new Set<string>();
    const chips: { title: string; index: number }[] = [];
    lines.forEach((line, index) => {
      const title = line.chapter || 'Episode';
      if (seen.has(title)) return;
      seen.add(title);
      chips.push({ title, index });
    });
    return chips;
  }, [lines]);

  useEffect(() => {
    const node = audioRef.current;
    if (node) node.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    setPlaying(false);
    setActive(0);
  }, [episodeId, src]);

  function seekToLine(index: number) {
    setActive(index);
    const at = stampSeconds(lines[index]?.at) * scale;
    const node = audioRef.current;
    if (node && src) {
      node.currentTime = at;
      setCurrent(at);
    }
    document.getElementById(`pod-line-${episodeId}-${index}`)?.scrollIntoView({ block: 'nearest' });
  }

  function onTime() {
    const node = audioRef.current;
    if (!node) return;
    const time = node.currentTime;
    setCurrent(time);
    let index = 0;
    lines.forEach((line, item) => {
      if (stampSeconds(line.at) * scale <= time + 0.15) index = item;
    });
    setActive(index);
  }

  return (
    <div data-testid="podcast-master-player">
      <div className="rounded-2xl border border-pine/10 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-sand disabled:opacity-50"
            disabled={!src}
            onClick={() => {
              const node = audioRef.current;
              if (!node) return;
              if (node.paused) void node.play();
              else node.pause();
            }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <span className="text-xs tabular-nums text-pine">
            {clock(current)} / {clock(duration || planned)}
          </span>
          <div className="flex gap-1" role="group" aria-label="Playback speed">
            {[1, 1.25, 1.5].map(speed => (
              <button
                key={speed}
                type="button"
                className={`rounded-full px-2.5 py-1 text-xs ${rate === speed ? 'bg-pine text-sand' : 'bg-pine/10 text-pine'}`}
                onClick={() => setRate(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
        <input
          className="mt-3 w-full accent-pine"
          type="range"
          min={0}
          max={duration || planned}
          step={0.1}
          value={Math.min(current, duration || planned)}
          aria-label="Episode position"
          disabled={!src}
          onChange={event => {
            const next = Number(event.target.value);
            if (audioRef.current && src) audioRef.current.currentTime = next;
            setCurrent(next);
          }}
        />
        {!src && <p className="mt-2 text-xs text-ink/60">Generate audio to play this episode. The transcript is ready.</p>}
        <audio
          ref={audioRef}
          data-episode={episodeId}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={onTime}
          onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onEnded={() => setPlaying(false)}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {chapters.map(chip => (
          <button
            key={`${chip.title}-${chip.index}`}
            type="button"
            className="rounded-full border border-pine/15 bg-parchment px-3 py-1 text-xs text-pine"
            onClick={() => seekToLine(chip.index)}
          >
            {chip.title}
            {lines[chip.index]?.at ? ` · ${lines[chip.index].at}` : ''}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm leading-relaxed">
        {lines.map((line, index) => (
          <p
            id={`pod-line-${episodeId}-${index}`}
            key={`${line.speaker}-${index}`}
            className={src && index === active ? 'rounded-xl bg-mint/80 px-2 py-1' : 'px-2 py-1'}
          >
            <span className="font-semibold text-pine">{line.speaker}. </span>
            <ContentText text={line.text} />
          </p>
        ))}
      </div>
    </div>
  );
}
