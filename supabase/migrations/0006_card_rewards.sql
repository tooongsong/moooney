-- A credit card's cashback rates: { "base": number, "categories": { name: number } },
-- percentages as plain numbers. NULL means no rules. Only read for
-- type = 'credit_card'. See docs/superpowers/specs/2026-11-19-best-card-design.md.
alter table payment_methods add column if not exists rewards jsonb;

-- The day of the month a credit card's payment is due, 1–31. NULL = not set.
-- A month without that day uses its last day; see src/lib/paymentDue.ts.
alter table payment_methods add column if not exists payment_due_day integer;
