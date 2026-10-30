import { useEffect, useId, useState } from 'react';
import { getPodcastHostLabel, PODCAST_HOST_EVENT, readPodcastHost, writePodcastHost } from '../lib/podcastHost.ts';
import type { PodcastHonorific } from '../shared/podcastHost.ts';

/** "Host: Brother Feroz (Edit)" opens a small editor. The name stays on this device. */
export function PodcastHostChip({ className = '', tone = 'parchment' }: { className?: string; tone?: 'parchment' | 'plate' }) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(getPodcastHostLabel);
  const [userName, setUserName] = useState('');
  const [honorific, setHonorific] = useState<PodcastHonorific>('None');

  useEffect(() => {
    const sync = () => setLabel(getPodcastHostLabel());
    window.addEventListener(PODCAST_HOST_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PODCAST_HOST_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function openEditor() {
    const profile = readPodcastHost();
    setUserName(profile.userName);
    setHonorific(profile.honorific);
    setOpen(true);
  }

  function save() {
    writePodcastHost({ userName, honorific });
    setLabel(getPodcastHostLabel());
    setOpen(false);
  }

  const plate = tone === 'plate';

  return (
    <div className={`relative max-w-full ${className}`}>
      <button
        type="button"
        className={
          plate
            ? 'inline-flex max-w-full items-center gap-1 rounded-full border border-[#E6C665]/80 bg-[#041B14]/55 px-3 py-1 text-xs font-medium text-[#F9E7B9] shadow-[inset_0_0_0_1px_rgba(249,231,185,0.08)] backdrop-blur-[2px]'
            : 'inline-flex max-w-full items-center gap-1 rounded-full border border-pine/15 bg-parchment px-3 py-1 text-xs font-medium text-pine'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? setOpen(false) : openEditor())}
      >
        <span className="truncate">Host: {label}</span>
        <span className={plate ? 'shrink-0 text-[#E6C665]' : 'shrink-0 text-ink/60'}> (Edit)</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Edit podcast host"
          className={`absolute left-0 z-30 mt-2 w-[min(16rem,calc(100vw-2.5rem))] rounded-2xl bg-parchment p-3 text-left text-ink shadow-lg ${plate ? 'border border-[#C9A14E]/50' : 'border border-pine/15'}`}
        >
          <label className="block text-xs font-medium text-pine" htmlFor={`${fieldId}-name`}>
            Name
          </label>
          <input
            id={`${fieldId}-name`}
            value={userName}
            onChange={event => setUserName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-pine/20 bg-white px-3 py-2 text-sm text-ink"
            maxLength={40}
            autoComplete="nickname"
          />
          <label className="mt-3 block text-xs font-medium text-pine" htmlFor={`${fieldId}-honorific`}>
            Honorific
          </label>
          <select
            id={`${fieldId}-honorific`}
            value={honorific}
            onChange={event => setHonorific(event.target.value as PodcastHonorific)}
            className="mt-1 w-full rounded-xl border border-pine/20 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="None">None</option>
            <option value="Brother">Brother</option>
            <option value="Sister">Sister</option>
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="rounded-full px-3 py-1.5 text-xs text-ink/70" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="rounded-full bg-pine px-3 py-1.5 text-xs font-medium text-sand" onClick={save}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
