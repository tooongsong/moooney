'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';

/** Below this digits stop being legible as digits at all. */
const ABSOLUTE_FLOOR = 8;

function splitAmt(value: number) {
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const c = Math.round((abs - d) * 100).toString().padStart(2, '0');
  return { d: d.toLocaleString(), c };
}

interface Props {
  value: number;
  className?: string;
  /** Applied to the measuring wrapper — the width set here is what the text
   *  is fitted to. */
  style?: React.CSSProperties;
  spanClassName?: string;
  baseSize?: number;
  /** Preferred floor. Shrinking below it is allowed when that is the only way
   *  to show the whole number — nothing here is ever truncated. */
  minSize?: number;
  negative?: boolean;
  split?: boolean;
  suffix?: string;
  format?: (v: number) => string;
}

export function ResponsiveAmount({
  value,
  className,
  style,
  spanClassName,
  baseSize = 64,
  minSize = 28,
  negative,
  split,
  suffix,
  format,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(baseSize);

  useEffect(() => {
    let cancelled = false;

    function fit() {
      const wrap = wrapRef.current;
      const span = spanRef.current;
      if (cancelled || !wrap || !span) return;
      const avail = wrap.getBoundingClientRect().width;
      if (!avail) return;

      // Measure once at base size and scale by ratio. The old loop stepped
      // down 2px at a time and stopped at minSize whether or not the text
      // fit, and the wrapper clipped whatever was left over — so a long
      // number lost its last digits silently. A cut-off amount is a wrong
      // amount; shrinking past the preferred floor is only ugly.
      span.style.fontSize = `${baseSize}px`;
      const naturalW = span.getBoundingClientRect().width;
      if (!naturalW) return;

      const exact = naturalW <= avail ? baseSize : (baseSize * avail) / naturalW;
      let next = Math.max(ABSOLUTE_FLOOR, Math.min(baseSize, Math.floor(exact)));
      span.style.fontSize = `${next}px`;

      // The ratio assumes width scales linearly with font size, which the
      // split layout breaks: its gap between dollars and cents is a fixed
      // 4px. Verify rather than trusting the estimate.
      while (next > ABSOLUTE_FLOOR && span.getBoundingClientRect().width > avail) {
        next -= 1;
        span.style.fontSize = `${next}px`;
      }
      setFontSize(next);
    }

    fit();

    // document.fonts.ready resolves when loading finishes, which can be a
    // frame before the swapped font is what the browser actually measures —
    // fitting on that tick reads the fallback's narrower metrics and leaves
    // the real text a pixel or two over. Wait for the paint after it.
    document.fonts?.ready
      .then(() => requestAnimationFrame(() => requestAnimationFrame(fit)))
      .catch(() => {});

    // A fit is only valid for the width it was measured against. Dragging the
    // window, or moving it to a different monitor, changes that width.
    const ro = new ResizeObserver(() => fit());
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => { cancelled = true; ro.disconnect(); };
  }, [value, baseSize, minSize]);

  const colorClass = spanClassName ?? (negative ? 'text-accent' : 'text-ink');

  if (split) {
    const { d, c } = splitAmt(value);
    return (
      <div ref={wrapRef} className={`w-full ${className ?? ''}`} style={style}>
        <span
          ref={spanRef}
          className="whitespace-nowrap inline-flex items-end gap-1 leading-none"
          style={{ fontSize: `${fontSize}px` }}
        >
          <span className={`font-bold tracking-tighter tabular-nums leading-none ${colorClass}`}>
            ${d}
          </span>
          <span
            className={`font-bold tracking-tight tabular-nums mb-1 opacity-30 ${colorClass}`}
            style={{ fontSize: '0.33em' }}
          >
            .{c}
            {suffix ? ` ${suffix}` : ''}
          </span>
        </span>
      </div>
    );
  }

  const text = (format ? format(value) : formatCurrency(value)) + (suffix ? ` ${suffix}` : '');

  return (
    <div ref={wrapRef} className={className ?? ''} style={style}>
      <span
        ref={spanRef}
        className={`whitespace-nowrap overflow-visible tabular-nums font-bold tracking-tighter ${colorClass}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {text}
      </span>
    </div>
  );
}
