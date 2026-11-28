-- Move with Tamar: structured recipe ingredients (name / quantity / unit / nutrition), real substitutes with
-- conversion ratios, and a personal food database that grows as the admin enters values by hand.
-- Backwards compatible: recipe_ingredients.text and .substitutes stay and keep being filled, so old app versions
-- and existing recipes (with no structured data yet) keep working exactly as before.
-- Run once in Supabase Dashboard > SQL Editor, BEFORE deploying the new app. Safe to run again.

-- ============ recipe_ingredients: structured fields ============
alter table public.recipe_ingredients
  add column if not exists name text,
  add column if not exists quantity numeric check (quantity is null or quantity >= 0),
  add column if not exists unit text,
  add column if not exists kcal numeric,
  add column if not exists protein numeric,
  add column if not exists carbs numeric,
  add column if not exists fat numeric,
  add column if not exists nutrition_source text not null default 'auto',
  add column if not exists dismissed_subs text[] not null default '{}';

alter table public.recipe_ingredients drop constraint if exists recipe_ingredients_nutrition_source_check;
alter table public.recipe_ingredients add constraint recipe_ingredients_nutrition_source_check
  check (nutrition_source in ('auto', 'manual', 'off'));
-- 'auto'   = calculated from the built-in / personal food database (values here are a snapshot for the saved quantity)
-- 'manual' = typed by hand: never overwritten by the automatic calculation
-- 'off'    = taken from Open Food Facts

-- Per-serving values the admin typed by hand on the recipe ("ערך ידני"), e.g. {"kcal": 310}.
alter table public.recipes add column if not exists nutrition_override jsonb not null default '{}';

-- ============ Substitutes with a conversion ratio ============
create table if not exists public.ingredient_substitutes (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.recipe_ingredients(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  quantity numeric check (quantity is null or quantity >= 0),  -- snapshot: ingredient quantity x ratio
  unit text,                                                    -- only when it differs from the ingredient's unit
  ratio numeric not null default 1 check (ratio > 0),
  position int not null default 0,
  is_manual boolean not null default false                      -- hand-made (kept when suggestions are regenerated)
);
create index if not exists ingredient_substitutes_ingredient_idx on public.ingredient_substitutes (ingredient_id, position);

alter table public.ingredient_substitutes enable row level security;
drop policy if exists substitutes_read on public.ingredient_substitutes;
create policy substitutes_read on public.ingredient_substitutes for select to authenticated using (true);
drop policy if exists substitutes_admin on public.ingredient_substitutes;
create policy substitutes_admin on public.ingredient_substitutes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.ingredient_substitutes to authenticated;

-- Move the existing text[] substitutes over (once). They have no quantity, so they show as names only.
insert into public.ingredient_substitutes (ingredient_id, name, ratio, position, is_manual)
select i.id, btrim(s.name), 1, s.ord::int - 1, true
from public.recipe_ingredients i
cross join lateral unnest(i.substitutes) with ordinality as s(name, ord)
where btrim(s.name) <> ''
  and not exists (select 1 from public.ingredient_substitutes x where x.ingredient_id = i.id);

-- ============ Personal food database (admin only) ============
-- Values per 100 g, filled from hand-entered ingredient values when the weight of the unit is known,
-- and used automatically for the same ingredient name in later recipes.
create table if not exists public.saved_foods (
  name_key text primary key,
  name text not null,
  kcal numeric not null, protein numeric not null, carbs numeric not null, fat numeric not null,
  updated_at timestamptz not null default now()
);
alter table public.saved_foods enable row level security;
drop policy if exists saved_foods_admin on public.saved_foods;
create policy saved_foods_admin on public.saved_foods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.saved_foods to authenticated;
