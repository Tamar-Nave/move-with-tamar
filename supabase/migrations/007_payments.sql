-- Move with Tamar: monthly payment tracking + payment-reminder push notification (to Tamar only).
-- Run once in Supabase Dashboard > SQL Editor.

-- One row per member per calendar month she's paid for. Presence of a row = paid.
create table if not exists public.membership_payments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year_month text not null,  -- 'YYYY-MM'
  paid_at timestamptz not null default now(),
  marked_by uuid references public.profiles(id),
  primary key (user_id, year_month)
);
alter table public.membership_payments enable row level security;
drop policy if exists membership_payments_admin on public.membership_payments;
create policy membership_payments_admin on public.membership_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- 001_init.sql's blanket grant only covers tables that existed when it ran — a table created later
-- (like this one) needs its own grant, or every query fails with "permission denied for table ...".
grant select, insert, update, delete on public.membership_payments to authenticated;

-- Every 2 days from the start of the month (days 1, 3, 5, ...), after 9am Israel time, once a day:
-- one push to every admin listing members with an active membership this month who haven't paid yet.
-- Stays quiet once everyone's marked paid (or no one has an active membership).
create or replace function public.queue_payment_reminder() returns void
language plpgsql security definer set search_path = public as $$
declare
  il_now timestamptz := now() at time zone 'Asia/Jerusalem';
  il_date date := il_now::date;
  ym text := to_char(il_date, 'YYYY-MM');
  names text;
  seed text;
  rid uuid;
begin
  if mod(extract(day from il_date)::int, 2) = 0 or extract(hour from il_now) < 9 then
    return; -- even day of the month, or before 9am
  end if;

  select string_agg(p.first_name, ', ' order by p.first_name) into names
  from public.profiles p
  join public.memberships m on m.user_id = p.id and m.status = 'active' and il_date between m.starts_on and m.ends_on
  where not exists (select 1 from public.membership_payments mp where mp.user_id = p.id and mp.year_month = ym);

  if names is null then return; end if; -- everyone active has paid this month

  seed := 'payment_reminder:' || il_date::text;
  rid := (substring(md5(seed) for 8) || '-' || substring(md5(seed) from 9 for 4) || '-' ||
          substring(md5(seed) from 13 for 4) || '-' || substring(md5(seed) from 17 for 4) || '-' ||
          substring(md5(seed) from 21 for 12))::uuid;

  insert into public.notifications (user_id, kind, ref_id, title, body, url)
  select p.id, 'payment_reminder', rid, 'תזכורת תשלום', 'עדיין לא שילמו החודש: ' || names, '/admin/members'
  from public.profiles p where p.is_admin
  on conflict do nothing;
end $$;

-- Hook it into the existing per-minute cron sender (no worker changes needed).
create or replace function public.claim_notifications(p_secret text, p_limit int default 30)
returns table (sub_endpoint text, sub_p256dh text, sub_auth text, n_title text, n_body text, n_url text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.check_cron_secret(p_secret) then raise exception 'forbidden'; end if;
  perform public.queue_due_notifications();
  perform public.queue_payment_reminder();
  return query
  with claimed as (
    update public.notifications n set sent_at = now()
    where n.id in (select id from public.notifications where sent_at is null order by created_at limit p_limit for update skip locked)
    returning n.*
  )
  select s.endpoint, s.p256dh, s.auth, c.title, c.body, c.url
  from claimed c join public.push_subscriptions s on s.user_id = c.user_id
  where c.created_at > now() - interval '6 hours';
end $$;

revoke execute on function public.queue_payment_reminder() from public, anon, authenticated;
