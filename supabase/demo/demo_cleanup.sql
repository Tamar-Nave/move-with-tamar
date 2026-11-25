-- Removes ALL demo data created by demo_seed.sql (members, classes, bookings, message).
delete from public.classes where notes = '[demo]';
delete from public.messages where title like '[דמו]%';
delete from public.recipes where title like '%(דוגמה)';
delete from auth.users where email like '%@demo.movewithtamar.test';
delete from public.invites where email like '%@demo.movewithtamar.test';

select 'demo removed' as status,
       (select count(*) from public.profiles where email like '%@demo.movewithtamar.test') as demo_members_left,
       (select count(*) from public.classes where notes = '[demo]') as demo_classes_left;
