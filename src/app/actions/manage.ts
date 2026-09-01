'use server';

import { randomUUID } from 'crypto';
import { asc, eq } from 'drizzle-orm';
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

export async function listPaymentMethods() {
  const user = await getUser();
  return db.query.paymentMethods.findMany({
    where: eq(paymentMethods.userId, user.id),
    orderBy: [asc(paymentMethods.name)],
  });
}

export async function addPaymentMethod(name: string, startingBalance = 0, type: AccountType = 'checking') {
  const user = await getUser();
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Name is required' };

  try {
    await db.insert(paymentMethods).values({
      id: randomUUID(),
      userId: user.id,
      name: trimmed,
      startingBalance: Number.isFinite(startingBalance) ? startingBalance : 0,
      type,
    });
    revalidatePath('/manage');
    revalidatePath('/accounts');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deletePaymentMethod(id: string) {
  const account = await db.query.paymentMethods.findFirst({ where: eq(paymentMethods.id, id) });
  if (account) {
    const linked = await db.query.transactions.findFirst({
      where: eq(transactions.paymentMethod, account.name),
    });
    if (linked) return { success: false, error: 'This account has transactions — reassign them first.' };
  }
  await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  revalidatePath('/manage');
  revalidatePath('/accounts');
  revalidatePath('/');
  return { success: true };
}

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

export async function getPaymentMethodNames(): Promise<string[]> {
  const user = await getUser();
  const rows = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.userId, user.id),
    orderBy: [asc(paymentMethods.name)],
  });
  return rows.map((r) => r.name);
}
