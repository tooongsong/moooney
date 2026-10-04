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
