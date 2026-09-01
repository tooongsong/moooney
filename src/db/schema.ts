import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  amount: real('amount').notNull(),
  type: text('type', { enum: ['expense', 'income', 'refund'] }).notNull().default('expense'),
  category: text('category').notNull(),
  merchant: text('merchant').notNull(),
  description: text('description').notNull(),
  paymentMethod: text('payment_method'),
  notes: text('notes'),
  receiptUrl: text('receipt_url'),
  items: text('items', { mode: 'json' }).$type<{ name: string; price: number | null }[]>(),
  rawInput: text('raw_input'),
  needsReview: integer('needs_review', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startingBalance: real('starting_balance').notNull().default(0),
  type: text('type', { enum: ['cash', 'bank', 'credit_card'] }).notNull().default('bank'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;

export const customCategories = sqliteTable('custom_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type CustomCategory = typeof customCategories.$inferSelect;

export const transfers = sqliteTable('transfers', {
  id: text('id').primaryKey(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  amount: real('amount').notNull(),
  fromAccount: text('from_account').notNull(),
  toAccount: text('to_account').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
