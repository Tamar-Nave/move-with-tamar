-- Move with Tamar: class roster also returns last_name, so the app can tell apart two members
-- who share a first name (shown only when that actually happens — see schedule/[id].tsx).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again.
-- (Postgres won't let CREATE OR REPLACE change a function's return columns, hence the explicit drop.)

drop function if exists public.class_roster(uuid);

create function public.class_roster(p_class uuid)
returns table (booking_id uuid, user_id uuid, first_name text, last_name text, avatar_url text, status public.booking_status, queue_pos int)
language sql stable security definer set search_path = public as $$
  select b.id, b.user_id, p.first_name, p.last_name, p.avatar_url, b.status,
         case when b.status = 'waitlist'
              then (row_number() over (partition by b.status order by b.created_at))::int end
  from public.bookings b join public.profiles p on p.id = b.user_id
  where b.class_id = p_class and b.status in ('booked','offered','waitlist')
  order by b.created_at;
$$;

-- Dropping the old function also drops its grant — same lesson as the membership_payments bug (009):
-- give the NEW function object its execute permission back explicitly, or every call to it 403s.
grant execute on function public.class_roster(uuid) to authenticated;
