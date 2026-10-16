'use server';

import { randomUUID } from 'crypto';
import { asc, eq, isNull, and, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, customCategories, transactions, subscriptions, transfers } from '@/db/schema';
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

export async function updatePaymentMethod(
  id: string,
  updates: { name?: string; type?: AccountType; startingBalance?: number; institution?: string; creditLimit?: number | null },
) {
  const user = await getUser();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined)            set.name            = updates.name.trim();
  if (updates.type !== undefined)            set.type            = updates.type;
  if (updates.startingBalance !== undefined) set.startingBalance = updates.startingBalance;
  if (updates.institution !== undefined)     set.institution     = updates.institution?.trim() || null;
  if (updates.creditLimit !== undefined)     set.creditLimit     = updates.creditLimit;
  await db.update(paymentMethods).set(set)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)));
  revalidateAccounts();
  return { success: true };
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
  // RLS does not apply on this path: the app connects as `postgres`, which has
  // rolbypassrls, so every query here scopes itself to the caller.
  const user = await getUser();

  const account = await db.query.paymentMethods.findFirst({
    where: and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)),
    columns: { id: true },
  });
  // Not the caller's account, or no such account: a silent no-op, as in
  // archivePaymentMethod.
  if (!account) return { success: true };

  // An account is archived rather than deleted when any row still references
  // it. Every foreign key to payment_methods is NO ACTION, so an unguarded
  // delete raises a raw constraint error — an unhandled 500, since there is no
  // try/catch here.
  const linked = await db.query.transactions.findFirst({
    where: eq(transactions.paymentMethodId, account.id),
    columns: { id: true },
  });
  if (linked) return archivePaymentMethod(id);

  // Archiving beats making the key `on delete set null`: the account stays
  // findable, and the subscription keeps the field the user filled in rather
  // than silently losing it.
  const subscribed = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.paymentMethodId, account.id),
    columns: { id: true },
  });
  if (subscribed) return archivePaymentMethod(id);

  const transferred = await db.query.transfers.findFirst({
    where: or(eq(transfers.fromAccountId, account.id), eq(transfers.toAccountId, account.id)),
    columns: { id: true },
  });
  if (transferred) return archivePaymentMethod(id);

  await db.delete(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)));
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

export async function renameCustomCategory(id: string, newName: string) {
  const user = await getUser();
  const trimmed = newName.trim();
  if (!trimmed) return { success: false, error: 'Name is required' };
  if ((CATEGORIES as readonly string[]).includes(trimmed)) {
    return { success: false, error: 'That name matches a built-in category' };
  }
  const cat = await db.query.customCategories.findFirst({
    where: and(eq(customCategories.id, id), eq(customCategories.userId, user.id)),
  });
  if (!cat) return { success: false, error: 'Category not found' };
  // Migrate transactions to the new name
  await db.update(transactions).set({ category: trimmed, updatedAt: new Date() })
    .where(and(eq(transactions.userId, user.id), eq(transactions.category, cat.name)));
  await db.update(customCategories).set({ name: trimmed })
    .where(and(eq(customCategories.id, id), eq(customCategories.userId, user.id)));
  revalidatePath('/manage');
  revalidatePath('/history');
  return { success: true };
}

export async function deleteCustomCategory(id: string) {
  const user = await getUser();
  const cat = await db.query.customCategories.findFirst({
    where: and(eq(customCategories.id, id), eq(customCategories.userId, user.id)),
  });
  if (cat) {
    // Reassign orphaned transactions to "Other" before deleting
    await db.update(transactions).set({ category: 'Other', updatedAt: new Date() })
      .where(and(eq(transactions.userId, user.id), eq(transactions.category, cat.name)));
  }
  await db.delete(customCategories).where(and(eq(customCategories.id, id), eq(customCategories.userId, user.id)));
  revalidatePath('/manage');
  revalidatePath('/history');
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
