'use server';

import { randomUUID } from 'crypto';
import { asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, customCategories } from '@/db/schema';
import { CATEGORIES } from '@/lib/categories';
import type { AccountType } from '@/lib/accountTypes';

export async function listPaymentMethods() {
  return db.query.paymentMethods.findMany({ orderBy: [asc(paymentMethods.name)] });
}

export async function addPaymentMethod(name: string, startingBalance = 0, type: AccountType = 'bank') {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Name is required' };

  try {
    await db.insert(paymentMethods).values({
      id: randomUUID(),
      name: trimmed,
      startingBalance: Number.isFinite(startingBalance) ? startingBalance : 0,
      type,
      createdAt: new Date(),
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
  await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  revalidatePath('/manage');
  revalidatePath('/accounts');
  revalidatePath('/');
  return { success: true };
}

export async function listCustomCategories() {
  return db.query.customCategories.findMany({ orderBy: [asc(customCategories.name)] });
}

export async function addCustomCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Name is required' };
  if ((CATEGORIES as readonly string[]).includes(trimmed)) {
    return { success: false, error: 'That category already exists' };
  }

  try {
    await db.insert(customCategories).values({ id: randomUUID(), name: trimmed, createdAt: new Date() });
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
  const custom = await db.query.customCategories.findMany({ orderBy: [asc(customCategories.name)] });
  return [...CATEGORIES, ...custom.map((c) => c.name)];
}

export async function getPaymentMethodNames(): Promise<string[]> {
  const rows = await db.query.paymentMethods.findMany({ orderBy: [asc(paymentMethods.name)] });
  return rows.map((r) => r.name);
}
