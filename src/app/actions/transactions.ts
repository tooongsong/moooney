'use server';

import { randomUUID } from 'crypto';
import { and, desc, eq, gte, lte, like, or } from 'drizzle-orm';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, parse } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { openai, modelName, ExtractionSchema, buildExtractionSystemPrompt } from '@/lib/openai';
import { CATEGORIES, DEFAULT_CATEGORY, type TransactionType } from '@/lib/categories';
import { toDateInputValue, parseDateInputValue } from '@/lib/utils';

export interface TransactionDraft {
  amount: number | null;
  merchant: string | null;
  date: string;
  category: string;
  description: string;
  type: TransactionType;
  paymentMethod: string | null;
  items: { name: string; price: number | null }[] | null;
  needsReview: boolean;
  rawInput: string | null;
  receiptImage: string | null;
}

export async function extractDraft(input: {
  text?: string;
  imageBase64?: string;
}): Promise<{ success: true; drafts: TransactionDraft[] } | { success: false; error: string }> {
  try {
    if (!input.text && !input.imageBase64) {
      return { success: false, error: 'Please provide text or a receipt photo.' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      { role: 'system', content: buildExtractionSystemPrompt() },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the transaction(s).' },
          ...(input.imageBase64 ? [{ type: 'image_url', image_url: { url: input.imageBase64 } }] : []),
          ...(input.text ? [{ type: 'text', text: input.text }] : []),
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: modelName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    if (!content) return { success: false, error: 'AI did not return a result.' };

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, error: 'Could not parse the AI response.' };
    }

    const result = ExtractionSchema.parse(parsed);

    const usable = result.transactions.filter((t) => t.amount !== null || (t.items && t.items.length > 0));

    if (usable.length === 0) {
      return { success: false, error: "Couldn't find an amount — try rephrasing, or use manual entry." };
    }

    const drafts: TransactionDraft[] = usable.map((t) => {
      const category =
        t.category && (CATEGORIES as readonly string[]).includes(t.category) ? t.category : DEFAULT_CATEGORY;

      return {
        amount: t.amount,
        merchant: t.merchant,
        date: t.date || toDateInputValue(),
        category,
        description: t.description || t.merchant || 'Transaction',
        type: t.type || 'expense',
        paymentMethod: t.paymentMethod,
        items: t.items,
        needsReview: t.amount === null || t.merchant === null,
        rawInput: input.text || null,
        receiptImage: input.imageBase64 || null,
      };
    });

    return { success: true, drafts };
  } catch (error) {
    console.error('extractDraft error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface SaveTransactionInput {
  amount: number;
  merchant: string;
  date: string;
  category: string;
  description: string;
  type: TransactionType;
  paymentMethod?: string | null;
  notes?: string | null;
  items?: { name: string; price: number | null }[] | null;
  rawInput?: string | null;
  receiptImage?: string | null;
  needsReview?: boolean;
}

export async function saveTransaction(input: SaveTransactionInput) {
  try {
    const now = new Date();
    const id = randomUUID();

    await db.insert(transactions).values({
      id,
      date: parseDateInputValue(input.date),
      amount: input.amount,
      type: input.type,
      category: input.category,
      merchant: input.merchant,
      description: input.description,
      paymentMethod: input.paymentMethod || null,
      notes: input.notes || null,
      receiptUrl: input.receiptImage || null,
      items: input.items || null,
      rawInput: input.rawInput || null,
      needsReview: input.needsReview || false,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath('/');
    revalidatePath('/history');

    return { success: true, id };
  } catch (error) {
    console.error('saveTransaction error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function saveTransactions(inputs: SaveTransactionInput[]) {
  try {
    const now = new Date();

    const rows = inputs.map((input) => ({
      id: randomUUID(),
      date: parseDateInputValue(input.date),
      amount: input.amount,
      type: input.type,
      category: input.category,
      merchant: input.merchant,
      description: input.description,
      paymentMethod: input.paymentMethod || null,
      notes: input.notes || null,
      receiptUrl: input.receiptImage || null,
      items: input.items || null,
      rawInput: input.rawInput || null,
      needsReview: input.needsReview || false,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(transactions).values(rows);

    revalidatePath('/');
    revalidatePath('/history');

    return { success: true, count: rows.length };
  } catch (error) {
    console.error('saveTransactions error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateTransaction(id: string, input: SaveTransactionInput) {
  try {
    await db
      .update(transactions)
      .set({
        date: parseDateInputValue(input.date),
        amount: input.amount,
        type: input.type,
        category: input.category,
        merchant: input.merchant,
        description: input.description,
        paymentMethod: input.paymentMethod || null,
        notes: input.notes || null,
        items: input.items || null,
        needsReview: input.needsReview || false,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id));

    revalidatePath('/');
    revalidatePath('/history');

    return { success: true };
  } catch (error) {
    console.error('updateTransaction error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteTransaction(id: string) {
  try {
    await db.delete(transactions).where(eq(transactions.id, id));
    revalidatePath('/');
    revalidatePath('/history');
    return { success: true };
  } catch (error) {
    console.error('deleteTransaction error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getTransaction(id: string) {
  return db.query.transactions.findFirst({ where: eq(transactions.id, id) });
}

export async function getHomeData() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [monthTxns, recent] = await Promise.all([
    db.query.transactions.findMany({
      where: and(gte(transactions.date, monthStart), lte(transactions.date, monthEnd)),
    }),
    db.query.transactions.findMany({
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit: 5,
    }),
  ]);

  let monthSpend = 0;
  let monthIncome = 0;
  let todaySpend = 0;
  const categoryTotals = new Map<string, number>();

  for (const t of monthTxns) {
    if (t.type === 'expense') {
      monthSpend += t.amount;
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + t.amount);
      if (t.date >= todayStart && t.date <= todayEnd) todaySpend += t.amount;
    } else if (t.type === 'income') {
      monthIncome += t.amount;
    } else if (t.type === 'refund') {
      monthSpend -= t.amount;
      if (t.date >= todayStart && t.date <= todayEnd) todaySpend -= t.amount;
    }
  }

  const categoryData = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    monthSpend,
    todaySpend,
    monthIncome,
    monthBalance: monthIncome - monthSpend,
    categoryData,
    recent,
  };
}

export async function listTransactions({
  query,
  month,
  category,
  account,
}: {
  query?: string;
  month?: string;
  category?: string;
  account?: string;
}) {
  let startDate: Date;
  let endDate: Date;

  if (month) {
    const parsed = parse(month, 'yyyy-MM', new Date());
    startDate = startOfMonth(parsed);
    endDate = endOfMonth(parsed);
  } else {
    startDate = startOfMonth(new Date());
    endDate = endOfMonth(new Date());
  }

  const data = await db.query.transactions.findMany({
    where: and(
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
      category ? eq(transactions.category, category) : undefined,
      account ? eq(transactions.paymentMethod, account) : undefined,
      query ? or(like(transactions.merchant, `%${query}%`), like(transactions.description, `%${query}%`)) : undefined
    ),
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
  });

  return data;
}
