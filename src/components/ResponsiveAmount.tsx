'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';

function splitAmt(value: number) {
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const c = Math.round((abs - d) * 100).toString().padStart(2, '0');
  return { d: d.toLocaleString(), c };
}

interface Props {
  value: number;
  className?: string;
  spanClassName?: string;
  baseSize?: number;
  minSize?: number;
  negative?: boolean;
  split?: boolean;
  suffix?: string;
  format?: (v: number) => string;
}

export function ResponsiveAmount({
  value,
  className,
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
    const wrap = wrapRef.current;
    const span = spanRef.current;
    if (!wrap || !span) return;
    let size = baseSize;
    span.style.fontSize = `${size}px`;
    const wrapW = wrap.getBoundingClientRect().width;
    if (!wrapW) return;
    while (span.getBoundingClientRect().width > wrapW && size > minSize) {
      size -= 2;
      span.style.fontSize = `${size}px`;
    }
    setFontSize(size);
  }, [value, baseSize, minSize]);

  const colorClass = spanClassName ?? (negative ? 'text-accent' : 'text-ink');

  if (split) {
    const { d, c } = splitAmt(value);
    return (
      <div ref={wrapRef} className={`overflow-hidden w-full ${className ?? ''}`}>
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
          </span>
        </span>
      </div>
    );
  }

  const text = (format ? format(value) : formatCurrency(value)) + (suffix ? ` ${suffix}` : '');

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className ?? ''}`}>
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
