import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** formatCurrency with a leading typographic minus, matching the sign the
 *  amount column prints. Intl's own output uses a hyphen, which sits at a
 *  different weight and width beside it. */
export function formatSignedCurrency(amount: number): string {
  return `${amount < 0 ? '\u2212' : ''}${formatCurrency(Math.abs(amount))}`;
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a YYYY-MM-DD string as local midnight, avoiding the UTC-parsing day shift of `new Date(str)`. */
export function parseDateInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Coerces to a Date, treating a bare "YYYY-MM-DD" string as local midnight rather than UTC midnight. */
function toLocalDate(date: Date | string | number): Date {
  if (typeof date === 'string' && DATE_ONLY_RE.test(date)) return parseDateInputValue(date);
  return new Date(date);
}

export function formatDate(date: Date | string | number, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-US', options).format(toLocalDate(date));
}

/** Formats a Date as a local YYYY-MM-DD string (for <input type="date"> and "today" defaults). */
export function toDateInputValue(date: Date | string = new Date()): string {
  const d = toLocalDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * True when `value` is exactly one character as a person sees it.
 *
 * Code points are the wrong unit and this is the bug worth remembering: 🧑‍💻
 * is three of them, 🏳️‍🌈 four, 👨‍👩‍👧 five, 1️⃣ three. Counting code points
 * rejects half the emoji keyboard while still accepting "ab". A grapheme
 * cluster is the unit being limited, and Intl.Segmenter is the only thing
 * that knows where they end.
 */
export function isSingleGrapheme(value: string): boolean {
  return [...new Intl.Segmenter().segment(value)].length === 1;
}

/** The first character of `value` as a person sees it, or '' if there is none.
 *  Same reason as above: `value[0]` and `Array.from(value)[0]` both return a
 *  fragment of a joined emoji or a letter stripped of its accent. */
export function firstGrapheme(value: string): string {
  return [...new Intl.Segmenter().segment(value)][0]?.segment ?? '';
}

/**
 * Read a typed money amount, or NaN.
 *
 * `parseFloat` is the first trap: it stops at the first character it cannot
 * read, so "1,288.88" becomes 1 — valid, positive, past every guard, and
 * silently a thousand times too small. Since the app prints amounts with
 * thousands separators, typing one back in is the obvious thing to do.
 *
 * Stripping every comma is the second trap, and the worse one, because it
 * errs upward: "11,99" is how a good part of the world writes 11.99, and it
 * would read as 1199. So a comma is accepted only where a thousands
 * separator can legally go — groups of exactly three digits, before the
 * decimal point — and anything else returns NaN, which the callers reject.
 */
export function parseAmountInput(value: string): number {
  const cleaned = value.replace(/[$\s]/g, '');
  if (cleaned === '') return NaN;
  // [1-9], not \d: "0,500" is 0.5 to a decimal-comma reader, and read as
  // grouping it would be 500.
  const grouped = /^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(cleaned);
  const plain = /^\d*\.?\d*$/.test(cleaned);
  if (!grouped && !plain) return NaN;
  // Number, not parseFloat: "." and "" become NaN rather than quietly
  // succeeding at something.
  return Number(cleaned.replace(/,/g, ''));
}
