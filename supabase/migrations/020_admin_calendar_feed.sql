-- Move with Tamar: calendar feed for the admin with ALL the studio's classes (to subscribe to from Google Calendar).
-- The member feed (calendar_feed) returns only the classes a member booked; this one returns every class,
-- but only for the secret token of an ADMIN profile (any other token gets an empty calendar, same as a wrong one).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again.

create or replace function public.admin_calendar_feed(p_token uuid)
returns table (class_id uuid, kind public.class_kind, type_name text, starts_at timestamptz, duration_min int,
               class_status public.class_status, notes text)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p where p.calendar_token = p_token and p.is_admin) then
    return;
  end if;
  return query
  select c.id, c.kind, (select t.name from public.class_types t where t.id = c.type_id), c.starts_at, c.duration_min, c.status, c.notes
  from public.classes c
  where c.starts_at > now() - interval '60 days'
  order by c.starts_at;
end $$;

revoke execute on function public.admin_calendar_feed(uuid) from public, anon;
grant execute on function public.admin_calendar_feed(uuid) to anon, authenticated;
