import OpenAI from 'openai';
import { z } from 'zod';
import { CATEGORIES } from './categories';
import { toDateInputValue } from './utils';

const rawKey  = process.env.OPENAI_API_KEY;
const apiKey  = rawKey?.trim();          // strip accidental \n / whitespace
const baseURL = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';

if (!apiKey) {
  console.warn('[openai] OPENAI_API_KEY is not set.');
} else if (rawKey !== apiKey) {
  // Key had whitespace — trimmed silently; operator should fix the env var
  console.warn('[openai] OPENAI_API_KEY had leading/trailing whitespace and was trimmed. Fix the value in .env.local or Vercel Environment Variables.');
}

export const openai = new OpenAI({ apiKey, baseURL });

export const modelName = process.env.OPENAI_MODEL || 'gpt-4o';

export const TransactionExtractionSchema = z.object({
  amount: z.number().nullable(),
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  type: z.enum(['expense', 'income', 'refund']).nullable(),
  paymentMethod: z.string().nullable(),
  items: z
    .array(
      z.object({
        name: z.string(),
        price: z.number().nullable(),
      })
    )
    .nullable(),
});

export const ExtractionSchema = z.object({
  transactions: z.array(TransactionExtractionSchema).min(1),
});

export type Extraction = z.infer<typeof TransactionExtractionSchema>;

// The owner's merchant → category rules, keyed by category name. A rule is only sent when that
// category exists for the user (built-in and not hidden, or one of their custom categories).
// Add a line here when a merchant keeps landing in the wrong category.
const CATEGORY_GUIDE: Record<string, string> = {
  'Groceries': "supermarkets and warehouse/big-box stores — Whole Foods, Trader Joe's, Target, Costco, Safeway, Kroger, Sprouts, Aldi, H Mart, 99 Ranch, Weee!, Instacart, and similar.",
  'Car': 'anything for owning or running a car — Tesla (Supercharger, service, subscriptions), EV charging (ChargePoint, Electrify America, EVgo), gas stations (Shell, Chevron, 76), parking, tolls, car wash, repairs, car insurance, DMV.',
  'Transport': 'getting around without your own car — Uber, Lyft, taxis, public transit, trains, bike/scooter share.',
  'Food & Dining': 'restaurants, cafes, bars, takeout and delivery (DoorDash, Uber Eats).',
  'Utility': 'electricity, water, gas, trash, internet and mobile phone service — PG&E, ConEd, Xfinity/Comcast, AT&T, Verizon, T-Mobile, Spectrum, and similar.',
  'Rent': 'the rent payment itself.',
  'Housing': "housing costs other than rent — mortgage, HOA, renter's or home insurance, security deposit.",
  'Move': 'moving costs — movers, truck rental (U-Haul), storage, packing supplies.',
  'Subscriptions': 'recurring digital subscriptions — Netflix, Spotify, iCloud, YouTube Premium, app and software subscriptions.',
  'Bills': 'other recurring bills that no more specific category in the list covers — loan payments, bank and card fees, memberships.',
};

export function buildExtractionSystemPrompt(categories: readonly string[] = CATEGORIES): string {
  const today = toDateInputValue();
  const guide = categories
    .filter((c) => CATEGORY_GUIDE[c])
    .map((c) => `  - ${c}: ${CATEGORY_GUIDE[c]}`)
    .join('\n');

  return `You extract personal financial transactions from either a short natural-language sentence, a photo of a single receipt, or a photo/screenshot of a bank or card statement listing many transactions.

The input may be written in English, Chinese (Simplified or Traditional), or a mix of both — read and understand either language equally well. Keep merchant names and item names in whatever language/script they originally appear in; do not translate or transliterate them. "description" may be written in whichever language best captures the transaction naturally.

Today's date is ${today}. Use this to resolve any date that omits a year (e.g. "8/20" or "Aug 20") — assume the most recent occurrence of that date that is not in the future, which in almost all cases means the current year, ${today.slice(0, 4)}. Only use a different year if one is explicitly written in the text or printed on the receipt/statement.

Return ONLY a JSON object with this exact shape:
{
  "transactions": [
    {
      "amount": number or null,
      "merchant": string or null,
      "date": "YYYY-MM-DD" or null,
      "category": string or null,
      "description": string or null,
      "type": "expense" | "income" | "refund" or null,
      "paymentMethod": string or null,
      "items": [{ "name": string, "price": number or null }] or null
    }
  ]
}

How many entries to return:
- A natural-language sentence describing one purchase → exactly ONE entry.
- A single receipt (one merchant, one checkout, one total, possibly several line items) → exactly ONE entry. Line items on a single receipt belong in that one entry's "items" array — do NOT split one receipt into multiple transactions just because it has multiple items.
- A bank/card statement or transaction list showing several separate purchases (multiple distinct dates, merchants, and amounts, typically in a table or list format) → ONE entry PER distinct transaction line. This is the only case where you should return more than one entry.

Rules for each entry:
- Category MUST be exactly one of: ${categories.join(', ')}. If nothing fits well, use "Other".
- Category guide — the owner's own rules, which win over your general judgment. Match merchants loosely: statements abbreviate and add store numbers (e.g. "WHOLEFDS MKT #10234", "TRADER JOE S", "TESLA SUPERCHARGER US").
${guide}
- "type" is "expense" for money spent, "income" for money received (salary, deposit), "refund" for a returned/refunded purchase. Default to "expense" only when the text clearly describes a purchase; otherwise use your best judgment or null.
- "date": only return a date if one is explicitly present in the text or printed on the receipt/statement (resolving missing years per the rule above). If genuinely no date is mentioned at all, return null — the app will fill in today's date.
- "paymentMethod": only fill this if a card type, "cash", or similar is explicitly visible. Otherwise null.
- "items": only for a single receipt's line items. Never populate this for statement-derived entries.
- "description" should be a short, natural phrase like "Lunch at Din Tai Fung" or "Groceries at Trader Joe's".
- NEVER invent or guess a value you are not reasonably confident about. If a field is unclear or missing, return null for it rather than making something up.
- Return ONLY the JSON object, no markdown formatting, no commentary.`;
}
