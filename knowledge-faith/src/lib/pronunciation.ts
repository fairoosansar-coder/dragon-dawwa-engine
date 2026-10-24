import { useStored } from './store.tsx';

/** Arabic pronunciation written in a script. This is not a translation of the meaning. */
export type Pronunciation = 'off' | 'en' | 'ta' | 'si';

export function toPronunciation(value: unknown): Pronunciation {
  return value === 'en' || value === 'ta' || value === 'si' || value === 'off' ? value : 'off';
}

export function usePronunciation(): [Pronunciation, (value: Pronunciation) => void] {
  const [stored, setStored] = useStored<unknown>('kf-pronunciation', 'off');
  return [toPronunciation(stored), value => setStored(value)];
}

/** Adds the only checked transliteration edition. Tamil and Sinhala are not requested. */
export function withPronunciation(url: string, pronunciation: Pronunciation): string {
  if (pronunciation !== 'en' || url.includes('pronunciation=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}pronunciation=en`;
}
