-- Move with Tamar: members can set their own phone + profile photo, and Tamar can start a new
-- member off with a plan already active at invite time (so she can book a class the moment she joins).
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again.

-- ============ Profile photos ============
-- Public folder for avatars (anyone with the link can view; each member can only write her OWN file).
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatars_write_own on storage.objects;
create policy avatars_write_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
-- (profiles.phone and profiles.avatar_url were already writable by their own owner via profiles_update_own — no change needed there.)

-- ============ Start a new member with a plan already active ============
alter table public.invites add column if not exists plan public.plan_type;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invites; eom date;
begin
  select * into inv from public.invites where lower(email) = lower(new.email);
  if inv.email is null then
    raise exception 'not_invited';
  end if;
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (new.id, new.email, inv.first_name, inv.last_name, inv.phone);
  if inv.plan is not null then
    eom := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
    insert into public.memberships (user_id, plan, starts_on, ends_on, status)
    values (new.id, inv.plan, current_date, eom, 'active');
  end if;
  return new;
end $$;
