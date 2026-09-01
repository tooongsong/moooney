'use server';

import { randomUUID } from 'crypto';
import { asc, eq, isNull, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, customCategories, transactions } from '@/db/schema';
import { CATEGORIES } from '@/lib/categories';
import type { AccountType } from '@/lib/accountTypes';
import { createClient } from '@/lib/supabase/server';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

function revalidateAccounts() {
  revalidatePath('/manage');
  revalidatePath('/accounts');
  revalidatePath('/');
}

// ─── Payment Methods (Accounts) ──────────────────────────────────────────────

export async function listPaymentMethods() {
  const user = await getUser();
  return db.query.paymentMethods.findMany({
    where: and(eq(paymentMethods.userId, user.id), isNull(paymentMethods.archivedAt)),
    orderBy: [asc(paymentMethods.name)],
  });
}

export interface AddPaymentMethodInput {
  name: string;
  startingBalance?: number;
  type?: AccountType;
  institution?: string;
  currency?: string;
  creditLimit?: number;
}

export async function addPaymentMethod(
  name: string,
  startingBalance = 0,
  type: AccountType = 'checking',
  institution?: string,
  creditLimit?: number,
) {
  const user = await getUser();
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Name is required' };

  try {
    const id = randomUUID();
    await db.insert(paymentMethods).values({
      id,
      userId:          user.id,
      name:            trimmed,
      startingBalance: Number.isFinite(startingBalance) ? startingBalance : 0,
      currentBalance:  Number.isFinite(startingBalance) ? startingBalance : 0,
      type,
      institution:     institution?.trim() || null,
      creditLimit:     creditLimit != null && Number.isFinite(creditLimit) ? creditLimit : null,
    });
    revalidateAccounts();
    return { success: true, id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function archivePaymentMethod(id: string) {
  const user = await getUser();
  await db
    .update(paymentMethods)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)));
  revalidateAccounts();
  return { success: true };
}

export async function deletePaymentMethod(id: string) {
  const account = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, id),
  });

  if (account) {
    const linked = await db.query.transactions.findFirst({
      where: eq(transactions.paymentMethodId, account.id),
    });
    if (linked) {
      // Has transactions → archive instead of delete
      return archivePaymentMethod(id);
    }
  }

  await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  revalidateAccounts();
  return { success: true };
}

export async function getPaymentMethodNames(): Promise<string[]> {
  const user = await getUser();
  const rows = await db.query.paymentMethods.findMany({
    where: and(eq(paymentMethods.userId, user.id), isNull(paymentMethods.archivedAt)),
    orderBy: [asc(paymentMethods.name)],
  });
  return rows.map((r) => r.name);
}

export async function getAccountsForTransfer(): Promise<{ name: string; type: string }[]> {
  const user = await getUser();
  const rows = await db.query.paymentMethods.findMany({
    where: and(eq(paymentMethods.userId, user.id), isNull(paymentMethods.archivedAt)),
    orderBy: [asc(paymentMethods.name)],
  });
  return rows.map((r) => ({ name: r.name, type: r.type }));
}

// ─── Custom Categories ────────────────────────────────────────────────────────

export async function listCustomCategories() {
  const user = await getUser();
  return db.query.customCategories.findMany({
    where: eq(customCategories.userId, user.id),
    orderBy: [asc(customCategories.name)],
  });
}

export async function addCustomCategory(name: string) {
  const user = await getUser();
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Name is required' };
  if ((CATEGORIES as readonly string[]).includes(trimmed)) {
    return { success: false, error: 'That category already exists' };
  }

  try {
    await db.insert(customCategories).values({ id: randomUUID(), userId: user.id, name: trimmed });
    revalidatePath('/manage');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteCustomCategory(id: string) {
  await db.delete(customCategories).where(eq(customCategories.id, id));
  revalidatePath('/manage');
  return { success: true };
}

export async function getAllCategories(): Promise<string[]> {
  const user = await getUser();
  const custom = await db.query.customCategories.findMany({
    where: eq(customCategories.userId, user.id),
    orderBy: [asc(customCategories.name)],
  });
  return [...CATEGORIES, ...custom.map((c) => c.name)];
}
