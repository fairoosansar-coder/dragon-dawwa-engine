import { useStored } from '../lib/store.tsx';

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export function usePlace() {
  return useStored<Place | null>('kf-place', null);
}
