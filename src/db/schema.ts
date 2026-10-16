import { pgTable, text, numeric, boolean, uuid, jsonb, timestamp, date } from 'drizzle-orm/pg-core';

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

export const subscriptions = pgTable('subscriptions', {
  id:              text('id').primaryKey(),
  userId:          uuid('user_id').notNull(),
  name:            text('name').notNull(),
  emoji:           text('emoji'),
  amount:          numeric('amount', { precision: 12, scale: 2 }).notNull().$type<number>(),
  cycle:           text('cycle', { enum: ['weekly', 'monthly', 'yearly'] }).notNull().default('monthly'),
  // The billing anchor. Occurrences derive from it; it is never rewritten by
  // the passage of time, only by the user editing the first payment date.
  anchorDate:      date('anchor_date', { mode: 'string' }).notNull(),
  status:          text('status', { enum: ['active', 'paused', 'ended'] }).notNull().default('active'),
  stoppedOn:       date('stopped_on', { mode: 'string' }),
  category:        text('category'),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
  website:         text('website'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export const transactions = pgTable('transactions', {
  id:              text('id').primaryKey(),
  userId:          uuid('user_id').notNull(),
  date:            date('date', { mode: 'string' }).notNull(),
  amount:          numeric('amount', { precision: 12, scale: 2 }).notNull().$type<number>(),
  type:            text('type', { enum: ['expense', 'income', 'refund', 'balance_adjustment'] }).notNull().default('expense'),
  category:        text('category').notNull(),
  merchant:        text('merchant').notNull(),
  description:     text('description').notNull(),
  paymentMethod:   text('payment_method'),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
  notes:           text('notes'),
  receiptUrl:      text('receipt_url'),
  // Which subscription this payment settled, and which occurrence of it. The
  // link lives here because this row is the payment.
  subscriptionId:     text('subscription_id')
    .references(() => subscriptions.id, { onDelete: 'set null' }),
  subscriptionPeriod: date('subscription_period', { mode: 'string' }),
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
  date:          date('date', { mode: 'string' }).notNull(),
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
