import { ingredientNutrition, parseIngredient, qtyLabel, recipeTotals, refreshSubs, uid, type Ing, type Nut, type SavedFoods, type Sub } from '@/lib/recipe-engine';
import { supabase } from '@/lib/supabase';

export type SubstituteRow = { id: string; ingredient_id: string; name: string; quantity: number | null; unit: string | null; ratio: number; position: number; is_manual: boolean };
export type Ingredient = {
  id?: string; position: number; text: string; substitutes: string[];
  // Structured fields (migration 018). Null on recipes created before it, until they are edited and saved.
  name?: string | null; quantity?: number | null; unit?: string | null;
  kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null;
  nutrition_source?: 'auto' | 'manual' | 'off'; dismissed_subs?: string[];
  ingredient_substitutes?: SubstituteRow[];
};
export type Recipe = {
  id: string;
  title: string;
  category: string;           // the first category (kept for older app versions)
  categories?: string[];      // all categories (migration 019)
  image_url: string | null;
  minutes: number | null;
  servings: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  instructions: string | null;
  nutrition_override?: Partial<Nut> | null;
  recipe_ingredients?: Ingredient[];
};

/** All categories of a recipe (recipes saved before migration 019 only have the single `category`). */
export const recipeCategories = (r: Pick<Recipe, 'category' | 'categories'>): string[] =>
  r.categories?.length ? r.categories : r.category ? [r.category] : [];

export const RECIPE_CATEGORIES = ['ארוחת בוקר', 'צהריים', 'ערב', 'נשנושים', 'אחרי אימון', 'קינוחים'];

/** What to select to get a recipe with everything needed to show it (ingredients + their substitutes). */
export const RECIPE_SELECT = '*, recipe_ingredients(*, ingredient_substitutes(*))';

const BUCKET = 'recipe-images';

/** Shrinks a photo to at most 1200px and JPEG, so recipes load fast on phones (web only). */
async function compressImage(file: File, max = 1200): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress failed'))), 'image/jpeg', 0.82));
}

export async function uploadRecipeImage(file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ───────────────────────────── display helpers (member view) ─────────────────────────────

export type ShownSub = { id: string; name: string; qty: number | null; unit: string };

/** The ingredient line to show: "2 כוסות קמח כוסמין" (or the old free text for recipes not edited since the upgrade). */
export function ingredientLine(i: Ingredient): string {
  if (i.name) return [qtyLabel(i.quantity ?? null, i.unit ?? ''), i.name].filter(Boolean).join(' ');
  return i.text;
}

/** Substitutes with their converted quantity: ingredient quantity x ratio (so it follows the quantity of the ingredient). */
export function shownSubstitutes(i: Ingredient): ShownSub[] {
  const rows = [...(i.ingredient_substitutes ?? [])].sort((a, b) => a.position - b.position);
  if (rows.length) {
    return rows.map((s) => ({
      id: s.id, name: s.name,
      qty: i.quantity != null ? i.quantity * Number(s.ratio) : s.quantity,
      unit: s.unit ?? i.unit ?? '',
    }));
  }
  return (i.substitutes ?? []).map((name, n) => ({ id: `legacy-${n}`, name, qty: null, unit: '' }));
}

// ───────────────────────────── DB <-> editor mapping ─────────────────────────────

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** A saved ingredient row -> the editor's ingredient. Rows from before the upgrade are parsed from their text. */
export function ingFromRow(row: Ingredient): Ing {
  let name = row.name ?? '';
  let qty = num(row.quantity);
  let unit = row.unit ?? '';
  if (!row.name) {
    const p = parseIngredient(row.text);
    name = p.name || row.text;
    qty = p.qty;
    unit = p.unit;
  }
  const subs: Sub[] = [...(row.ingredient_substitutes ?? [])].sort((a, b) => a.position - b.position).map((s) => ({
    id: s.id, name: s.name, ratio: Number(s.ratio) || 1, unit: s.unit ?? undefined, manual: s.is_manual,
  }));
  if (!subs.length && row.substitutes?.length) row.substitutes.forEach((n) => subs.push({ id: uid('s'), name: n, ratio: 1, manual: true }));
  const handValues = (row.nutrition_source === 'manual' || row.nutrition_source === 'off') && row.kcal != null;
  const base: Ing = { id: row.id ?? uid('i'), name, qty, unit: unit || (qty != null ? 'יחידה' : ''), subs, dismissed: row.dismissed_subs ?? [] };
  // Automatic suggestions follow the current rules (at most 3, relevant ones only) every time a recipe is opened; hand-made ones are kept.
  base.subs = refreshSubs(base);
  return {
    ...base,
    manualNut: handValues ? { kcal: num(row.kcal) ?? 0, protein: num(row.protein) ?? 0, carbs: num(row.carbs) ?? 0, fat: num(row.fat) ?? 0, qty: qty ?? 1 } : undefined,
    fromOff: row.nutrition_source === 'off' || undefined,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The editor's ingredient -> the row to insert (the old `text` / `substitutes` columns are filled too, for compatibility). */
export function ingToRow(recipeId: string, i: Ing, position: number, saved: SavedFoods) {
  const { nut, source } = ingredientNutrition(i, saved);
  const known = source === 'db' || source === 'saved' || source === 'off' || source === 'manual';
  const named = i.subs.filter((s) => s.name.trim());
  return {
    recipe_id: recipeId, position,
    text: [qtyLabel(i.qty, i.unit), i.name.trim()].filter(Boolean).join(' '),
    substitutes: named.map((s) => s.name.trim()),
    name: i.name.trim(), quantity: i.qty, unit: i.qty != null ? i.unit : null,
    kcal: known ? r2(nut.kcal) : null, protein: known ? r2(nut.protein) : null, carbs: known ? r2(nut.carbs) : null, fat: known ? r2(nut.fat) : null,
    nutrition_source: source === 'manual' ? 'manual' : source === 'off' ? 'off' : 'auto',
    dismissed_subs: i.dismissed,
  };
}

export function subToRow(ingredientId: string, ing: Ing, s: Sub, position: number) {
  return {
    ingredient_id: ingredientId, name: s.name.trim(), ratio: s.ratio > 0 ? s.ratio : 1, position, is_manual: s.manual,
    unit: s.unit ?? null, quantity: ing.qty != null ? r2(ing.qty * s.ratio) : null,
  };
}

/** Per-serving numbers stored on the recipe row (what the member screens show): hand-typed value, else the calculation. */
export function servingColumns(ings: Ing[], servings: number | null, override: Partial<Nut>, saved: SavedFoods) {
  const { perServing } = recipeTotals(ings, servings, saved);
  const anyKnown = ings.some((i) => ['db', 'saved', 'off', 'manual'].includes(ingredientNutrition(i, saved).source));
  const pick = (k: keyof Nut) => (override[k] != null ? Math.round(override[k]!) : perServing && anyKnown ? Math.round(perServing[k]) : null);
  return { calories: pick('kcal'), protein_g: pick('protein'), carbs_g: pick('carbs'), fat_g: pick('fat') };
}

export async function fetchSavedFoods(): Promise<SavedFoods> {
  const { data } = await supabase.from('saved_foods').select('name_key, kcal, protein, carbs, fat');
  const out: SavedFoods = {};
  for (const r of (data as { name_key: string; kcal: number; protein: number; carbs: number; fat: number }[] | null) ?? []) {
    out[r.name_key] = { kcal: Number(r.kcal), protein: Number(r.protein), carbs: Number(r.carbs), fat: Number(r.fat) };
  }
  return out;
}
