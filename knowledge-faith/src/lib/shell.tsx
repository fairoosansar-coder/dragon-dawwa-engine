import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface ShellState {
  query: string;
  setQuery: (query: string) => void;
  focus: boolean;
  setFocus: (focus: boolean) => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(false);
  const value = useMemo(() => ({ query, setQuery, focus, setFocus }), [query, focus]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  return (
    useContext(ShellContext) ?? {
      query: '',
      setQuery: () => undefined,
      focus: false,
      setFocus: () => undefined,
    }
  );
}
