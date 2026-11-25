-- Move with Tamar: recipe images storage + Tamar's first two recipes
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again (no duplicates).

-- Public folder for recipe photos (anyone with the link can view; only Tamar can upload/change).
insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', true)
  on conflict (id) do nothing;

drop policy if exists recipe_images_read on storage.objects;
create policy recipe_images_read on storage.objects for select using (bucket_id = 'recipe-images');
drop policy if exists recipe_images_insert on storage.objects;
create policy recipe_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-images' and public.is_admin());
drop policy if exists recipe_images_update on storage.objects;
create policy recipe_images_update on storage.objects for update to authenticated
  using (bucket_id = 'recipe-images' and public.is_admin());
drop policy if exists recipe_images_delete on storage.objects;
create policy recipe_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-images' and public.is_admin());

-- Nutrition = estimate per slice, from general nutrition tables (see the note at the end of each recipe).
do $$
declare r uuid;
begin
  if not exists (select 1 from public.recipes where title = 'פשטידת גבינות וחלבון') then
    insert into public.recipes (title, category, image_url, minutes, servings, calories, protein_g, carbs_g, fat_g, instructions)
    values ('פשטידת גבינות וחלבון', 'ערב',
            'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/cheese-pie.jpg',
            55, 16, 215, 11, 13, 14,
            E'1. מחממים תנור ל־180 מעלות.\n'
            '2. מטגנים את הבצל. בינתיים מערבבים את כל הרטובים, ומוסיפים את כל היבשים.\n'
            '3. מוסיפים את הבצל לבלילה (או כל תוספת אחרת).\n'
            '4. מחלקים לשתי תבניות אינגליש קייק ואופים כ־40 דקות.\n\n'
            'טיפים:\n'
            '• אפשר לשים רק קמח כוסמין, בלי קמח שקדים.\n'
            '• אפשר לשחק עם הכמויות והסוגים של הגבינות.\n\n'
            'על הערכים התזונתיים: לפרוסה, מתוך 16 פרוסות (8 בכל תבנית). חושבו עם גבינה לבנה וקוטג׳ 5%, חלב 3%, גבינה צהובה 28% ובצל. לא כוללים את הגבינה הבולגרית ואת השמן לטיגון הבצל.')
    returning id into r;
    insert into public.recipe_ingredients (recipe_id, position, text, substitutes) values
      (r, 1,  '1.5 כוסות קמח כוסמין מלא', '{}'),
      (r, 2,  '1.5 כוסות קמח שקדים', array['1.5 כוסות קמח כוסמין מלא (אפשר רק כוסמין)']),
      (r, 3,  '1 שקית אבקת אפייה', '{}'),
      (r, 4,  '½–1 כפית מלח', '{}'),
      (r, 5,  '4 ביצים', '{}'),
      (r, 6,  '1 כוס חלב', '{}'),
      (r, 7,  '⅓ כוס שמן זית', '{}'),
      (r, 8,  '1 קוטג׳', '{}'),
      (r, 9,  '1 גבינה לבנה', array['קוטג׳ נוסף']),
      (r, 10, '1 כוס גבינה צהובה', '{}'),
      (r, 11, '½ כוס גבינה בולגרית (לא חובה)', '{}'),
      (r, 12, '2 בצלים', array['זיתים', 'תירס', 'ברוקולי', 'כל תוספת אחרת']);
  end if;

  if not exists (select 1 from public.recipes where title = 'עוגת בננות') then
    insert into public.recipes (title, category, image_url, minutes, servings, calories, protein_g, carbs_g, fat_g, instructions)
    values ('עוגת בננות', 'קינוחים',
            'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/banana-cake.jpg',
            40, 10, 254, 6, 34, 12,
            E'1. מחממים תנור ל־170–180 מעלות.\n'
            '2. מערבבים את כל המצרכים טוב טוב.\n'
            '3. יוצקים את כל הבלילה לתבנית אינגליש קייק.\n'
            '4. אופים כ־30 דקות.\n\n'
            'על הערכים התזונתיים: לפרוסה, מתוך 10 פרוסות. חושבו עם ½ כוס דבש ו־50 גרם שוקולד מריר 70%. עם ¾ כוס דבש, כל פרוסה גבוהה בכ־25 קלוריות.')
    returning id into r;
    insert into public.recipe_ingredients (recipe_id, position, text, substitutes) values
      (r, 1,  '3 בננות בשלות, מעוכות היטב', '{}'),
      (r, 2,  '3 ביצים', '{}'),
      (r, 3,  '¼ כוס שמן זית', array['שמן קוקוס']),
      (r, 4,  '½–¾ כוס דבש', array['סילאן', 'מייפל טבעי', 'שילוב ביניהם']),
      (r, 5,  '1 כפית תמצית וניל', '{}'),
      (r, 6,  '1 כוס קמח כוסמין', '{}'),
      (r, 7,  '½ כוס קמח שקדים', '{}'),
      (r, 8,  '1 כפית שטוחה קינמון', '{}'),
      (r, 9,  '1 שקית אבקת אפייה', '{}'),
      (r, 10, 'חצי חבילת שוקולד מריר', '{}');
  end if;
end $$;
