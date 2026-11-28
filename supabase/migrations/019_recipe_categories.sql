-- Move with Tamar: a recipe can belong to several categories (e.g. both "ארוחת בוקר" and "אחרי אימון").
-- recipes.category stays (it holds the first category, so old app versions keep working); the full list is in `categories`.
-- Run once in Supabase Dashboard > SQL Editor, BEFORE deploying the app version that uses it. Safe to run again.

alter table public.recipes add column if not exists categories text[] not null default '{}';

update public.recipes set categories = array[category]
  where cardinality(categories) = 0 and category is not null and btrim(category) <> '';
