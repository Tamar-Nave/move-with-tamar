-- Move with Tamar: push notifications (reminders, messages, waitlist offers, cancelled classes)
-- Run once in Supabase Dashboard > SQL Editor.

-- ============ Tables ============
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own_read on public.push_subscriptions;
create policy push_own_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
grant select on public.push_subscriptions to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  ref_id uuid,
  title text not null,
  body text not null,
  url text not null default '/',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create unique index if not exists notifications_dedupe on public.notifications (user_id, kind, ref_id) where ref_id is not null;
create index if not exists notifications_pending on public.notifications (created_at) where sent_at is null;
alter table public.notifications enable row level security;   -- no policies: only the functions below touch it

-- Only a hash of the sender's secret is stored here (the real secret lives in the Cloudflare worker).
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (name, value) values ('cron_secret_hash', '01b68d616e11828e18bc484697d0c6d913b480ad2229e3d77234729563f15962')
  on conflict (name) do update set value = excluded.value;

-- ============ Helpers ============
create or replace function public.kind_label(k public.class_kind) returns text
language sql immutable as $$ select case k when 'sculpt' then 'SCULPT' else 'אימון פונקציונלי' end; $$;

create or replace function public.check_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.app_secrets
    where name = 'cron_secret_hash' and value = encode(digest(p_secret, 'sha256'), 'hex'));
$$;

-- Reminders: a notification for every registered member once the class is within its reminder window.
create or replace function public.queue_due_notifications() returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, ref_id, title, body, url)
  select b.user_id, 'reminder', c.id, 'תזכורת לאימון',
         public.kind_label(c.kind) || ' מתחיל ב־' || to_char(c.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI'),
         '/schedule/' || c.id
  from public.bookings b
  join public.classes c on c.id = b.class_id
  where b.status = 'booked' and c.status = 'scheduled' and c.starts_at > now()
    and now() >= c.starts_at - make_interval(mins => c.reminder_minutes_before)
  on conflict do nothing;
$$;

-- ============ Sender (called every minute by the worker with the secret) ============
create or replace function public.claim_notifications(p_secret text, p_limit int default 30)
returns table (sub_endpoint text, sub_p256dh text, sub_auth text, n_title text, n_body text, n_url text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.check_cron_secret(p_secret) then raise exception 'forbidden'; end if;
  perform public.queue_due_notifications();
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

create or replace function public.drop_push_subscription(p_secret text, p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.check_cron_secret(p_secret) then raise exception 'forbidden'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end $$;

-- ============ Member actions ============
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.send_test_notification() returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, ref_id, title, body, url)
  values (auth.uid(), 'test', gen_random_uuid(), 'התראת ניסיון', 'ההתראות מופעלות. נתראה באימון!', '/');
$$;

-- ============ Automatic notifications ============
-- New message from Tamar -> everyone in the audience (except the sender).
create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, ref_id, title, body, url)
  select p.id, 'message', new.id, new.title, left(new.body, 140), '/messages'
  from public.profiles p
  where p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and (new.audience = 'all' or exists (
      select 1 from public.memberships m
      where m.user_id = p.id and m.status = 'active' and m.plan::text = new.audience
        and (now() at time zone 'Asia/Jerusalem')::date between m.starts_on and m.ends_on))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_message_created on public.messages;
create trigger on_message_created after insert on public.messages for each row execute function public.notify_message();

-- A spot opened for someone in the waitlist.
create or replace function public.notify_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.classes;
begin
  if new.status = 'offered' and old.status is distinct from 'offered' then
    select * into c from public.classes where id = new.class_id;
    insert into public.notifications (user_id, kind, ref_id, title, body, url)
    values (new.user_id, 'offer', new.id, 'התפנה לך מקום!',
            public.kind_label(c.kind) || ' ב־' || to_char(c.starts_at at time zone 'Asia/Jerusalem', 'DD.MM HH24:MI')
              || '. יש לך ' || c.waitlist_confirm_minutes || ' דקות לאשר.',
            '/schedule/' || c.id)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_booking_offered on public.bookings;
create trigger on_booking_offered after update of status on public.bookings for each row execute function public.notify_offer();

-- A class was cancelled -> everyone registered to it.
create or replace function public.notify_class_cancelled() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.notifications (user_id, kind, ref_id, title, body, url)
    select b.user_id, 'class_cancelled', new.id, 'האימון בוטל',
           public.kind_label(new.kind) || ' ב־' || to_char(new.starts_at at time zone 'Asia/Jerusalem', 'DD.MM HH24:MI') || ' בוטל.',
           '/schedule'
    from public.bookings b where b.class_id = new.id and b.status in ('booked', 'offered', 'waitlist')
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_class_cancelled on public.classes;
create trigger on_class_cancelled after update of status on public.classes for each row execute function public.notify_class_cancelled();

-- ============ Permissions ============
revoke execute on function public.kind_label(public.class_kind), public.check_cron_secret(text), public.queue_due_notifications(),
  public.claim_notifications(text, int), public.drop_push_subscription(text, text), public.save_push_subscription(text, text, text),
  public.remove_push_subscription(text), public.send_test_notification() from public, anon;
grant execute on function public.claim_notifications(text, int), public.drop_push_subscription(text, text) to anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text), public.remove_push_subscription(text),
  public.send_test_notification() to authenticated;
