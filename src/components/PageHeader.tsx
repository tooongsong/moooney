import type { ReactNode } from 'react';

interface PageHeaderProps {
  left?: ReactNode;
  title: string;
  right?: ReactNode;
}

export function PageHeader({ left, title, right }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2 border-b border-line">
      <div className="flex items-center justify-start">{left}</div>
      <span className="text-base font-bold tracking-tight text-ink text-center truncate">{title}</span>
      <div className="flex items-center justify-end">{right}</div>
    </header>
  );
}
