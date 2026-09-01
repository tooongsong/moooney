'use server';

import { randomUUID } from 'crypto';
import { and, desc, eq, gte, lte, like, or } from 'drizzle-orm';
import { startOfMonth, endOfMonth, parse } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { transfers } from '@/db/schema';
import { parseDateInputValue } from '@/lib/utils';

export interface TransferInput {
  amount: number;
  fromAccount: string;
  toAccount: string;
  date: string;
  note?: string | null;
}

function revalidateAll() {
  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/accounts');
  revalidatePath('/manage');
}

function validate(input: TransferInput) {
  if (!(input.amount > 0)) return 'Enter an amount';
  if (!input.fromAccount || !input.toAccount) return 'Choose both accounts';
  if (input.fromAccount === input.toAccount) return 'Choose two different accounts';
  return null;
}

export async function createTransfer(input: TransferInput) {
  const error = validate(input);
  if (error) return { success: false, error };

  try {
    const now = new Date();
    const id = randomUUID();

    await db.insert(transfers).values({
      id,
      date: parseDateInputValue(input.date),
      amount: input.amount,
      fromAccount: input.fromAccount,
      toAccount: input.toAccount,
      note: input.note || null,
      createdAt: now,
      updatedAt: now,
    });

    revalidateAll();
    return { success: true, id };
  } catch (error) {
    console.error('createTransfer error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateTransfer(id: string, input: TransferInput) {
  const error = validate(input);
  if (error) return { success: false, error };

  try {
    await db
      .update(transfers)
      .set({
        date: parseDateInputValue(input.date),
        amount: input.amount,
        fromAccount: input.fromAccount,
        toAccount: input.toAccount,
        note: input.note || null,
        updatedAt: new Date(),
      })
      .where(eq(transfers.id, id));

    revalidateAll();
    return { success: true };
  } catch (error) {
    console.error('updateTransfer error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteTransfer(id: string) {
  try {
    await db.delete(transfers).where(eq(transfers.id, id));
    revalidateAll();
    return { success: true };
  } catch (error) {
    console.error('deleteTransfer error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getTransfer(id: string) {
  return db.query.transfers.findFirst({ where: eq(transfers.id, id) });
}

export async function listTransfers({ query, month, account }: { query?: string; month?: string; account?: string }) {
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

  return db.query.transfers.findMany({
    where: and(
      gte(transfers.date, startDate),
      lte(transfers.date, endDate),
      // A transfer touches an account whether it's the source or the destination.
      account ? or(eq(transfers.fromAccount, account), eq(transfers.toAccount, account)) : undefined,
      query
        ? or(like(transfers.fromAccount, `%${query}%`), like(transfers.toAccount, `%${query}%`), like(transfers.note, `%${query}%`))
        : undefined
    ),
    orderBy: [desc(transfers.date), desc(transfers.createdAt)],
  });
}
