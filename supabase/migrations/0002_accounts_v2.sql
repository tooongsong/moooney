-- Phase 1: Data layer stabilization
-- Run in Supabase Dashboard → SQL Editor

-- ─── 1. Extend payment_methods ───────────────────────────────────────────────

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS institution    text,
  ADD COLUMN IF NOT EXISTS currency       text        NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS credit_limit   numeric(12,2),
  ADD COLUMN IF NOT EXISTS current_balance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at    timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

-- Normalize legacy 'bank' → 'checking'
UPDATE payment_methods SET type = 'checking' WHERE type = 'bank';

-- ─── 2. Add ID references to transactions ────────────────────────────────────

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method_id text REFERENCES payment_methods(id);

-- ─── 3. Add ID references to transfers ───────────────────────────────────────

ALTER TABLE transfers
  ADD COLUMN IF NOT EXISTS from_account_id text REFERENCES payment_methods(id),
  ADD COLUMN IF NOT EXISTS to_account_id   text REFERENCES payment_methods(id);

-- ─── 4. Backfill payment_method_id on existing transactions ──────────────────

UPDATE transactions t
SET payment_method_id = pm.id
FROM payment_methods pm
WHERE t.user_id = pm.user_id
  AND t.payment_method = pm.name
  AND t.payment_method_id IS NULL;

-- ─── 5. Backfill from/to IDs on existing transfers ───────────────────────────

UPDATE transfers tr
SET from_account_id = pm.id
FROM payment_methods pm
WHERE tr.user_id = pm.user_id
  AND tr.from_account = pm.name
  AND tr.from_account_id IS NULL;

UPDATE transfers tr
SET to_account_id = pm.id
FROM payment_methods pm
WHERE tr.user_id = pm.user_id
  AND tr.to_account = pm.name
  AND tr.to_account_id IS NULL;

-- ─── 6. Helper: recompute current_balance for one account ────────────────────
-- Call after any mutation: SELECT recalculate_account_balance('account-id');

CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_starting numeric(12,2);
  v_tx_delta numeric(12,2);
  v_tr_delta numeric(12,2);
BEGIN
  SELECT COALESCE(starting_balance, 0)
    INTO v_starting
    FROM payment_methods
   WHERE id = p_account_id;

  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('income', 'refund') THEN  amount
      WHEN type = 'expense'             THEN -amount
      ELSE 0
    END
  ), 0)
    INTO v_tx_delta
    FROM transactions
   WHERE payment_method_id = p_account_id;

  SELECT COALESCE(
    SUM(CASE WHEN to_account_id   = p_account_id THEN  amount ELSE 0 END) +
    SUM(CASE WHEN from_account_id = p_account_id THEN -amount ELSE 0 END)
  , 0)
    INTO v_tr_delta
    FROM transfers
   WHERE from_account_id = p_account_id
      OR to_account_id   = p_account_id;

  UPDATE payment_methods
     SET current_balance = v_starting + v_tx_delta + v_tr_delta,
         updated_at      = now()
   WHERE id = p_account_id;
END;
$$;

-- ─── 7. Seed current_balance for all existing accounts ───────────────────────

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM payment_methods LOOP
    PERFORM recalculate_account_balance(rec.id);
  END LOOP;
END;
$$;
