import { cn, firstGrapheme } from '@/lib/utils';

/**
 * A subscription's identity mark.
 *
 * There is no logo source in this project and the design system rules out a
 * palette of per-item colours, so: a sand circle with the first character of
 * the name. An emoji the user typed replaces it — that brings its own colour
 * without introducing a colour system, and the circle reads the same without one.
 */
export function SubscriptionMark({
  name,
  emoji,
  size = 36,
  className,
}: {
  name: string;
  emoji?: string | null;
  size?: number;
  className?: string;
}) {
  // By grapheme, not by code point: a name beginning with a joined emoji
  // would otherwise render as whichever emoji its first code point happens
  // to be, and an accented letter would lose its accent.
  const initial = firstGrapheme(name.trim()) || '?';
  const mark = emoji?.trim();
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 inline-flex items-center justify-center rounded-full bg-sand select-none',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {mark ? mark : <span className="font-bold uppercase text-ink">{initial}</span>}
    </span>
  );
}
