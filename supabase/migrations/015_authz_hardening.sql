-- Move with Tamar: explicit auth.uid() checks for defense-in-depth (found by authz-reviewer audit).
-- Not exploitable today (is_admin() and the user_id filters already make a null auth.uid() a safe
-- no-op), but these four functions were the only ones not matching book_class's explicit check —
-- this keeps the pattern consistent so a future refactor can't accidentally drop the protection.
-- Run once in Supabase Dashboard > SQL Editor.

create or replace function public.confirm_offer(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; c public.classes; left_ int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into b from public.bookings where id = p_booking and user_id = auth.uid() for update;
  if b.id is null or b.status <> 'offered' or b.offer_expires_at < now() then raise exception 'offer_expired'; end if;
  select * into c from public.classes where id = b.class_id;
  left_ := public.entries_left(auth.uid(), c.starts_at);
  if left_ is not null and left_ <= 0 then raise exception 'no_entries_left'; end if;
  update public.bookings set status = 'booked', offer_expires_at = null, charged = (left_ is not null) where id = b.id;
end $$;

create or replace function public.cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; c public.classes;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into b from public.bookings where id = p_booking and user_id = auth.uid() for update;
  if b.id is null or b.status = 'cancelled' then raise exception 'booking_not_found'; end if;
  select * into c from public.classes where id = b.class_id;
  if b.status = 'booked' and now() > c.starts_at - make_interval(hours => c.cancel_hours_before)
    then raise exception 'cancellation_closed'; end if;
  update public.bookings set status = 'cancelled', charged = false,
    cancelled_at = now(), cancelled_by = auth.uid() where id = b.id;
  perform public.promote_waitlist(b.class_id);
end $$;

create or replace function public.admin_book(p_class uuid, p_user uuid, p_charge boolean, p_add_entry boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare c public.classes;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
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
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into b from public.bookings where id = p_booking for update;
  update public.bookings set status = 'cancelled', charged = case when p_refund then false else charged end,
    cancelled_at = now(), cancelled_by = auth.uid() where id = p_booking;
  perform public.promote_waitlist(b.class_id);
end $$;
