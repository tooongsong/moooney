'use server';

import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gte, isNull, like, lte, or } from 'drizzle-orm';
import { startOfMonth, endOfMonth, parse } from 'date-fns';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, transfers } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { parseDateInputValue } from '@/lib/utils';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

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

/** Look up account IDs for the given names (returns null if not found). */
async function resolveAccountIds(userId: string, fromName: string, toName: string) {
  const rows = await db.query.paymentMethods.findMany({
    where: and(eq(paymentMethods.userId, userId), isNull(paymentMethods.archivedAt)),
    columns: { id: true, name: true },
  });
  const map = new Map(rows.map((r) => [r.name, r.id]));
  return {
    fromAccountId: map.get(fromName) ?? null,
    toAccountId:   map.get(toName)   ?? null,
  };
}

export async function createTransfer(input: TransferInput) {
  const user = await getUser();
  const error = validate(input);
  if (error) return { success: false, error };

  try {
    const id = randomUUID();
    const { fromAccountId, toAccountId } = await resolveAccountIds(
      user.id, input.fromAccount, input.toAccount,
    );

    await db.insert(transfers).values({
      id,
      userId:        user.id,
      date:          parseDateInputValue(input.date),
      amount:        input.amount,
      fromAccount:   input.fromAccount,
      fromAccountId,
      toAccount:     input.toAccount,
      toAccountId,
      note:          input.note || null,
    });

    revalidateAll();
    return { success: true, id };
  } catch (error) {
    console.error('createTransfer error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateTransfer(id: string, input: TransferInput) {
  const user = await getUser();
  const error = validate(input);
  if (error) return { success: false, error };

  try {
    const { fromAccountId, toAccountId } = await resolveAccountIds(
      user.id, input.fromAccount, input.toAccount,
    );

    await db
      .update(transfers)
      .set({
        date:          parseDateInputValue(input.date),
        amount:        input.amount,
        fromAccount:   input.fromAccount,
        fromAccountId,
        toAccount:     input.toAccount,
        toAccountId,
        note:          input.note || null,
        updatedAt:     new Date(),
      })
      .where(and(eq(transfers.id, id), eq(transfers.userId, user.id)));

    revalidateAll();
    return { success: true };
  } catch (error) {
    console.error('updateTransfer error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteTransfer(id: string) {
  const user = await getUser();
  try {
    await db.delete(transfers).where(and(eq(transfers.id, id), eq(transfers.userId, user.id)));
    revalidateAll();
    return { success: true };
  } catch (error) {
    console.error('deleteTransfer error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getTransfer(id: string) {
  const user = await getUser();
  return db.query.transfers.findFirst({
    where: and(eq(transfers.id, id), eq(transfers.userId, user.id)),
  });
}

export async function listTransfers({
  query, month, account,
}: { query?: string; month?: string; account?: string }) {
  const user = await getUser();
  const parsed = month ? parse(month, 'yyyy-MM', new Date()) : new Date();
  const startDate = startOfMonth(parsed);
  const endDate   = endOfMonth(parsed);

  return db.query.transfers.findMany({
    where: and(
      eq(transfers.userId, user.id),
      gte(transfers.date, startDate),
      lte(transfers.date, endDate),
      account
        ? or(eq(transfers.fromAccount, account), eq(transfers.toAccount, account))
        : undefined,
      query
        ? or(
            like(transfers.fromAccount, `%${query}%`),
            like(transfers.toAccount,   `%${query}%`),
            like(transfers.note,         `%${query}%`),
          )
        : undefined,
    ),
    orderBy: [desc(transfers.date), desc(transfers.createdAt)],
  });
}
