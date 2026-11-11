import type { ReactNode } from 'react';
import { useApp } from '../lib/store.tsx';

export function EngineFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { uiTheme } = useApp();
  const engineTheme = uiTheme === 'obsidian' ? 'night' : 'mushaf';
  return (
    <div data-theme={engineTheme} className={`dd-engine dd-shell rounded-3xl p-3 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}
