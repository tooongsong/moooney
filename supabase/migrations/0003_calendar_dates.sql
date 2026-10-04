-- transactions.date and transfers.date hold calendar dates ("I spent this on the
-- 27th"), not points in time. Storing them as `timestamp` attached a zone to a
-- value that has none: writes recorded the writer's midnight, reads interpreted
-- the naive value as UTC, and the browser then rendered that instant in local
-- time — showing, and on save re-writing, the previous day.
--
-- `date` has no time and no zone, so nothing can shift it.
--
-- Lossless: the naive date part already holds the intended day. Verified before
-- running against all 92 transactions and 1 transfer — no row changes its date
-- under this cast.
alter table transactions alter column date type date using date::date;
alter table transfers    alter column date type date using date::date;
