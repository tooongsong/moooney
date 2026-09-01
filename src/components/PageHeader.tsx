import type { ReactNode } from 'react';

// Shared chrome for every "pushed" page (as opposed to Home/History, which are root
// tabs with their own larger heading treatment). Centers the title via a 3-column grid
// instead of a manually-sized spacer div, so it stays centered regardless of what's
// actually in the left/right slots — and every page gets the same height and padding
// for free instead of retyping "sticky top-0 z-30 bg-paper -mx-6 px-6 py-4 ..." each time.
interface PageHeaderProps {
  left?: ReactNode;
  title: string;
  right?: ReactNode;
}

export function PageHeader({ left, title, right }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 py-4 grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2 border-b-2 border-ink">
      <div className="flex items-center justify-start">{left}</div>
      <span className="text-xs font-semibold uppercase tracking-widest text-ink text-center truncate">{title}</span>
      <div className="flex items-center justify-end">{right}</div>
    </header>
  );
}
