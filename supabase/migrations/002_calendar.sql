-- Move with Tamar: personal calendar feed (phase 1)
-- Run once in Supabase Dashboard > SQL Editor.

alter table public.profiles add column if not exists calendar_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_calendar_token_key on public.profiles (calendar_token);

-- The signed-in member's own secret calendar token.
create or replace function public.my_calendar_token() returns uuid
language sql stable security definer set search_path = public as $$
  select calendar_token from public.profiles where id = auth.uid();
$$;

-- New token = the old calendar link stops working.
create or replace function public.reset_calendar_token() returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid := gen_random_uuid();
begin
  update public.profiles set calendar_token = t where id = auth.uid();
  return t;
end $$;

-- Read by the calendar link (no login: the secret token is the key). Returns only that member's booked classes.
create or replace function public.calendar_feed(p_token uuid)
returns table (class_id uuid, kind public.class_kind, starts_at timestamptz, duration_min int,
               class_status public.class_status, notes text)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.starts_at, c.duration_min, c.status, c.notes
  from public.profiles p
  join public.bookings b on b.user_id = p.id and b.status = 'booked'
  join public.classes c on c.id = b.class_id
  where p.calendar_token = p_token and c.starts_at > now() - interval '60 days'
  order by c.starts_at;
$$;

revoke execute on function public.calendar_feed(uuid), public.my_calendar_token(), public.reset_calendar_token() from public, anon;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;
grant execute on function public.my_calendar_token(), public.reset_calendar_token() to authenticated;
