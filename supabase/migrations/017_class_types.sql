-- Move with Tamar: dynamic class types (replaces the hard-coded 'sculpt' / 'functional' enum in the UI).
-- Backwards compatible: classes.kind stays (now nullable), existing classes are linked to the two seeded types,
-- and anything that still only knows `kind` (old cached app versions, old calendar links) keeps working.
-- Run once in Supabase Dashboard > SQL Editor, BEFORE deploying the new app/worker. Safe to run again.

-- ============ Table ============
create table if not exists public.class_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 400),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  reminder_note text check (reminder_note is null or char_length(reminder_note) <= 120),
  is_active boolean not null default true,
  legacy_key text,                       -- 'sculpt' | 'functional' for the two original types, null otherwise
  created_at timestamptz not null default now()
);
create unique index if not exists class_types_legacy_key_idx on public.class_types (legacy_key) where legacy_key is not null;

alter table public.class_types enable row level security;
drop policy if exists class_types_read on public.class_types;
create policy class_types_read on public.class_types for select to authenticated using (true);
drop policy if exists class_types_admin on public.class_types;
create policy class_types_admin on public.class_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- (tables created after 001 don't get its blanket grant: see 009)
grant select, insert, update, delete on public.class_types to authenticated;

-- Who changed which type (same trigger as bookings/memberships, see 014).
drop trigger if exists audit_class_types on public.class_types;
create trigger audit_class_types after insert or update or delete on public.class_types
  for each row execute function public.log_admin_audit();

-- A type that classes still point to can't be really deleted (the app hides it with is_active = false instead).
-- Without this, "on delete set null" below would silently strip the type from past classes.
create or replace function public.class_types_block_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.classes where type_id = old.id) then raise exception 'class_type_in_use'; end if;
  return old;
end $$;
drop trigger if exists class_types_block_delete on public.class_types;
create trigger class_types_block_delete before delete on public.class_types
  for each row execute function public.class_types_block_delete();

-- ============ classes.type_id ============
alter table public.classes add column if not exists type_id uuid references public.class_types(id) on delete set null;
create index if not exists classes_type_idx on public.classes (type_id);
alter table public.classes alter column kind drop not null;

-- The two existing types, then link every existing class to its type by the old `kind`.
insert into public.class_types (name, description, color, reminder_note, legacy_key) values
  ('SCULPT', '', '#C2410C', 'אין צורך בנעליים סגורות', 'sculpt'),
  ('פונקציונלי', '', '#0F766E', null, 'functional')
on conflict (legacy_key) where legacy_key is not null do nothing;

update public.classes c set type_id = t.id
  from public.class_types t
  where c.type_id is null and t.legacy_key = c.kind::text;

-- ============ Labels used by notifications ============
-- Name of a class: its type's name; classes with no type fall back to the old kind wording.
create or replace function public.class_label(c public.classes) returns text
language sql stable set search_path = public as $$
  select coalesce(
    (select t.name from public.class_types t where t.id = c.type_id),
    case c.kind when 'sculpt' then 'SCULPT' when 'functional' then 'אימון פונקציונלי' else 'אימון' end);
$$;

-- Optional extra line for reminders (e.g. "אין צורך בנעליים סגורות"), set per type.
create or replace function public.class_reminder_note(c public.classes) returns text
language sql stable set search_path = public as $$
  select nullif(btrim(t.reminder_note), '') from public.class_types t where t.id = c.type_id;
$$;

revoke execute on function public.class_label(public.classes), public.class_reminder_note(public.classes) from public, anon;

-- Reminders (was 010): same as before, but the name and the note come from the class type.
create or replace function public.queue_due_notifications() returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, ref_id, title, body, url)
  select b.user_id, 'reminder', c.id, 'תזכורת לאימון',
         public.class_label(c) || ' מתחיל ב־' || to_char(c.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI')
           || coalesce(' (' || public.class_reminder_note(c) || ')', ''),
         '/schedule/' || c.id
  from public.bookings b
  join public.classes c on c.id = b.class_id
  where b.status = 'booked' and c.status = 'scheduled' and c.starts_at > now()
    and now() >= c.starts_at - make_interval(mins => c.reminder_minutes_before)
  on conflict do nothing;
$$;

-- A spot opened from the waitlist (was 003).
create or replace function public.notify_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.classes;
begin
  if new.status = 'offered' and old.status is distinct from 'offered' then
    select * into c from public.classes where id = new.class_id;
    insert into public.notifications (user_id, kind, ref_id, title, body, url)
    values (new.user_id, 'offer', new.id, 'התפנה לך מקום!',
            public.class_label(c) || ' ב־' || to_char(c.starts_at at time zone 'Asia/Jerusalem', 'DD.MM HH24:MI')
              || '. יש לך ' || c.waitlist_confirm_minutes || ' דקות לאשר.',
            '/schedule/' || c.id)
    on conflict do nothing;
  end if;
  return new;
end $$;

-- A class was cancelled (was 003).
create or replace function public.notify_class_cancelled() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.notifications (user_id, kind, ref_id, title, body, url)
    select b.user_id, 'class_cancelled', new.id, 'האימון בוטל',
           public.class_label(new) || ' ב־' || to_char(new.starts_at at time zone 'Asia/Jerusalem', 'DD.MM HH24:MI') || ' בוטל.',
           '/schedule'
    from public.bookings b where b.class_id = new.id and b.status in ('booked', 'offered', 'waitlist')
    on conflict do nothing;
  end if;
  return new;
end $$;

-- ============ Personal calendar feed (was 004): now also returns the type's name ============
drop function if exists public.calendar_feed(uuid);
create function public.calendar_feed(p_token uuid)
returns table (class_id uuid, kind public.class_kind, type_name text, starts_at timestamptz, duration_min int,
               class_status public.class_status, notes text)
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set calendar_last_fetch_at = now() where calendar_token = p_token;
  return query
  select c.id, c.kind, (select t.name from public.class_types t where t.id = c.type_id), c.starts_at, c.duration_min, c.status, c.notes
  from public.profiles p
  join public.bookings b on b.user_id = p.id and b.status = 'booked'
  join public.classes c on c.id = b.class_id
  where p.calendar_token = p_token and c.starts_at > now() - interval '60 days'
  order by c.starts_at;
end $$;

revoke execute on function public.calendar_feed(uuid) from public, anon;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;
