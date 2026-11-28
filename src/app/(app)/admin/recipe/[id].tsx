import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/field';
import { ImagePicker } from '@/components/image-picker';
import { LinkBtn, NumField } from '@/components/recipe-parts';
import { RecipeDisclaimer } from '@/components/recipe-disclaimer';
import { BackLink, Btn, Card, Chip, C, ErrorText, Label, Loading, Muted, Screen, Title } from '@/components/ui';
import {
  diffNumbers, findFood, fmtNum, mentionedFoods, gramsOf, ingredientNutrition, lookupOpenFoodFacts, normalizedFoodKey, parseIngredient, parseRecipeText, per100From,
  polishInstructions, qtyLabel, recipeTotals, refreshSubs, subQty, suggestSubs, uid, UNITS, type Ing, type Nut, type NutSource, type SavedFoods,
} from '@/lib/recipe-engine';
import {
  RECIPE_CATEGORIES, RECIPE_SELECT, fetchSavedFoods, recipeCategories, ingFromRow, ingToRow, servingColumns, subToRow, uploadRecipeImage, type Recipe,
} from '@/lib/recipes';
import { supabase } from '@/lib/supabase';
import { GLASS } from '@/lib/theme';

const NUT_KEYS: [keyof Nut, string][] = [['kcal', 'קלוריות'], ['protein', 'חלבון (ג׳)'], ['carbs', 'פחמימות (ג׳)'], ['fat', 'שומן (ג׳)']];
const SOURCE_LABEL: Record<NutSource, string> = {
  db: 'הערכה אוטומטית', saved: 'הערכה אוטומטית (מהמאגר האישי)', off: 'הערכה מ-Open Food Facts', manual: 'ערך ידני',
  unknown: 'לא נמצא במאגר. אפשר להזין ידנית', noqty: 'חסרה כמות',
};

type Draft = {
  title: string; categories: string[]; imageUrl: string | null; minutes: number | null; servings: number | null;
  instructions: string; override: Partial<Nut>; ingredients: Ing[];
};

const blankIng = (): Ing => ({ id: uid('i'), name: '', qty: null, unit: 'כוס', subs: [], dismissed: [] });
const round1 = (n: number) => Math.round(n * 10) / 10;
const OVERRIDE_KEYS: (keyof Nut)[] = ['kcal', 'protein', 'carbs', 'fat'];

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const [loaded, setLoaded] = useState(isNew);
  const [draft, setDraft] = useState<Draft>({ title: '', categories: [RECIPE_CATEGORIES[0]], imageUrl: null, minutes: null, servings: null, instructions: '', override: {}, ingredients: [blankIng()] });
  const [saved, setSaved] = useState<SavedFoods>({});                         // personal food database (saved_foods)
  const [pending, setPending] = useState<Record<string, { name: string; nut: Nut }>>({}); // learned in this session, saved with the recipe
  const [quick, setQuick] = useState('');
  const [quickRes, setQuickRes] = useState<{ filled: string[]; notes: string[] } | null>(null);
  const [polishBase, setPolishBase] = useState<string | null>(null);
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const [openNut, setOpenNut] = useState<Set<string>>(new Set());
  const [offBusy, setOffBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentionNote, setMentionNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedFoods = await fetchSavedFoods();
      if (cancelled) return;
      setSaved(savedFoods);
      if (isNew) return;
      const { data } = await supabase.from('recipes').select(RECIPE_SELECT).eq('id', id).single();
      if (cancelled) return;
      const r = data as Recipe | null;
      if (r) {
        const rows = [...(r.recipe_ingredients ?? [])].sort((a, b) => a.position - b.position);
        const override: Partial<Nut> = { ...(r.nutrition_override ?? {}) };
        // A recipe from before the upgrade has hand-typed per-serving values and no structured ingredients yet:
        // keep those values as "ערך ידני" so saving never replaces them with a partial calculation.
        if (rows.every((x) => !x.name) && Object.keys(override).length === 0) {
          if (r.calories != null) override.kcal = r.calories;
          if (r.protein_g != null) override.protein = r.protein_g;
          if (r.carbs_g != null) override.carbs = r.carbs_g;
          if (r.fat_g != null) override.fat = r.fat_g;
        }
        setDraft({
          title: r.title, categories: recipeCategories(r), imageUrl: r.image_url, minutes: r.minutes, servings: r.servings,
          instructions: r.instructions ?? '', override, ingredients: rows.length ? rows.map(ingFromRow) : [blankIng()],
        });
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [id, isNew]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/recipes' as never));
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const patchIng = (iid: string, fn: (i: Ing) => Ing) => setDraft((d) => ({ ...d, ingredients: d.ingredients.map((i) => (i.id === iid ? fn(i) : i)) }));
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); setter(n); };

  // Everything the maths knows: the saved database plus what was learned in this session.
  const known = useMemo<SavedFoods>(() => ({ ...saved, ...Object.fromEntries(Object.entries(pending).map(([k, v]) => [k, v.nut])) }), [saved, pending]);

  // Live maths: any change to a quantity, unit, servings, an ingredient or a hand-edited value re-renders these.
  const totals = useMemo(() => recipeTotals(draft.ingredients, draft.servings, known), [draft.ingredients, draft.servings, known]);
  const perServing = totals.perServing;
  const excluded = useMemo(
    () => draft.ingredients.filter((i) => i.name.trim() && ['unknown', 'noqty'].includes(ingredientNutrition(i, known).source)).length,
    [draft.ingredients, known],
  );

  async function pickImage(file: File) {
    setUploading(true);
    setError(null);
    try { patch({ imageUrl: await uploadRecipeImage(file) }); } catch { setError('לא הצלחנו להעלות את התמונה. נסי תמונה אחרת.'); }
    setUploading(false);
  }

  // ── ingredient edits (each one touches only that ingredient) ──
  const rename = (i: Ing, name: string) => patchIng(i.id, (x) => {
    const y: Ing = { ...x, name, offPer100: undefined, manualNut: x.fromOff ? undefined : x.manualNut, fromOff: x.fromOff ? undefined : x.fromOff };
    return { ...y, subs: refreshSubs(y) };
  });
  /** "3/4 כפית אבקת אפיה" typed or pasted in the name field -> quantity 0.75, unit כפית, name "אבקת אפיה" (only when no quantity is set yet). */
  const splitLine = (i: Ing): Ing => {
    if (i.qty != null || !i.name.trim()) return i;
    const p = parseIngredient(i.name);
    if (p.qty == null || !p.name) return i;
    const y: Ing = { ...i, name: p.name, qty: p.qty, unit: p.unit || i.unit, offPer100: undefined };
    return { ...y, subs: refreshSubs(y) };
  };
  const changeQty = (i: Ing, qty: number | null) => patchIng(i.id, (x) => ({ ...x, qty }));
  const changeUnit = (i: Ing, unit: string) => patchIng(i.id, (x) => ({ ...x, unit }));

  function setManualNut(i: Ing, key: keyof Nut, value: number | null) {
    const cur = ingredientNutrition(i, known).nut;
    const next: Nut = { ...cur, [key]: value ?? 0 };
    patchIng(i.id, (x) => ({ ...x, manualNut: { ...next, qty: i.qty ?? 1 }, fromOff: undefined }));
    if (i.qty && i.name.trim()) {
      const p100 = per100From(i.name, i.qty, i.unit, next);
      if (p100) setPending((p) => ({ ...p, [normalizedFoodKey(i.name)]: { name: i.name.trim(), nut: p100 } }));
    }
  }

  async function fillFromOff(i: Ing) {
    if (!i.qty || !i.name.trim()) return;
    if (gramsOf(findFood(i.name), i.qty, i.unit) == null) { setNotes((n) => ({ ...n, [i.id]: 'ליחידה כזו אין משקל ידוע. בחרי גרם/כוס/כף או הזיני ערכים ידנית.' })); return; }
    setOffBusy(i.id);
    const res = await lookupOpenFoodFacts(i.name);
    setOffBusy(null);
    if (!res) { setNotes((n) => ({ ...n, [i.id]: 'לא נמצא ב-Open Food Facts (או שאין חיבור לאינטרנט). אפשר להזין ידנית.' })); return; }
    patchIng(i.id, (x) => ({ ...x, offPer100: res }));
    setNotes((n) => ({ ...n, [i.id]: 'נמצא ב-Open Food Facts (ערך ל-100 גרם, עשוי להיות לא מדויק).' }));
  }

  // ── substitutes ──
  const editSubQty = (i: Ing, sid: string, q: number | null) => {
    if (!i.qty || q == null) return;
    patchIng(i.id, (x) => ({ ...x, subs: x.subs.map((s) => (s.id === sid ? { ...s, ratio: q / i.qty!, manual: true } : s)) }));
  };
  const editSubName = (i: Ing, sid: string, name: string) => patchIng(i.id, (x) => ({ ...x, subs: x.subs.map((s) => (s.id === sid ? { ...s, name, manual: true } : s)) }));
  const delSub = (i: Ing, sid: string) => patchIng(i.id, (x) => {
    const gone = x.subs.find((s) => s.id === sid);
    return { ...x, subs: x.subs.filter((s) => s.id !== sid), dismissed: gone && !gone.manual ? [...x.dismissed, gone.name] : x.dismissed };
  });
  const addSub = (i: Ing) => {
    patchIng(i.id, (x) => ({ ...x, subs: [...x.subs, { id: uid('s'), name: '', ratio: 1, manual: true }] }));
    setOpenSubs((o) => new Set(o).add(i.id));
  };
  /** "חישוב והצעת חלופות": regenerates the automatic suggestions for every ingredient; hand edits are preserved. */
  const suggestAll = () => setDraft((d) => ({ ...d, ingredients: d.ingredients.map((i0) => { const i = splitLine(i0); return { ...i, subs: refreshSubs(i) }; }) }));

  // ── quick fill ──
  function applyQuick() {
    const p = parseRecipeText(quick);
    const filled: string[] = [];
    const next: Partial<Draft> = {};
    if (p.title) { next.title = p.title; filled.push(`שם: ${p.title}`); }
    if (p.servings) { next.servings = p.servings; filled.push(`${p.servings} מנות`); }
    if (p.minutes) { next.minutes = p.minutes; filled.push(`${p.minutes} דקות הכנה`); }
    if (p.ingredients.length) {
      next.ingredients = p.ingredients.map((x) => {
        const ing: Ing = { id: uid('i'), name: x.name, qty: x.qty, unit: x.unit || (x.qty != null ? 'יחידה' : 'כוס'), subs: [], dismissed: [] };
        return { ...ing, subs: suggestSubs(ing.name, []) };
      });
      filled.push(`${p.ingredients.length} מצרכים`);
    }
    if (p.instructions) {
      next.instructions = polishInstructions(p.instructions);
      setPolishBase(p.instructions);
      filled.push('אופן הכנה (מסודר לשלבים)');
    }
    const finalIngs = (next.ingredients ?? draft.ingredients).filter((i) => i.name.trim());
    const extra = p.instructions ? missingMentioned(finalIngs, p.instructions) : [];
    if (extra.length) {
      next.ingredients = [...finalIngs, ...extra.map((m) => ({ id: uid('i'), name: m.name, qty: null, unit: 'כוס', subs: suggestSubs(m.name, []), dismissed: [] }) as Ing)];
      filled.push(`${extra.length} מצרכים שהוזכרו בהכנה (בלי כמות): ${extra.map((m) => m.name).join(', ')}`);
    }
    next.override = {};
    patch(next);
    setQuickRes({ filled, notes: p.notes });
  }

  // ── ingredients named in the preparation text but missing from the list ──
  const missingMentioned = (ings: Ing[], text: string) => {
    const have = new Set(ings.map((i) => findFood(i.name)?.key).filter(Boolean));
    return mentionedFoods(text).filter((m) => !have.has(m.key));
  };
  const addMentioned = () => {
    const add = missingMentioned(draft.ingredients.filter((i) => i.name.trim()), draft.instructions);
    if (!add.length) { setMentionNote('לא מצאתי מצרכים שחסרים ברשימה.'); return; }
    setDraft((d) => ({
      ...d,
      ingredients: [...d.ingredients.filter((i) => i.name.trim()), ...add.map((m) => ({ id: uid('i'), name: m.name, qty: null, unit: 'כוס', subs: suggestSubs(m.name, []), dismissed: [] }) as Ing)],
    }));
    setMentionNote(`הוספתי לרשימה: ${add.map((m) => m.name).join(', ')}. חסרה להם כמות, כדאי להשלים.`);
  };

  // ── polish ──
  const polish = () => {
    if (!draft.instructions.trim()) return;
    setPolishBase(polishBase ?? draft.instructions);
    patch({ instructions: polishInstructions(draft.instructions) });
  };
  const numberDiff = polishBase != null ? diffNumbers(polishBase, draft.instructions) : null;
  const numbersChanged = !!numberDiff && (numberDiff.missing.length > 0 || numberDiff.added.length > 0);

  // ── save / delete ──
  async function save() {
    if (!draft.title.trim()) { setError('חסר שם למתכון.'); return; }
    setBusy(true);
    setError(null);
    const ings = draft.ingredients.map(splitLine).filter((i) => i.name.trim());
    const override: Partial<Nut> = {};
    for (const k of OVERRIDE_KEYS) if (draft.override[k] != null) override[k] = draft.override[k];
    const fields = {
      title: draft.title.trim(), categories: draft.categories, category: draft.categories[0], image_url: draft.imageUrl, minutes: draft.minutes, servings: draft.servings,
      ...servingColumns(ings, draft.servings, override, known),
      instructions: draft.instructions.trim() || null, nutrition_override: override,
    };
    let recipeId = id;
    if (isNew) {
      const { data, error: err } = await supabase.from('recipes').insert(fields).select('id').single();
      if (err || !data) { setBusy(false); setError('לא הצלחנו לשמור. נסי שוב.'); return; }
      recipeId = (data as { id: string }).id;
    } else {
      const { error: err } = await supabase.from('recipes').update(fields).eq('id', id);
      if (err) { setBusy(false); setError('לא הצלחנו לשמור. נסי שוב.'); return; }
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', id); // its substitutes go with it
    }
    if (ings.length) {
      const { data: inserted, error: err } = await supabase.from('recipe_ingredients')
        .insert(ings.map((i, n) => ingToRow(recipeId, i, n + 1, known))).select('id, position');
      if (err || !inserted) { setBusy(false); setError('המתכון נשמר, אבל המצרכים לא נשמרו. נסי לשמור שוב.'); return; }
      const idByPosition = new Map((inserted as { id: string; position: number }[]).map((r) => [r.position, r.id]));
      const subRows = ings.flatMap((i, n) => i.subs.filter((s) => s.name.trim()).map((s, k) => subToRow(idByPosition.get(n + 1)!, i, s, k)));
      if (subRows.length) {
        const { error: subErr } = await supabase.from('ingredient_substitutes').insert(subRows);
        if (subErr) { setBusy(false); setError('המתכון והמצרכים נשמרו, אבל החלופות לא נשמרו. נסי לשמור שוב.'); return; }
      }
    }
    const learned = Object.entries(pending);
    if (learned.length) {
      await supabase.from('saved_foods').upsert(learned.map(([name_key, v]) => ({
        name_key, name: v.name, kcal: round1(v.nut.kcal), protein: round1(v.nut.protein), carbs: round1(v.nut.carbs), fat: round1(v.nut.fat), updated_at: new Date().toISOString(),
      })));
    }
    setBusy(false);
    back();
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    await supabase.from('recipes').delete().eq('id', id);
    setBusy(false);
    back();
  }

  const overrideKeys = OVERRIDE_KEYS.filter((k) => draft.override[k] != null);
  const shownValue = (k: keyof Nut): number | null => draft.override[k] ?? (perServing ? (k === 'kcal' ? Math.round(perServing[k]) : round1(perServing[k])) : null);

  if (!loaded) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <BackLink label="חזרה למתכונים" onPress={back} />
      <Title>{isNew ? 'מתכון חדש' : 'עריכת מתכון'}</Title>

      <Card style={{ gap: 8 }}>
        <Label>מילוי מהיר של מתכון</Label>
        <Muted>כתבי או הקליטי (במיקרופון של המקלדת) את המתכון. אפשר: שם, "מספיק ל־8 מנות", "מצרכים: ...", "אופן הכנה: ...". הפענוח מקומי וחינם. הוא ממלא את הטופס ואינו שומר.</Muted>
        <TextInput value={quick} onChangeText={setQuick} accessibilityLabel="מילוי מהיר של מתכון" multiline placeholderTextColor="#8C7C72" placeholder="עוגת שוקולד. מספיק לעשר מנות. מצרכים: ..."
          style={{ ...GLASS.input, minHeight: 110, padding: 14, fontSize: 15.5, color: C.text, textAlign: 'right', textAlignVertical: 'top' }} />
        <Btn label="מילוי הטופס" variant="secondary" disabled={!quick.trim()} onPress={applyQuick} />
        {quickRes && (
          <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
            {quickRes.filled.length > 0 && <Text style={{ fontSize: 14, color: C.success, textAlign: 'right' }}>מילאתי: {quickRes.filled.join(' · ')}</Text>}
            {quickRes.notes.map((n) => <Text key={n} style={{ fontSize: 14, color: C.primaryDark, textAlign: 'right' }}>{n}</Text>)}
            <Muted>עברי על הטופס למטה ותקני לפני השמירה.</Muted>
          </View>
        )}
      </Card>

      <Field label="שם המתכון" value={draft.title} onChangeText={(title) => patch({ title })} />
      <Label>קטגוריות (אפשר לבחור כמה)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {RECIPE_CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={draft.categories.includes(c)}
            onPress={() => patch({ categories: draft.categories.includes(c) ? draft.categories.filter((x) => x !== c) : [...draft.categories, c] })} />
        ))}
      </View>
      {draft.categories.length === 0 && <Muted>צריך לבחור לפחות קטגוריה אחת.</Muted>}

      <Label>תמונה</Label>
      <ImagePicker imageUrl={draft.imageUrl} busy={uploading} onPick={pickImage} onRemove={() => patch({ imageUrl: null })} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <NumField label="זמן הכנה (דקות)" value={draft.minutes} onChange={(minutes) => patch({ minutes: minutes == null ? null : Math.round(minutes) })} />
        <NumField label="מספר מנות" value={draft.servings} onChange={(servings) => patch({ servings: servings == null ? null : Math.round(servings) })} />
      </View>

      {/* ── nutrition per serving ── */}
      <Card style={{ gap: 8 }}>
        <Label>ערכים תזונתיים למנה</Label>
        <Muted>
          {draft.servings ? `מחושב מהמצרכים ÷ ${draft.servings} מנות, ומתעדכן מיד.` : 'הזיני מספר מנות כדי לחשב למנה.'} {overrideKeys.length ? '' : 'הערכה אוטומטית.'}
        </Muted>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <NumField label="קלוריות" value={shownValue('kcal')} onChange={(v) => patch({ override: { ...draft.override, kcal: v ?? undefined } })} />
          <NumField label="חלבון (ג׳)" value={shownValue('protein')} onChange={(v) => patch({ override: { ...draft.override, protein: v ?? undefined } })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <NumField label="פחמימות (ג׳)" value={shownValue('carbs')} onChange={(v) => patch({ override: { ...draft.override, carbs: v ?? undefined } })} />
          <NumField label="שומן (ג׳)" value={shownValue('fat')} onChange={(v) => patch({ override: { ...draft.override, fat: v ?? undefined } })} />
        </View>
        {overrideKeys.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 13, color: C.warning, textAlign: 'right' }}>ערך ידני: {overrideKeys.map((k) => NUT_KEYS.find(([kk]) => kk === k)![1].replace(' (ג׳)', '')).join(', ')} (לא יידרס אוטומטית)</Text>
            <LinkBtn label="חזרה לחישוב אוטומטי" onPress={() => patch({ override: {} })} />
          </View>
        )}
        {excluded > 0 && <Text style={{ fontSize: 13, color: C.warning, textAlign: 'right' }}>{excluded} מצרכים לא נכללו בחישוב (חסרה כמות, או שאינם במאגר). אפשר להזין להם ערכים ידנית.</Text>}
        <Muted>סך הכל למתכון כולו: {Math.round(totals.total.kcal)} קל׳ · {round1(totals.total.protein)} ג׳ חלבון · {round1(totals.total.carbs)} ג׳ פחמימות · {round1(totals.total.fat)} ג׳ שומן.</Muted>
        <RecipeDisclaimer />
      </Card>

      {/* ── ingredients ── */}
      <Label>מצרכים</Label>
      <Muted>כמות, יחידה ושם. שינוי של מצרך אחד מחשב מחדש רק אותו, ולא נוגע בערכים או בחלופות שערכת ידנית במצרכים אחרים.</Muted>
      {draft.ingredients.map((ing, n) => {
        const { nut, source } = ingredientNutrition(ing, known);
        const manualOpen = openNut.has(ing.id);
        return (
          <Card key={ing.id} style={{ gap: 8 }}>
            <Field label={`מצרך ${n + 1}`} value={ing.name} onChangeText={(t) => rename(ing, t)} onBlur={() => patchIng(ing.id, splitLine)} placeholder="למשל: קמח כוסמין, או: 3/4 כפית אבקת אפייה" />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <NumField label="כמות" value={ing.qty} onChange={(q) => changeQty(ing, q)} width={110} />
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {UNITS.map((u) => <Chip key={u} label={u} selected={ing.unit === u} onPress={() => changeUnit(ing, u)} />)}
              </View>
            </View>

            <Text style={{ fontSize: 13, color: source === 'manual' ? C.warning : source === 'unknown' ? C.danger : C.textMuted, textAlign: 'right' }}>
              {source === 'unknown' || source === 'noqty' ? '' : `≈ ${Math.round(nut.kcal)} קל׳ · ${round1(nut.protein)} ג׳ חלבון · ${round1(nut.carbs)} ג׳ פחמימות · ${round1(nut.fat)} ג׳ שומן · `}{SOURCE_LABEL[source]}
            </Text>
            {notes[ing.id] ? <Muted>{notes[ing.id]}</Muted> : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ing.subs.length > 0 || openSubs.has(ing.id)
                ? <LinkBtn label={`⇄ חלופה (${ing.subs.length})`} onPress={() => toggle(openSubs, setOpenSubs, ing.id)} />
                : <LinkBtn label="+ הוספת חלופה" onPress={() => addSub(ing)} />}
              <LinkBtn label={manualOpen ? 'סגירת עריכת ערכים' : 'עריכת ערכים תזונתיים'} onPress={() => toggle(openNut, setOpenNut, ing.id)} />
              {source === 'unknown' && <LinkBtn label={offBusy === ing.id ? 'מחפשת...' : 'השלמה מ-Open Food Facts'} disabled={offBusy === ing.id} onPress={() => fillFromOff(ing)} />}
              {ing.manualNut && <LinkBtn label="חזרה לערך אוטומטי" onPress={() => patchIng(ing.id, (x) => ({ ...x, manualNut: undefined, fromOff: undefined }))} />}
              {draft.ingredients.length > 1 && <LinkBtn label="הסרת המצרך" danger onPress={() => setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((x) => x.id !== ing.id) }))} />}
            </View>

            {manualOpen && (
              <View style={{ gap: 6, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 18, padding: 12 }}>
                <Muted>ערכים למצרך כולו (לכמות שהוזנה). שינוי ידני מסומן "ערך ידני", לא נדרס, ונשמר במאגר האישי לשימוש עתידי (כשידוע משקל היחידה).</Muted>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {NUT_KEYS.map(([k, label]) => <NumField key={k} label={label} value={round1(nut[k])} onChange={(v) => setManualNut(ing, k, v)} />)}
                </View>
              </View>
            )}

            {openSubs.has(ing.id) && (
              <View style={{ backgroundColor: C.primarySoft, borderRadius: 18, padding: 12, gap: 10 }}>
                {ing.subs.length === 0 && <Muted>אין חלופות. אפשר להוסיף ידנית.</Muted>}
                {ing.subs.map((s) => {
                  const q = subQty(ing, s);
                  return (
                    <View key={s.id} style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                        <View style={{ flex: 1 }}><Field label={s.manual ? 'חלופה (ידנית)' : 'חלופה (הצעה)'} value={s.name} onChangeText={(t) => editSubName(ing, s.id, t)} /></View>
                        <NumField label={`כמות (${q.unit})`} value={q.qty == null ? null : Math.round(q.qty * 100) / 100} onChange={(v) => editSubQty(ing, s.id, v)} width={110} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12.5, color: C.textMuted }}>יחס המרה ×{fmtNum(s.ratio)}{ing.qty == null ? ' · הזיני כמות למצרך כדי לחשב' : ` · ${qtyLabel(q.qty, q.unit)}`}</Text>
                        <LinkBtn label="מחיקה" danger onPress={() => delSub(ing, s.id)} />
                      </View>
                    </View>
                  );
                })}
                <LinkBtn label="+ הוספת חלופה" onPress={() => addSub(ing)} />
              </View>
            )}
          </Card>
        );
      })}
      <Btn label="+ הוספת מצרך" variant="secondary" onPress={() => setDraft((d) => ({ ...d, ingredients: [...d.ingredients, blankIng()] }))} />
      <Btn label="חישוב והצעת חלופות לכל המצרכים" variant="secondary" onPress={suggestAll} />

      {/* ── preparation ── */}
      <Field label="אופן הכנה" value={draft.instructions} onChangeText={(instructions) => patch({ instructions })} multiline placeholder={'1. ...\n2. ...'} {...({ dir: 'rtl' } as object)} style={{ minHeight: 160, paddingTop: 10, textAlignVertical: 'top', writingDirection: 'rtl' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <LinkBtn label="✨ שיפור ניסוח" disabled={!draft.instructions.trim()} onPress={polish} />
        <LinkBtn label="זיהוי מצרכים מאופן ההכנה" disabled={!draft.instructions.trim()} onPress={addMentioned} />
        {polishBase != null && <LinkBtn label="החזרת הטקסט המקורי" onPress={() => { patch({ instructions: polishBase }); setPolishBase(null); }} />}
        {polishBase != null && <LinkBtn label="אישור הטקסט" onPress={() => setPolishBase(null)} />}
      </View>
      {mentionNote && <Muted>{mentionNote}</Muted>}
      {polishBase != null && !numbersChanged && <Muted>הניסוח שופר. כל המספרים, הטמפרטורות והזמנים זהים למקור. עברי על הטקסט ותקני לפי הצורך.</Muted>}
      {numbersChanged && numberDiff && (
        <View accessibilityRole="alert" style={{ backgroundColor: '#FBE4E0', borderRadius: 18, padding: 10, gap: 4 }}>
          <Text style={{ color: C.danger, fontWeight: '600', textAlign: 'right' }}>שימי לב: המספרים השתנו לעומת הטקסט המקורי</Text>
          {numberDiff.missing.length > 0 && <Text style={{ color: C.danger, textAlign: 'right' }}>חסר: {numberDiff.missing.join(', ')}</Text>}
          {numberDiff.added.length > 0 && <Text style={{ color: C.danger, textAlign: 'right' }}>נוסף: {numberDiff.added.join(', ')}</Text>}
          <Muted>אפשר לתקן בשדה, או ללחוץ "החזרת הטקסט המקורי".</Muted>
        </View>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      <Btn label={isNew ? 'שמירת המתכון' : 'שמירת השינויים'} busy={busy} disabled={!draft.title.trim() || draft.categories.length === 0 || uploading} onPress={save} />
      {!isNew && <Btn label={confirmDelete ? 'בטוחה? לחצי שוב למחיקת המתכון' : 'מחיקת המתכון'} variant="danger" busy={busy} onPress={remove} />}
      <Pressable accessibilityRole="button" onPress={back} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: C.primaryDark, textAlign: 'center' }}>ביטול</Text>
      </Pressable>
    </Screen>
  );
}
