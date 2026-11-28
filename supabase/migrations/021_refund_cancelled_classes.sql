-- Move with Tamar: a class the admin cancels gives its entry back to every member who was registered to it.
-- Until now the booking stayed "charged", so an 8-entry card lost an entry for a class that never happened.
-- The fix is in the calculation (cancelled classes simply don't count), so it also applies to classes already cancelled.
-- Everything else is unchanged from 001: registration still takes an entry (future classes included), cancelling in
-- time gives it back, and the waitlist takes nothing until the spot is confirmed.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again.

create or replace function public.entries_left(p_user uuid, p_at timestamptz default now())
returns int language sql stable security definer set search_path = public as $$
  select case when m.plan = 'monthly_8'
    then m.entries_per_month + m.bonus_entries - (
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
