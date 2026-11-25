-- Move with Tamar: automatic retention for admin_audit_log — a row disappears 90 days after it was
-- written, same rolling-window approach as cleanup_old_messages (012_reset_and_cleanup.sql).
-- Run once in Supabase Dashboard > SQL Editor.

create or replace function public.cleanup_old_audit_log() returns void
language sql security definer set search_path = public as $$
  delete from public.admin_audit_log where created_at < now() - interval '90 days';
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
  perform public.cleanup_old_audit_log();
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

revoke execute on function public.cleanup_old_audit_log() from public, anon, authenticated;
