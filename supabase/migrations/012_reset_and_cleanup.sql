-- Move with Tamar: one-time reset (messages + classes) + automatic weekly message cleanup.
-- ⚠️ Run once in Supabase Dashboard > SQL Editor, NOW, while the data is still demo/test only.
-- The first two lines are a real, irreversible delete — do NOT run this file again once there are
-- real messages or real classes in the app, or they'll be deleted too.

-- ============ One-time reset, right now ============
delete from public.messages;
delete from public.classes; -- cascades to bookings (and the calendar-feed tables, if ever used again)

-- ============ From now on: a message disappears automatically a week after it was sent ============
-- (A rolling 7-day window rather than "everyone vanishes at once every Sunday" — same end result,
-- nothing ever lingers more than a week, without needing extra day-of-week bookkeeping.)
create or replace function public.cleanup_old_messages() returns void
language sql security definer set search_path = public as $$
  delete from public.messages where created_at < now() - interval '7 days';
$$;

-- Hook it into the existing per-minute cron sender (no worker changes needed).
create or replace function public.claim_notifications(p_secret text, p_limit int default 30)
returns table (sub_endpoint text, sub_p256dh text, sub_auth text, n_title text, n_body text, n_url text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.check_cron_secret(p_secret) then raise exception 'forbidden'; end if;
  perform public.queue_due_notifications();
  perform public.queue_payment_reminder();
  perform public.cleanup_old_messages();
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

revoke execute on function public.cleanup_old_messages() from public, anon, authenticated;
