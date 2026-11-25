-- Move with Tamar: DEMO DATA (safe to delete later with demo_cleanup.sql)
-- Demo client login:  demo.noa@demo.movewithtamar.test   (choose your own password on the crypt() line below before running)
-- Run in Supabase Dashboard > SQL Editor > New query > Run.

create or replace function pg_temp.book(p_class uuid, p_handles text[], p_status public.booking_status)
returns void language sql as $$
  insert into public.bookings (class_id, user_id, status, charged, attended, created_at)
  select p_class, p.id, p_status, (p_status = 'booked' and m.plan = 'monthly_8'), null,
         clock_timestamp() + (h.ord * interval '1 second')
  from unnest(p_handles) with ordinality as h(handle, ord)
  join public.profiles p on p.email = h.handle || '@demo.movewithtamar.test'
  join public.memberships m on m.user_id = p.id;
$$;

do $$
declare
  d record;
  uid uuid;
  il_today date := (now() at time zone 'Asia/Jerusalem')::date;
  month_start date := date_trunc('month', (now() at time zone 'Asia/Jerusalem'))::date;
  month_end date := (date_trunc('month', (now() at time zone 'Asia/Jerusalem')) + interval '1 month - 1 day')::date;
  c_full uuid; c_evening uuid; c_noa uuid; c_later uuid; c_far uuid; c_past1 uuid; c_past2 uuid;
  noa uuid;
begin
  -- 1. demo members (can sign in only if they have a password; only Noa is meant for that)
  for d in select * from (values
    ('demo.noa',   'נועה',  'לוי',     'monthly_8', 0),
    ('demo.michal','מיכל',  'כהן',     'unlimited', 0),
    ('demo.shira', 'שירה',  'אברהם',   'monthly_8', -7),
    ('demo.dana',  'דנה',   'פרץ',     'monthly_8', 0),
    ('demo.yael',  'יעל',   'מזרחי',   'unlimited', 0),
    ('demo.liat',  'ליאת',  'בן דוד',  'monthly_8', 0),
    ('demo.roni',  'רוני',  'שמש',     'monthly_8', 0),
    ('demo.inbal', 'ענבל',  'אורן',    'unlimited', 0)
  ) as t(handle, fn, ln, plan, bonus) loop
    insert into public.invites (email, first_name, last_name)
      values (d.handle || '@demo.movewithtamar.test', d.fn, d.ln) on conflict do nothing;
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      d.handle || '@demo.movewithtamar.test', crypt('CHANGE-ME-before-running', gen_salt('bf')), now(),
      '', '', '', '',
      '{"provider":"email","providers":["email"]}', '{}', now(), now()
    );
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid::text, uid,
              jsonb_build_object('sub', uid::text, 'email', d.handle || '@demo.movewithtamar.test', 'email_verified', true),
              'email', now(), now(), now());
    insert into public.memberships (user_id, plan, bonus_entries, starts_on, ends_on)
      values (uid, d.plan::public.plan_type, d.bonus, month_start, month_end);
  end loop;

  -- 2. classes (all marked [demo] in notes)
  insert into public.classes (kind, starts_at, capacity, registration_opens_at, notes)
    values ('functional', ((il_today + 1) + time '07:00') at time zone 'Asia/Jerusalem', 4, now() - interval '3 days', '[demo]')
    returning id into c_full;
  insert into public.classes (kind, starts_at, capacity, registration_opens_at, notes)
    values ('sculpt', ((il_today + 1) + time '19:00') at time zone 'Asia/Jerusalem', 12, now() - interval '3 days', '[demo]')
    returning id into c_evening;
  insert into public.classes (kind, starts_at, capacity, registration_opens_at, notes)
    values ('sculpt', ((il_today + 2) + time '09:00') at time zone 'Asia/Jerusalem', 12, now() - interval '3 days', '[demo]')
    returning id into c_noa;
  insert into public.classes (kind, starts_at, capacity, registration_opens_at, notes)
    values ('functional', ((il_today + 3) + time '20:00') at time zone 'Asia/Jerusalem', 10, now() + interval '2 days', '[demo]')
    returning id into c_later;
  insert into public.classes (kind, starts_at, capacity, registration_opens_at, notes)
    values ('sculpt', ((il_today + 5) + time '19:00') at time zone 'Asia/Jerusalem', 8, now() - interval '3 days', '[demo]')
    returning id into c_far;
  insert into public.classes (kind, starts_at, capacity, registration_opens_at, cancel_hours_before, notes)
    values ('sculpt', ((il_today - 2) + time '19:00') at time zone 'Asia/Jerusalem', 12, now() - interval '9 days', 24, '[demo]')
    returning id into c_past1;
  insert into public.classes (kind, starts_at, capacity, registration_opens_at, cancel_hours_before, notes)
    values ('functional', ((il_today - 4) + time '07:00') at time zone 'Asia/Jerusalem', 12, now() - interval '9 days', 24, '[demo]')
    returning id into c_past2;

  -- 3. bookings
  perform pg_temp.book(c_full, array['demo.michal','demo.yael','demo.dana','demo.liat'], 'booked');
  perform pg_temp.book(c_full, array['demo.roni','demo.inbal'], 'waitlist');           -- full class with a waitlist
  perform pg_temp.book(c_evening, array['demo.michal','demo.dana','demo.liat','demo.roni','demo.inbal','demo.yael'], 'booked');
  perform pg_temp.book(c_noa, array['demo.noa','demo.michal','demo.dana'], 'booked');  -- Noa is registered here
  perform pg_temp.book(c_far, array['demo.yael','demo.liat'], 'booked');
  perform pg_temp.book(c_past1, array['demo.noa','demo.michal','demo.dana','demo.liat'], 'booked');
  perform pg_temp.book(c_past2, array['demo.noa','demo.michal','demo.yael'], 'booked');
  update public.bookings set attended = true where class_id in (c_past1, c_past2);
  update public.bookings set attended = false
    where class_id = c_past1 and user_id = (select id from public.profiles where email = 'demo.liat@demo.movewithtamar.test');

  -- 4. one message
  insert into public.messages (title, body, audience)
    values ('[דמו] שינוי בלו״ז השבוע', 'האימון הפונקציונלי ביום ו׳ עובר ל-08:00. נתראה!', 'all');
end $$;

select 'demo ready' as status,
       (select count(*) from public.profiles where email like '%@demo.movewithtamar.test') as demo_members,
       (select count(*) from public.classes where notes = '[demo]') as demo_classes;
