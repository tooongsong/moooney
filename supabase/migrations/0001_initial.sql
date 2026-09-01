-- Run this in Supabase Dashboard → SQL Editor

-- payment_methods (accounts)
create table if not exists payment_methods (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  starting_balance numeric(12,2) not null default 0,
  type text not null default 'bank',
  created_at timestamptz not null default now()
);
alter table payment_methods enable row level security;
create policy "own payment_methods" on payment_methods for all using (auth.uid() = user_id);

-- transactions
create table if not exists transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  amount numeric(12,2) not null,
  type text not null default 'expense',
  category text not null,
  merchant text not null,
  description text not null,
  payment_method text,
  notes text,
  receipt_url text,
  items jsonb,
  raw_input text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table transactions enable row level security;
create policy "own transactions" on transactions for all using (auth.uid() = user_id);

-- custom_categories
create table if not exists custom_categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table custom_categories enable row level security;
create policy "own custom_categories" on custom_categories for all using (auth.uid() = user_id);

-- transfers
create table if not exists transfers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  amount numeric(12,2) not null,
  from_account text not null,
  to_account text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table transfers enable row level security;
create policy "own transfers" on transfers for all using (auth.uid() = user_id);
