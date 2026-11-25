-- Move with Tamar: initial schema (phase 1)
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

-- ============ Profiles & invites ============
create table public.invites (
  email text primary key,
  first_name text not null,
  last_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text,
  phone text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Only invited emails may create an account; profile is created from the invite.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  select * into inv from public.invites where lower(email) = lower(new.email);
  if inv.email is null then
    raise exception 'not_invited';
  end if;
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (new.id, new.email, inv.first_name, inv.last_name, inv.phone);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Memberships ============
create type public.plan_type as enum ('unlimited', 'monthly_8');
create type public.membership_status as enum ('active', 'frozen', 'ended');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan public.plan_type not null,
  entries_per_month int not null default 8,
  bonus_entries int not null default 0,  -- manual extra entries from Tamar
  starts_on date not null default current_date,
  ends_on date not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now()
);

-- ============ Classes & bookings ============
create type public.class_kind as enum ('sculpt', 'functional');
create type public.class_status as enum ('scheduled', 'cancelled');
create type public.booking_status as enum ('booked', 'waitlist', 'offered', 'cancelled');

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  kind public.class_kind not null,
  starts_at timestamptz not null,
  duration_min int not null default 50,
  capacity int not null check (capacity > 0),
  registration_opens_at timestamptz not null default now(),
  cancel_hours_before int not null default 24,
  waitlist_confirm_minutes int not null default 30,
  reminder_minutes_before int not null default 120,
  notes text,
  status public.class_status not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.booking_status not null,
  charged boolean not null default false,       -- consumed one entry from a monthly_8 plan
  attended boolean,                              -- null = not marked yet
  offer_expires_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index bookings_one_active_per_class
  on public.bookings (class_id, user_id) where status <> 'cancelled';
create index bookings_class_idx on public.bookings (class_id, status, created_at);

-- ============ Messages & recipes ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all',  -- 'all' | 'unlimited' | 'monthly_8' | 'class:<uuid>'
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  image_url text,
  minutes int,
  servings int,
  calories int, protein_g int, carbs_g int, fat_g int,
  instructions text,
  created_at timestamptz not null default now()
);
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position int not null default 0,
  text text not null,
  substitutes text[] not null default '{}'
);
create table public.recipe_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  primary key (user_id, recipe_id)
);

-- ============ Helpers ============
-- Entries left this month for a member (null = unlimited / no active plan).
create or replace function public.entries_left(p_user uuid, p_at timestamptz default now())
returns int language sql stable security definer set search_path = public as $$
  select case when m.plan = 'monthly_8'
    then m.entries_per_month + m.bonus_entries - (
      select count(*) from public.bookings b join public.classes c on c.id = b.class_id
      where b.user_id = p_user and b.charged
        and date_trunc('month', c.starts_at at time zone 'Asia/Jerusalem')
          = date_trunc('month', p_at at time zone 'Asia/Jerusalem'))::int
    else null end
  from public.memberships m
  where m.user_id = p_user and m.status = 'active'
    and (p_at at time zone 'Asia/Jerusalem')::date between m.starts_on and m.ends_on
  order by m.created_at desc limit 1;
$$;

create or replace function public.has_active_membership(p_user uuid, p_at timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
    where m.user_id = p_user and m.status = 'active'
      and (p_at at time zone 'Asia/Jerusalem')::date between m.starts_on and m.ends_on);
$$;

create or replace function public.spots_taken(p_class uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.bookings where class_id = p_class and status in ('booked','offered');
$$;

-- Move the first person in the waitlist to "offered" if a spot is free.
create or replace function public.promote_waitlist(p_class uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.classes; nxt public.bookings;
begin
  select * into c from public.classes where id = p_class for update;
  if c.status <> 'scheduled' or c.starts_at <= now() then return; end if;
  while public.spots_taken(p_class) < c.capacity loop
    select * into nxt from public.bookings
      where class_id = p_class and status = 'waitlist' order by created_at limit 1;
    exit when nxt.id is null;
    update public.bookings
      set status = 'offered', offer_expires_at = now() + make_interval(mins => c.waitlist_confirm_minutes)
      where id = nxt.id;
  end loop;
end $$;

-- Offers nobody confirmed in time go to the next person (run every minute).
create or replace function public.expire_waitlist_offers() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, class_id from public.bookings
           where status = 'offered' and offer_expires_at < now() loop
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = r.id;
    perform public.promote_waitlist(r.class_id);
  end loop;
end $$;

-- ============ Member actions ============
create or replace function public.book_class(p_class uuid) returns public.booking_status
language plpgsql security definer set search_path = public as $$
declare c public.classes; left_ int; st public.booking_status; plan_ public.plan_type;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into c from public.classes where id = p_class for update;
  if c.id is null or c.status <> 'scheduled' then raise exception 'class_unavailable'; end if;
  if c.starts_at <= now() then raise exception 'class_started'; end if;
  if c.registration_opens_at > now() then raise exception 'registration_not_open'; end if;
  if not public.has_active_membership(auth.uid(), c.starts_at) then raise exception 'no_active_membership'; end if;
  if exists (select 1 from public.bookings where class_id = p_class and user_id = auth.uid() and status <> 'cancelled')
    then raise exception 'already_registered'; end if;

  left_ := public.entries_left(auth.uid(), c.starts_at);
  if left_ is not null and left_ <= 0 then raise exception 'no_entries_left'; end if;

  st := case when public.spots_taken(p_class) < c.capacity then 'booked' else 'waitlist' end;
  insert into public.bookings (class_id, user_id, status, charged)
    values (p_class, auth.uid(), st, st = 'booked' and left_ is not null);
  return st;
end $$;

-- Confirm an offered waitlist spot.
create or replace function public.confirm_offer(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; c public.classes; left_ int;
begin
  select * into b from public.bookings where id = p_booking and user_id = auth.uid() for update;
  if b.id is null or b.status <> 'offered' or b.offer_expires_at < now() then raise exception 'offer_expired'; end if;
  select * into c from public.classes where id = b.class_id;
  left_ := public.entries_left(auth.uid(), c.starts_at);
  if left_ is not null and left_ <= 0 then raise exception 'no_entries_left'; end if;
  update public.bookings set status = 'booked', offer_expires_at = null, charged = (left_ is not null) where id = b.id;
end $$;

-- Member cancels: blocked after the cancellation deadline.
create or replace function public.cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; c public.classes;
begin
  select * into b from public.bookings where id = p_booking and user_id = auth.uid() for update;
  if b.id is null or b.status = 'cancelled' then raise exception 'booking_not_found'; end if;
  select * into c from public.classes where id = b.class_id;
  if b.status = 'booked' and now() > c.starts_at - make_interval(hours => c.cancel_hours_before)
    then raise exception 'cancellation_closed'; end if;
  update public.bookings set status = 'cancelled', charged = false,
    cancelled_at = now(), cancelled_by = auth.uid() where id = b.id;
  perform public.promote_waitlist(b.class_id);
end $$;

-- ============ Admin actions (Tamar only) ============
create or replace function public.admin_book(p_class uuid, p_user uuid, p_charge boolean, p_add_entry boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare c public.classes;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into c from public.classes where id = p_class for update;
  if p_add_entry then
    update public.memberships set bonus_entries = bonus_entries + 1
      where id = (select id from public.memberships where user_id = p_user and status = 'active'
                  order by created_at desc limit 1);
  end if;
  insert into public.bookings (class_id, user_id, status, charged)
    values (p_class, p_user, 'booked',
            p_charge and public.entries_left(p_user, c.starts_at) is not null);
end $$;

create or replace function public.admin_cancel_booking(p_booking uuid, p_refund boolean)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into b from public.bookings where id = p_booking for update;
  update public.bookings set status = 'cancelled', charged = case when p_refund then false else charged end,
    cancelled_at = now(), cancelled_by = auth.uid() where id = p_booking;
  perform public.promote_waitlist(b.class_id);
end $$;

-- What other members may see about a class: first name + photo only.
create or replace function public.class_roster(p_class uuid)
returns table (booking_id uuid, user_id uuid, first_name text, avatar_url text, status public.booking_status, queue_pos int)
language sql stable security definer set search_path = public as $$
  select b.id, b.user_id, p.first_name, p.avatar_url, b.status,
         case when b.status = 'waitlist'
              then (row_number() over (partition by b.status order by b.created_at))::int end
  from public.bookings b join public.profiles p on p.id = b.user_id
  where b.class_id = p_class and b.status in ('booked','offered','waitlist')
  order by b.created_at;
$$;

-- ============ Row Level Security ============
alter table public.invites enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.classes enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_favorites enable row level security;

-- invites: admin only
create policy invites_admin on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- profiles: own row, or admin
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- memberships: own read, admin write
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy memberships_admin on public.memberships for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- classes: everyone reads, admin writes
create policy classes_read on public.classes for select to authenticated using (true);
create policy classes_admin on public.classes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- bookings: own read, admin all; changes go through the functions above
create policy bookings_read on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy bookings_admin on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- messages: members see those addressed to them
create policy messages_read on public.messages for select to authenticated using (true);
create policy messages_admin on public.messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- recipes
create policy recipes_read on public.recipes for select to authenticated using (true);
create policy recipes_admin on public.recipes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ingredients_read on public.recipe_ingredients for select to authenticated using (true);
create policy ingredients_admin on public.recipe_ingredients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy favorites_own on public.recipe_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Table access for signed-in users (RLS above decides which rows).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Functions: signed-in users only (not anonymous).
revoke execute on all functions in schema public from public, anon;
create or replace function public.my_entries_left() returns int
language sql stable security definer set search_path = public as $$
  select public.entries_left(auth.uid(), now());
$$;
revoke execute on function public.my_entries_left() from public, anon;

grant execute on function public.book_class(uuid), public.confirm_offer(uuid),
  public.cancel_booking(uuid), public.class_roster(uuid), public.my_entries_left(),
  public.admin_book(uuid, uuid, boolean, boolean), public.admin_cancel_booking(uuid, boolean),
  public.is_admin() to authenticated;
