import type { ReactNode } from 'react';

export function EngineFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div data-theme="mushaf" className={`dd-engine dd-shell rounded-3xl p-3 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}
