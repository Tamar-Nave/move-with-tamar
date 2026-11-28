-- Move with Tamar: an entry the admin adds by hand counts only for the month it was added to.
-- Until now memberships.bonus_entries was added to every month of a membership.
-- Bonuses that already exist are moved to the current month. The old column stays (set to 0) so that
-- a copy of the app that is still open on someone's phone doesn't break; an entry added from such an old
-- copy is not counted, so reload the app after deploying.
-- Run once in Supabase Dashboard > SQL Editor, shortly before deploying. Safe to run again.

begin; -- all or nothing: a half-run followed by a second run would move bonuses twice

create table if not exists public.membership_bonus (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  entries int not null default 0 check (entries >= 0),
  primary key (membership_id, month)
);

alter table public.membership_bonus enable row level security;

drop policy if exists membership_bonus_read on public.membership_bonus;
create policy membership_bonus_read on public.membership_bonus for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.memberships m where m.id = membership_id and m.user_id = auth.uid()));

drop policy if exists membership_bonus_admin on public.membership_bonus;
create policy membership_bonus_admin on public.membership_bonus for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.membership_bonus from anon;
grant select, insert, update, delete on public.membership_bonus to authenticated;

-- Adding an entry was logged while it lived on memberships (014); keep it logged.
drop trigger if exists audit_membership_bonus on public.membership_bonus;
create trigger audit_membership_bonus after insert or update or delete on public.membership_bonus
  for each row execute function public.log_admin_audit();

-- Move existing bonuses to this month, then zero the old column so a second run moves nothing twice.
insert into public.membership_bonus (membership_id, month, entries)
  select id, date_trunc('month', now() at time zone 'Asia/Jerusalem')::date, bonus_entries
  from public.memberships where bonus_entries > 0 and status in ('active', 'frozen')
  on conflict (membership_id, month) do update set entries = public.membership_bonus.entries + excluded.entries;
update public.memberships set bonus_entries = 0 where bonus_entries <> 0 and status in ('active', 'frozen');

-- Same as 021, except that the bonus is the one of the month being counted.
create or replace function public.entries_left(p_user uuid, p_at timestamptz default now())
returns int language sql stable security definer set search_path = public as $$
  select case when m.plan = 'monthly_8'
    then m.entries_per_month
      + coalesce((select mb.entries from public.membership_bonus mb
                  where mb.membership_id = m.id
                    and mb.month = date_trunc('month', p_at at time zone 'Asia/Jerusalem')::date), 0)
      - (
      select count(*) from public.bookings b join public.classes c on c.id = b.class_id
      where b.user_id = p_user and b.charged and c.status <> 'cancelled'
        and date_trunc('month', c.starts_at at time zone 'Asia/Jerusalem')
          = date_trunc('month', p_at at time zone 'Asia/Jerusalem'))::int
    else null end
  from public.memberships m
  where m.user_id = p_user and m.status = 'active'
    and (p_at at time zone 'Asia/Jerusalem')::date between m.starts_on and m.ends_on
  order by m.created_at desc limit 1;
$$;

-- The "+ הוספת כניסה אחת" button: one more entry for the month of p_at (this month by default).
create or replace function public.admin_add_entry(p_membership uuid, p_at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.membership_bonus (membership_id, month, entries)
    values (p_membership, date_trunc('month', p_at at time zone 'Asia/Jerusalem')::date, 1)
    on conflict (membership_id, month) do update set entries = public.membership_bonus.entries + 1;
end $$;
revoke execute on function public.admin_add_entry(uuid, timestamptz) from public, anon;
grant execute on function public.admin_add_entry(uuid, timestamptz) to authenticated;

-- Same as 015, except that "והוספת כניסה" adds the entry to the month of the class.
create or replace function public.admin_book(p_class uuid, p_user uuid, p_charge boolean, p_add_entry boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare c public.classes; m_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into c from public.classes where id = p_class for update;
  if p_add_entry then
    select id into m_id from public.memberships
      where user_id = p_user and status = 'active'
        and (c.starts_at at time zone 'Asia/Jerusalem')::date between starts_on and ends_on
      order by created_at desc limit 1;
    if m_id is not null then perform public.admin_add_entry(m_id, c.starts_at); end if;
  end if;
  insert into public.bookings (class_id, user_id, status, charged)
    values (p_class, p_user, 'booked',
            p_charge and public.entries_left(p_user, c.starts_at) is not null);
end $$;

-- These two answer questions about any user id, and only other database functions need them.
-- (The app itself calls my_entries_left, which answers about the signed-in member only.)
revoke execute on function public.entries_left(uuid, timestamptz), public.has_active_membership(uuid, timestamptz)
  from public, anon, authenticated;

commit;
