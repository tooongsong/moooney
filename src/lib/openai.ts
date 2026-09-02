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

export function buildExtractionSystemPrompt(): string {
  const today = toDateInputValue();

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
- Category MUST be exactly one of: ${CATEGORIES.join(', ')}. If nothing fits well, use "Other".
- "type" is "expense" for money spent, "income" for money received (salary, deposit), "refund" for a returned/refunded purchase. Default to "expense" only when the text clearly describes a purchase; otherwise use your best judgment or null.
- "date": only return a date if one is explicitly present in the text or printed on the receipt/statement (resolving missing years per the rule above). If genuinely no date is mentioned at all, return null — the app will fill in today's date.
- "paymentMethod": only fill this if a card type, "cash", or similar is explicitly visible. Otherwise null.
- "items": only for a single receipt's line items. Never populate this for statement-derived entries.
- "description" should be a short, natural phrase like "Lunch at Din Tai Fung" or "Home supplies at Target".
- NEVER invent or guess a value you are not reasonably confident about. If a field is unclear or missing, return null for it rather than making something up.
- Return ONLY the JSON object, no markdown formatting, no commentary.`;
}
