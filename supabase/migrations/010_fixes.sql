-- Move with Tamar: two small fixes.
-- 1) Sets the recipe photos even if the recipes already exist from an earlier run of 008
--    (its "if not exists" check skips the whole insert, including the image, once a recipe is there).
-- 2) SCULPT class reminders now mention that closed shoes aren't needed.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again.

update public.recipes set image_url = 'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/pizza.jpg'
  where title = 'פיצת חלבון' and (image_url is null or image_url <> 'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/pizza.jpg');
update public.recipes set image_url = 'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/choc-balls.jpg'
  where title = 'כדורי שוקולד בריאים (כשרים לפסח)' and (image_url is null or image_url <> 'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/choc-balls.jpg');

create or replace function public.queue_due_notifications() returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, ref_id, title, body, url)
  select b.user_id, 'reminder', c.id, 'תזכורת לאימון',
         public.kind_label(c.kind) || ' מתחיל ב־' || to_char(c.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI')
           || case when c.kind = 'sculpt' then ' (אין צורך בנעליים סגורות)' else '' end,
         '/schedule/' || c.id
  from public.bookings b
  join public.classes c on c.id = b.class_id
  where b.status = 'booked' and c.status = 'scheduled' and c.starts_at > now()
    and now() >= c.starts_at - make_interval(mins => c.reminder_minutes_before)
  on conflict do nothing;
$$;
