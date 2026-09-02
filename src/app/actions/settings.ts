'use server';

import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { paymentMethods, transactions, transfers, customCategories } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

export async function getProfile(): Promise<{ name: string; email: string; avatarUrl: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const name = (user.user_metadata?.full_name as string | undefined)
    ?? (user.user_metadata?.name as string | undefined)
    ?? user.email?.split('@')[0]
    ?? 'User';
  return {
    name,
    email: user.email ?? '',
    avatarUrl: (user.user_metadata?.avatar_url as string | null) ?? null,
  };
}

export async function getPreferences(): Promise<{ currency: string; defaultAccount: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return {
    currency:       (user.user_metadata?.currency       as string) ?? 'USD',
    defaultAccount: (user.user_metadata?.defaultAccount as string) ?? '',
  };
}

export async function updatePreferences(
  prefs: { currency?: string; defaultAccount?: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, ...prefs },
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateProfile(name: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function listArchivedAccounts() {
  const user = await getUser();
  return db.query.paymentMethods.findMany({
    where: and(eq(paymentMethods.userId, user.id), isNotNull(paymentMethods.archivedAt)),
  });
}

export async function restorePaymentMethod(id: string): Promise<{ success: boolean }> {
  const user = await getUser();
  await db
    .update(paymentMethods)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, user.id)));
  revalidatePath('/manage');
  revalidatePath('/accounts');
  revalidatePath('/');
  return { success: true };
}

export async function exportTransactionsCSV(): Promise<string> {
  const user = await getUser();
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, user.id),
    orderBy: [desc(transactions.date)],
  });

  function q(v: string | null | undefined): string {
    return `"${(v ?? '').replace(/"/g, '""')}"`;
  }

  const header = 'Date,Type,Amount,Category,Merchant,Description,Account,Notes';
  const lines = rows.map((r) => [
    r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
    r.type,
    r.amount,
    r.category,
    q(r.merchant),
    q(r.description),
    q(r.paymentMethod),
    q(r.notes),
  ].join(','));

  return [header, ...lines].join('\n');
}

export async function exportTransactionsJSON(): Promise<string> {
  const user = await getUser();
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, user.id),
    orderBy: [desc(transactions.date)],
  });

  const out = rows.map((r) => ({
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
    type: r.type,
    amount: r.amount,
    category: r.category,
    merchant: r.merchant,
    description: r.description,
    account: r.paymentMethod,
    notes: r.notes,
  }));

  return JSON.stringify(out, null, 2);
}

export async function deleteAllData(): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  try {
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db.delete(transfers).where(eq(transfers.userId, user.id));
    await db.delete(customCategories).where(eq(customCategories.userId, user.id));
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
