-- Move with Tamar: remember when a member's calendar link was last read (= her calendar is connected)
-- Run once in Supabase Dashboard > SQL Editor.

alter table public.profiles add column if not exists calendar_last_fetch_at timestamptz;

drop function if exists public.calendar_feed(uuid);
create function public.calendar_feed(p_token uuid)
returns table (class_id uuid, kind public.class_kind, starts_at timestamptz, duration_min int,
               class_status public.class_status, notes text)
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set calendar_last_fetch_at = now() where calendar_token = p_token;
  return query
  select c.id, c.kind, c.starts_at, c.duration_min, c.status, c.notes
  from public.profiles p
  join public.bookings b on b.user_id = p.id and b.status = 'booked'
  join public.classes c on c.id = b.class_id
  where p.calendar_token = p_token and c.starts_at > now() - interval '60 days'
  order by c.starts_at;
end $$;

revoke execute on function public.calendar_feed(uuid) from public, anon;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;
