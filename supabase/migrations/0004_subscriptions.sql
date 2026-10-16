-- Subscriptions: what renews, and when.
--
-- A subscription is an expectation; a transaction is a fact. Nothing in this
-- table is ever summed into a spending figure. The money appears in
-- `transactions` when it is actually spent, exactly as it always has.
--
-- There is no next_billing_date. Every occurrence is derived from anchor_date
-- by src/lib/subscriptionSchedule.ts, because a stored cursor drifts: advance
-- a 31st subscription through February and it lands on the 28th, which every
-- later month then inherits.

create table if not exists subscriptions (
  id                text primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  emoji             text,
  amount            numeric(12,2) not null,
  cycle             text not null default 'monthly',   -- weekly | monthly | yearly
  anchor_date       date not null,                     -- first payment, not row creation
  status            text not null default 'active',    -- active | paused | ended
  stopped_on        date,                              -- the day billing stopped, paused or ended
  category          text,                              -- a name from getAllCategories()
  payment_method_id text references payment_methods(id),
  website           text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Guarded: `create policy` has no IF NOT EXISTS, and this file runs as one
-- transaction, so an unguarded one aborts a re-run before anything after it.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'subscriptions'
       and policyname = 'own subscriptions'
  ) then
    create policy "own subscriptions" on subscriptions for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists subscriptions_user_idx on subscriptions (user_id);

-- The payment link. `on delete set null`, not cascade: deleting a subscription
-- must never delete a real expense — the money was still spent.
--
-- The foreign key is added separately, and guarded. An inline REFERENCES on an
-- ADD COLUMN IF NOT EXISTS is not covered by the IF NOT EXISTS: Postgres lifts
-- it into its own ADD CONSTRAINT subcommand during parse analysis, so a second
-- run skips the column and then adds transactions_subscription_id_fkey1 beside
-- the first. 0002 has the same latent bug.
alter table transactions
  add column if not exists subscription_id     text,
  add column if not exists subscription_period date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'transactions'::regclass
       and conname = 'transactions_subscription_id_fkey'
  ) then
    alter table transactions
      add constraint transactions_subscription_id_fkey
      foreign key (subscription_id) references subscriptions(id) on delete set null;
  end if;
end $$;

create index if not exists transactions_subscription_idx
  on transactions (subscription_id) where subscription_id is not null;
