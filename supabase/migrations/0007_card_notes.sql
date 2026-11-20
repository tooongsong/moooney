-- Free-text notes for a credit card: the fine print the category rates can't
-- hold (merchant rules, caps, closing date). Shown as written; never parsed.
alter table payment_methods add column if not exists notes text;
