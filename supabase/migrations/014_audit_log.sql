-- Move with Tamar: audit log for admin-sensitive tables.
-- Run once in Supabase Dashboard > SQL Editor.

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid references public.profiles(id),
  op text not null,          -- 'INSERT' | 'UPDATE' | 'DELETE'
  table_name text not null,
  row_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create policy admin_audit_log_read on public.admin_audit_log for select to authenticated
  using (public.is_admin());
grant select on public.admin_audit_log to authenticated;

-- Generic trigger: records who changed what, on whichever table it's attached to.
-- security definer so it can write to admin_audit_log regardless of the caller's own grants.
create or replace function public.log_admin_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_row jsonb;
begin
  v_row := case when TG_OP = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.admin_audit_log (actor, op, table_name, row_id, detail)
  values (auth.uid(), TG_OP, TG_TABLE_NAME, (v_row->>'id')::uuid, v_row);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_bookings on public.bookings;
create trigger audit_bookings after insert or update or delete on public.bookings
  for each row execute function public.log_admin_audit();

drop trigger if exists audit_memberships on public.memberships;
create trigger audit_memberships after insert or update or delete on public.memberships
  for each row execute function public.log_admin_audit();

drop trigger if exists audit_membership_payments on public.membership_payments;
create trigger audit_membership_payments after insert or update or delete on public.membership_payments
  for each row execute function public.log_admin_audit();
