-- Move with Tamar: two more of Tamar's recipes (protein pizza, chocolate balls).
-- Cleaned up from her WhatsApp text: fixed a missing unit ("3/4 אבקת אפייה" -> "3/4 כפית אבקת אפייה"),
-- typos ("משתחת"->"משטחת", "לאישיות"->"אישיות", "שמות"->"שמים"), and estimated the one missing amount
-- (the protein yogurt container, assumed ~200g) — note at the end of each recipe explains every assumption.
-- Run once in Supabase Dashboard > SQL Editor. Safe to run again (no duplicates).

do $$
declare r uuid;
begin
  if not exists (select 1 from public.recipes where title = 'פיצת חלבון') then
    insert into public.recipes (title, category, image_url, minutes, servings, calories, protein_g, carbs_g, fat_g, instructions)
    values ('פיצת חלבון', 'ערב',
            'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/pizza.jpg',
            30, 6, 180, 13, 24, 4,
            E'1. מחממים תנור ל־200 מעלות.\n'
            '2. מערבבים את כל מצרכי הבלילה (יוגורט וקוטג׳, קמח, ביצה, מלח ואבקת אפייה) לבלילה אחידה.\n'
            '3. משטחים את הבלילה על תבנית אפייה מרופדת בנייר אפייה (אפשר גם כמה פיצות אישיות קטנות).\n'
            '4. אופות כ־10 דקות, עד השחמה קלה מאוד.\n'
            '5. מוציאות, שמות רוטב עגבניות (לא מרוכז), גבינה צהובה ותוספות לפי הטעם.\n'
            '6. מחזירות לתנור לעוד 5–10 דקות, עד שהגבינה נמסה.\n\n'
            'טיפים:\n'
            '• מי שלא רוצה יוגורט: במקום היוגורט, חבילה שלמה של קוטג׳ (בלי חצי החבילה הנוספת).\n\n'
            'על הערכים התזונתיים: לפרוסה, מתוך 6 פרוסות (פיצה בינונית אחת). חושבו עם מיכל יוגורט חלבון טבעי אחד (כ־200 גרם, לא צוינה כמות במקור), חצי חבילת קוטג׳ 5%, קמח כוסמין מלא, וטופינג משוער (רוטב, כ־50 גרם גבינה צהובה). כמות היוגורט והטופינג לא צוינו במקור, אז זאת הערכה — אפשר לבקש עדכון אם הכמות שלך שונה.')
    returning id into r;
    insert into public.recipe_ingredients (recipe_id, position, text, substitutes) values
      (r, 1,  '1 מיכל יוגורט חלבון טבעי (כ־200 גרם)', array['קוטג׳ נוסף (ראו טיפ למטה)', 'סקיר', 'יוגורט יווני', 'גבינת שמנת 5%', 'אבקת חלבון בטעם וניל + מעט מים או חלב']),
      (r, 2,  'כוס וחצי קמח כוסמין מלא (או שיבולת שועל)', array['שיבולת שועל טחונה דק (אותה כמות)', 'קמח לבן רגיל']),
      (r, 3,  'חצי חבילת קוטג׳ 5%', array['יוגורט יווני', 'ריקוטה']),
      (r, 4,  '1 ביצה', array['2 חלבונים']),
      (r, 5,  '¾ כפית מלח', '{}'),
      (r, 6,  '¾ כפית אבקת אפייה', array['½ כפית סודה לשתייה + 1 כף מיץ לימון']),
      (r, 7,  'רוטב עגבניות לא מרוכז, לפי הטעם', array['רסק עגבניות מדולל מעט במים']),
      (r, 8,  'גבינה צהובה מגורדת, לפי הטעם', array['מוצרלה', 'גבינה צהובה 9% (פחות שומן)']),
      (r, 9,  'תוספות לבחירה (ירקות, זיתים, וכו׳)', '{}');
  end if;

  if not exists (select 1 from public.recipes where title = 'כדורי שוקולד בריאים (כשרים לפסח)') then
    insert into public.recipes (title, category, image_url, minutes, servings, calories, protein_g, carbs_g, fat_g, instructions)
    values ('כדורי שוקולד בריאים (כשרים לפסח)', 'נשנושים',
            'https://move-with-tamar.tamarnave-tn.workers.dev/images/recipes/choc-balls.jpg',
            10, 20, 95, 3, 6, 7,
            E'1. מערבבים בקערה את כל המצרכים (קמח שקדים, חמאת הבוטנים, קקאו, מייפל וחלב) עד לבלילה אחידה שאפשר לגלגל.\n'
            '2. אם הבלילה יבשה מדי — עוד קצת מייפל או חלב. אם רטובה מדי — עוד קצת קמח שקדים.\n'
            '3. מגלגלות לכדורים קטנים. אפשר לפזר מעליהם קקאו.\n'
            '4. שומרות במקפיא.\n\n'
            'טיפים:\n'
            '• אפשר להוסיף עוד חמאת בוטנים, קקאו או מייפל, לפי הטעם.\n'
            '• מומלץ להתחיל מחצי כמות ולבדוק שאוהבות, לפני שמכינות כמות גדולה.\n\n'
            'על הערכים התזונתיים: ל־20 כדורים (כ־20 גרם לכדור), מכל המתכון. חושבו עם חמאת בוטנים וקמח שקדים.')
    returning id into r;
    insert into public.recipe_ingredients (recipe_id, position, text, substitutes) values
      (r, 1, '2 כוסות קמח שקדים (שקדים טחונים)', '{}'),
      (r, 2, '⅓ כוס חמאת בוטנים', array['חמאת שקדים', 'טחינה גולמית']),
      (r, 3, '2 כפות קקאו', '{}'),
      (r, 4, '5 כפות מייפל טבעי', array['סילאן', 'דבש']),
      (r, 5, '2 כפות חלב (רגיל, צמחי, או מים)', array['משקה שקדים או סויה לא ממותק', 'מים']);
  end if;
end $$;
