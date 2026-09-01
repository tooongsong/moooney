import { pgTable, text, numeric, boolean, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const paymentMethods = pgTable('payment_methods', {
  id:              text('id').primaryKey(),
  userId:          uuid('user_id').notNull(),
  name:            text('name').notNull(),
  institution:     text('institution'),
  currency:        text('currency').notNull().default('USD'),
  type:            text('type', {
    enum: ['cash', 'checking', 'savings', 'investment', 'other_asset',
           'credit_card', 'loan', 'mortgage', 'other_liability'],
  }).notNull().default('checking'),
  startingBalance: numeric('starting_balance', { precision: 12, scale: 2 }).notNull().default('0').$type<number>(),
  currentBalance:  numeric('current_balance',  { precision: 12, scale: 2 }).notNull().default('0').$type<number>(),
  creditLimit:     numeric('credit_limit',      { precision: 12, scale: 2 }).$type<number | null>(),
  archivedAt:      timestamp('archived_at'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;

export const transactions = pgTable('transactions', {
  id:              text('id').primaryKey(),
  userId:          uuid('user_id').notNull(),
  date:            timestamp('date').notNull(),
  amount:          numeric('amount', { precision: 12, scale: 2 }).notNull().$type<number>(),
  type:            text('type', { enum: ['expense', 'income', 'refund'] }).notNull().default('expense'),
  category:        text('category').notNull(),
  merchant:        text('merchant').notNull(),
  description:     text('description').notNull(),
  paymentMethod:   text('payment_method'),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
  notes:           text('notes'),
  receiptUrl:      text('receipt_url'),
  items:           jsonb('items').$type<{ name: string; price: number | null }[]>(),
  rawInput:        text('raw_input'),
  needsReview:     boolean('needs_review').notNull().default(false),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export const customCategories = pgTable('custom_categories', {
  id:        text('id').primaryKey(),
  userId:    uuid('user_id').notNull(),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type CustomCategory = typeof customCategories.$inferSelect;

export const transfers = pgTable('transfers', {
  id:            text('id').primaryKey(),
  userId:        uuid('user_id').notNull(),
  date:          timestamp('date').notNull(),
  amount:        numeric('amount', { precision: 12, scale: 2 }).notNull().$type<number>(),
  fromAccount:   text('from_account').notNull(),
  fromAccountId: text('from_account_id').references(() => paymentMethods.id),
  toAccount:     text('to_account').notNull(),
  toAccountId:   text('to_account_id').references(() => paymentMethods.id),
  note:          text('note'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
