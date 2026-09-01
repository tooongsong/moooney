import { pgTable, text, numeric, boolean, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  date: timestamp('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().$type<number>(),
  type: text('type', { enum: ['expense', 'income', 'refund'] }).notNull().default('expense'),
  category: text('category').notNull(),
  merchant: text('merchant').notNull(),
  description: text('description').notNull(),
  paymentMethod: text('payment_method'),
  notes: text('notes'),
  receiptUrl: text('receipt_url'),
  items: jsonb('items').$type<{ name: string; price: number | null }[]>(),
  rawInput: text('raw_input'),
  needsReview: boolean('needs_review').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export const paymentMethods = pgTable('payment_methods', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  startingBalance: numeric('starting_balance', { precision: 12, scale: 2 }).notNull().default('0').$type<number>(),
  type: text('type', { enum: ['cash', 'bank', 'checking', 'savings', 'investment', 'credit_card', 'loan', 'mortgage'] }).notNull().default('checking'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;

export const customCategories = pgTable('custom_categories', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type CustomCategory = typeof customCategories.$inferSelect;

export const transfers = pgTable('transfers', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  date: timestamp('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().$type<number>(),
  fromAccount: text('from_account').notNull(),
  toAccount: text('to_account').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
