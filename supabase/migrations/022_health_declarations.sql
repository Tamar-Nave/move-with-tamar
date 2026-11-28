-- Move with Tamar: health declarations. The app keeps only "the studio owner approved it" and the date,
-- never the filled form (it holds an ID number and medical answers). An approval is valid for two years,
-- which the app calculates from approved_on.
-- A separate table on purpose: members may edit their own profile row, so an approval stored there
-- could be set by the member herself.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again.

create table if not exists public.health_declarations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  approved_on date not null default ((now() at time zone 'Asia/Jerusalem')::date),
  approved_by uuid default auth.uid() references public.profiles(id) on delete set null
);

alter table public.health_declarations enable row level security;

-- A member sees only her own approval; only the admin can create, change or remove one.
drop policy if exists health_declarations_read on public.health_declarations;
create policy health_declarations_read on public.health_declarations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists health_declarations_admin on public.health_declarations;
create policy health_declarations_admin on public.health_declarations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.health_declarations from anon;
-- New tables are not covered by the grant in 001 (same lesson as 009).
grant select, insert, update, delete on public.health_declarations to authenticated;

-- Who approved or removed an approval, and when (same audit log as 014).
drop trigger if exists audit_health_declarations on public.health_declarations;
create trigger audit_health_declarations after insert or update or delete on public.health_declarations
  for each row execute function public.log_admin_audit();
