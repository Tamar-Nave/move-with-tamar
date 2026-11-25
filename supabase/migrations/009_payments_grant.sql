-- Move with Tamar: fix for "permission denied for table membership_payments".
-- 001_init.sql granted select/insert/update/delete on "all tables in schema public" to authenticated —
-- but that grant only covers tables that existed at that moment. membership_payments was created later
-- (007_payments.sql), so it never got it: Postgres checks this base grant BEFORE even looking at RLS policies,
-- which is why the error said "permission denied for table", not a row-level-security message.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again.

grant select, insert, update, delete on public.membership_payments to authenticated;
