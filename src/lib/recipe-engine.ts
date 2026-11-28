// Pure, free, local recipe logic (no network, no API keys):
//   - Hebrew ingredient-line parsing ("שתי כוסות קמח" -> 2 / כוס / קמח)
//   - nutrition maths on top of the built-in ingredient database (lib/foods.ts)
//   - substitute quantities, recipe-text parsing, preparation-text polishing with a numbers guard.
import { FOODS, findFood, gramsOf, norm, normKey, subDefsFor } from '@/lib/foods';

export { FOODS, UNITS, findFood, gramsOf } from '@/lib/foods';

// ───────────────────────────── types ─────────────────────────────

export type Nut = { kcal: number; protein: number; carbs: number; fat: number };
export const ZERO: Nut = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export type Sub = { id: string; name: string; ratio: number; unit?: string; manual: boolean };
export type Ing = {
  id: string;
  name: string;
  qty: number | null;
  unit: string;
  /** Hand-edited values for `qty` (scaled proportionally if qty changes later; never overwritten by auto-calc). */
  manualNut?: Nut & { qty: number };
  /** manualNut came from Open Food Facts rather than from the user (so renaming the ingredient drops it). */
  fromOff?: boolean;
  /** Values from Open Food Facts (per 100 g), used when the name is not in the built-in/saved database. */
  offPer100?: Nut;
  subs: Sub[];
  /** Names of auto-suggested substitutes the user deleted (so renaming doesn't bring them back). */
  dismissed: string[];
};

// ───────────────────────────── nutrition ─────────────────────────────

export type NutSource = 'db' | 'saved' | 'off' | 'manual' | 'unknown' | 'noqty';
export type SavedFoods = Record<string, Nut>; // normalized name -> values per 100 g

export function ingredientNutrition(ing: Ing, saved: SavedFoods): { nut: Nut; source: NutSource } {
  if (ing.manualNut && ing.qty != null && ing.manualNut.qty > 0) {
    const k = ing.qty / ing.manualNut.qty;
    const m = ing.manualNut;
    return { nut: { kcal: m.kcal * k, protein: m.protein * k, carbs: m.carbs * k, fat: m.fat * k }, source: ing.fromOff ? 'off' : 'manual' };
  }
  if (ing.manualNut) return { nut: ing.manualNut, source: ing.fromOff ? 'off' : 'manual' };
  if (ing.qty == null || !ing.name.trim()) return { nut: ZERO, source: 'noqty' };
  const food = findFood(ing.name);
  const savedHit = saved[normKey(ing.name)];
  const per100 = savedHit ?? (food ? { kcal: food.per100[0], protein: food.per100[1], carbs: food.per100[2], fat: food.per100[3] } : ing.offPer100);
  if (!per100) return { nut: ZERO, source: 'unknown' };
  const grams = gramsOf(food, ing.qty, ing.unit);
  if (grams == null) return { nut: ZERO, source: 'unknown' };
  const k = grams / 100;
  return {
    nut: { kcal: per100.kcal * k, protein: per100.protein * k, carbs: per100.carbs * k, fat: per100.fat * k },
    source: savedHit ? 'saved' : food ? 'db' : 'off',
  };
}

export function recipeTotals(ings: Ing[], servings: number | null, saved: SavedFoods): { perServing: Nut | null; total: Nut } {
  const total = { ...ZERO };
  for (const i of ings) {
    const { nut } = ingredientNutrition(i, saved);
    total.kcal += nut.kcal; total.protein += nut.protein; total.carbs += nut.carbs; total.fat += nut.fat;
  }
  if (!servings || servings < 1) return { perServing: null, total };
  return { perServing: { kcal: total.kcal / servings, protein: total.protein / servings, carbs: total.carbs / servings, fat: total.fat / servings }, total };
}

/** Per-100 g values implied by hand-entered values for qty+unit, when the weight is known. */
export function per100From(name: string, qty: number, unit: string, nut: Nut): Nut | null {
  const g = gramsOf(findFood(name), qty, unit);
  if (!g) return null;
  const k = 100 / g;
  return { kcal: nut.kcal * k, protein: nut.protein * k, carbs: nut.carbs * k, fat: nut.fat * k };
}

export const normalizedFoodKey = normKey;

// ───────────────────────────── substitutes ─────────────────────────────

let seq = 0;
export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Auto substitutes for an ingredient name (not including ones the user dismissed). */
export function suggestSubs(name: string, dismissed: string[]): Sub[] {
  const food = findFood(name);
  if (!food) return [];
  return subDefsFor(food).filter((s) => !dismissed.includes(s.name)).map((s) => ({ id: uid('s'), name: s.name, ratio: s.ratio, unit: s.unit, manual: false }));
}

/** Rename/unit change: replace the auto subs, keep the hand-made ones. */
export function refreshSubs(ing: Ing): Sub[] {
  const manual = ing.subs.filter((s) => s.manual);
  const auto = suggestSubs(ing.name, ing.dismissed).filter((a) => !manual.some((m) => m.name === a.name));
  return [...auto, ...manual];
}

export function subQty(ing: Ing, sub: Sub): { qty: number | null; unit: string } {
  return { qty: ing.qty == null ? null : ing.qty * sub.ratio, unit: sub.unit ?? ing.unit };
}

// ───────────────────────────── formatting ─────────────────────────────

export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return String(r);
}
export const fmtRound = (n: number) => String(Math.round(n));

const PLURAL: Record<string, string> = { כוס: 'כוסות', כף: 'כפות', כפית: 'כפיות', גביע: 'גביעים', קופסה: 'קופסאות' };

/** "2 כוסות" style label for display. */
export function qtyLabel(qty: number | null, unit: string): string {
  if (qty == null) return '';
  const frac: Record<string, string> = { '0.25': 'רבע', '0.5': 'חצי', '0.75': 'שלושה רבעי' };
  const q = frac[String(Math.round(qty * 100) / 100)];
  const unitText = qty > 1 ? PLURAL[unit] ?? unit : unit; // 2 כוסות, but חצי כוס / כוס
  return `${q ?? fmtNum(qty)}${unit && unit !== 'יחידה' ? ` ${unitText}` : ''}`.trim();
}

// ───────────────────────────── ingredient-line parsing ─────────────────────────────

const NUM_WORDS: Record<string, number> = {
  חצי: 0.5, רבע: 0.25, שליש: 1 / 3, אחת: 1, אחד: 1, שתי: 2, שתיים: 2, שניים: 2, שני: 2, שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4,
  חמש: 5, חמישה: 5, שש: 6, שישה: 6, שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10,
};

const UNIT_WORDS: [RegExp, string][] = [
  [/^(?:כוס|כוסות|כוסית)$/, 'כוס'],
  [/^(?:כף|כפות)$/, 'כף'],
  [/^(?:כפית|כפיות)$/, 'כפית'],
  [/^(?:גרם|גרמים|גר'|גר|ג')$/, 'גרם'],
  [/^(?:קילו|קילוגרם|ק"ג|קג)$/, 'ק״ג'],
  [/^(?:מ"ל|מל|מיליליטר)$/, 'מ״ל'],
  [/^(?:ליטר|ליטרים)$/, 'ליטר'],
  [/^(?:יחידה|יחידות|יח'|יח)$/, 'יחידה'],
  [/^(?:שן|שיני|שיניים)$/, 'יחידה'],
  [/^(?:קופסה|קופסאות|קופסת|שימורים)$/, 'קופסה'],
  [/^(?:גביע|גביעים)$/, 'גביע'],
  [/^(?:קורט|קמצוץ)$/, 'קורט'],
];

const unitOf = (tok: string | undefined): string | null => {
  if (!tok) return null;
  for (const [re, u] of UNIT_WORDS) if (re.test(tok)) return u;
  return null;
};

const UNICODE_FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375 };

/** A fraction token: 1/2, 3/4, 1/8, ½, "חצי", "רבע", "שליש" (also with a leading ו: "וחצי"). */
function fracOf(tok: string | undefined): number | null {
  if (!tok) return null;
  const t = tok.replace(/^ו(?=[א-ת\d½¼¾⅓⅔⅛⅜])/, '');
  if (t === 'חצי') return 0.5;
  if (t === 'רבע') return 0.25;
  if (t === 'שליש') return 1 / 3;
  if (t in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[t];
  const m = t.match(/^(\d+)\/(\d+)$/);
  if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  return null;
}

function numOf(tok: string | undefined): number | null {
  if (!tok) return null;
  const t = tok.replace(',', '.');
  if (!t.startsWith('ו')) {
    const frac = fracOf(t);
    if (frac != null) return frac;
  }
  const mixed = t.match(/^(\d+)([½¼¾⅓⅔⅛⅜])$/); // "1½"
  if (mixed) return Number(mixed[1]) + UNICODE_FRACTIONS[mixed[2]];
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return NUM_WORDS[tok] ?? null;
}

/** "כוס וחצי קמח כוסמין" -> {1.5, כוס, "קמח כוסמין"}; "3 ביצים" -> {3, יחידה, "ביצים"}; "מלח לפי הטעם" -> qty null. */
export function parseIngredient(raw: string): { name: string; qty: number | null; unit: string } {
  const toks = norm(raw).replace(/[,;.]+$/g, '').split(' ').filter(Boolean);
  let i = 0;
  let qty: number | null = null;
  let unit = '';
  // "1 1/2", "2 וחצי", "כוס וחצי", "כוס ורבע": fractions that follow a number or a unit are added to the quantity.
  const fractions = () => {
    for (let f = fracOf(toks[i]); toks[i] && f != null && qty != null; f = fracOf(toks[i])) { qty += f; i++; }
    for (let f = fracOf(toks[i]); toks[i] && f != null && qty == null && toks[i].startsWith('ו'); f = fracOf(toks[i])) { qty = f; i++; }
  };
  if (/^שלוש(?:ת|ה)$/.test(toks[i] ?? '') && /^רבע(?:י|ים)$/.test(toks[i + 1] ?? '')) { qty = 0.75; i += 2; } // "שלושת רבעי כוס"
  else {
    const n = numOf(toks[i]);
    if (n != null) { qty = n; i++; }
  }
  fractions();
  const u = unitOf(toks[i]);
  if (u) { if (qty == null) qty = 1; unit = u; i++; }
  fractions();
  if (qty != null && !unit) unit = 'יחידה';
  if (toks[i] === 'של') i++;
  const name = toks.slice(i).join(' ').replace(/\s*(?:לפי הטעם|להגשה|לקישוט)$/, '').trim();
  if (qty != null && !name && unit) { /* "2 כוסות" with no name */ }
  return { name, qty, unit };
}

// ───────────────────────────── whole-recipe text ("מילוי מהיר") ─────────────────────────────

export type ParsedRecipe = {
  title?: string; servings?: number; minutes?: number;
  ingredients: { name: string; qty: number | null; unit: string }[];
  instructions?: string;
  notes: string[];
};

const ING_MARK = /(?:^|\n|\.\s|:\s|\s)(?:מצרכים|רכיבים|חומרים|המצרכים|הרכיבים)\s*[:\-]?\s*/;
const STEP_MARK = /(?:^|\n|\.\s|\s)(?:אופן ההכנה|אופן הכנה|הוראות הכנה|הוראות|ההכנה|הכנה)\s*[:\-]?\s*/;

/** "3 ביצים וחצי כוס סוכר" -> two pieces. A "ו" before a quantity starts a new ingredient, unless it continues a quantity ("כוס וחצי", "2 וחצי"). */
export function splitAtAnd(piece: string): string[] {
  const toks = piece.split(/\s+/).filter(Boolean);
  const out: string[][] = [[]];
  toks.forEach((tok, k) => {
    const rest = tok.replace(/^ו-?/, '');
    const prev = toks[k - 1];
    const startsQuantity = k > 0 && /^ו/.test(tok) && rest !== '' && (numOf(rest) != null || fracOf(rest) != null || unitOf(rest) != null);
    const prevIsQuantity = prev != null && (numOf(prev) != null || fracOf(prev) != null || unitOf(prev) != null);
    if (startsQuantity && !prevIsQuantity) out.push([rest]);
    else out[out.length - 1].push(tok);
  });
  return out.map((t) => t.join(' ')).filter(Boolean);
}

export function parseRecipeText(input: string): ParsedRecipe {
  const out: ParsedRecipe = { ingredients: [], notes: [] };
  let t = input.replace(/\r/g, '').trim();
  if (!t) return out;

  const sv = t.match(/(?:מספיק\s*ל[־-]?|ל[־-]?|עבור\s*)?(\d+|[א-ת]+)\s*(?:מנות|מנה|יחידות|פרוסות)/);
  if (sv) {
    const v = numOf(sv[1]);
    if (v != null && v >= 1 && v <= 100) { out.servings = Math.round(v); t = t.replace(sv[0], ' '); }
  }
  const mn = t.match(/(?:זמן הכנה|הכנה של|מכינים ב)\s*[:\-]?\s*(\d{1,3})\s*דקות/);
  if (mn) { out.minutes = Number(mn[1]); t = t.replace(mn[0], ' '); }

  const iMatch = ING_MARK.exec(t);
  const sMatch = STEP_MARK.exec(t);
  let head = t;
  let ingText = '';
  let stepText = '';
  if (iMatch && sMatch && sMatch.index > iMatch.index) {
    head = t.slice(0, iMatch.index);
    ingText = t.slice(iMatch.index + iMatch[0].length, sMatch.index);
    stepText = t.slice(sMatch.index + sMatch[0].length);
  } else if (iMatch) {
    head = t.slice(0, iMatch.index);
    ingText = t.slice(iMatch.index + iMatch[0].length);
  } else if (sMatch) {
    head = t.slice(0, sMatch.index);
    stepText = t.slice(sMatch.index + sMatch[0].length);
  }

  // Title: first short phrase before any marker.
  const first = head.split(/[.\n:]/).map((x) => x.trim()).find(Boolean) ?? '';
  const titleCandidate = first.replace(/^(?:מתכון\s+(?:ל|של)?\s*)/, '').trim();
  if (titleCandidate && titleCandidate.length <= 40 && !/\d/.test(titleCandidate) && !unitOf(titleCandidate.split(' ')[0])) out.title = titleCandidate;

  const splitList = (s: string) => s.split(/[,\n;]/).map((x) => x.replace(/^\s*[-•]\s*/, '').replace(/^\s*\d+[.)]\s+/, '').trim()).filter(Boolean).flatMap(splitAtAnd);

  if (ingText) {
    out.ingredients = splitList(ingText).map(parseIngredient).filter((x) => x.name);
  } else if (!stepText) {
    // No markers at all: short "quantity + unit + name" pieces are ingredients, the first plain phrase is the title, the rest is preparation.
    const pieces = t.split(/[,\n;.]/).map((x) => x.trim()).filter(Boolean).flatMap(splitAtAnd);
    const rest: string[] = [];
    pieces.forEach((p, idx) => {
      const parsed = parseIngredient(p);
      const short = !!parsed.name && parsed.name.split(' ').length <= 4 && p.split(' ').length <= 6;
      if (idx === 0 && out.title === p) return;
      if (short && parsed.qty != null) out.ingredients.push(parsed);
      else if (idx === 0 && !out.title && p.length <= 40 && !/\d/.test(p)) out.title = p.replace(/^מתכון\s+(?:ל|של)?\s*/, '');
      else if (short && parsed.name.split(' ').length <= 3 && findFood(parsed.name) != null) {
        const unitFood = findFood(parsed.name)?.unit != null;
        out.ingredients.push(unitFood ? { name: parsed.name, qty: 1, unit: 'יחידה' } : { name: parsed.name, qty: null, unit: '' });
      }
      else rest.push(p);
    });
    stepText = rest.join('. ');
  }
  if (stepText.trim()) out.instructions = stepText.trim();
  if (!out.title) out.notes.push('לא זיהיתי שם מתכון. כדאי למלא למעלה.');
  if (!out.servings) out.notes.push('לא זיהיתי לכמה מנות המתכון (למשל: "מספיק לשמונה מנות"). הערכים התזונתיים למנה דורשים את המספר הזה.');
  if (!out.ingredients.length) out.notes.push('לא זיהיתי מצרכים. כדאי לכתוב אחרי המילה "מצרכים" ולהפריד בפסיקים.');
  return out;
}

// ───────────────────────────── preparation text: polish + number guard ─────────────────────────────

const CONNECTORS = /(?:^|[\s,])(?:ואז|ואחר כך|אחר כך|אחרי זה|ואחרי זה|לאחר מכן|ולאחר מכן|ובסוף|בסוף|ואחרי)(?=\s)/g;
const FILLERS = /(?:^|\s)(?:אממ+|אמ|אהה?|כאילו|בעצם|נו|ככה|נגיד|יאללה|פשוט|תכלס|בקיצור|וואלה|אוקיי|אוקי|יופי|אתה יודע|את יודעת)(?=[\s,.]|$)/g;
const TIP_START = /^(?:טיפ|שימי לב|שימו לב|חשוב|הערה|כדאי|אפשר גם|אפשר להחליף|אם רוצים|במקום)/;

/** Numbers and time words that must survive polishing untouched. */
export function extractNumbers(text: string): string[] {
  const found: string[] = [];
  text = text.replace(/^\s*\d+[.)]\s+/gm, ''); // list numbering is not a recipe number
  for (const m of text.matchAll(/\d+(?:[.,/]\d+)*/g)) found.push(m[0].replace(',', '.'));
  for (const m of text.matchAll(/חצי שעה|רבע שעה|שעה וחצי|שעתיים|שלוש שעות|(?:עשר|חמש|עשרים|שלושים|חמש עשרה|ארבעים)\s+דקות|דקה|דקות|מעלות/g)) found.push(m[0]);
  return found.sort();
}

export function diffNumbers(before: string, after: string): { missing: string[]; added: string[] } {
  const a = extractNumbers(before);
  const b = extractNumbers(after);
  const take = (from: string[], remove: string[]) => {
    const pool = [...from];
    for (const r of remove) { const i = pool.indexOf(r); if (i >= 0) pool.splice(i, 1); }
    return pool;
  };
  return { missing: take(a, b), added: take(b, a) };
}

const COOKING_VERBS = new Set((
  'מחממים מערבבים מוסיפים שופכים אופים מצננים מגישים מועכים חותכים טוחנים מקפלים מניחים מכסים מוציאים מטגנים מבשלים ' +
  'מרתיחים מסננים מערבלים לשים מעבירים מורחים מפזרים מקשטים מקררים מקפיאים מדליקים מכניסים מוזגים מקציפים מפרידים ממיסים ' +
  'מתבלים לוקחים שמים מרססים מורידים מנקים קוצצים מגרדים מרכיבים צולים מגלגלים מעצבים משמנים מרתיחים מנחים מחזירים ' +
  'הוסיפי ערבבי חממי שפכי אפי מעכי חתכי קפלי הניחי כסי הוציאי לושי טגני בשלי סנני הקציפי מזגי'
).split(' '));

/** Splits one long sentence at cooking verbs ("מחממים..., מערבבים... ומוסיפים...") into steps; a verb with nothing after it stays attached. */
function splitAtVerbs(step: string): string[] {
  const words = step.split(/\s+/).filter(Boolean);
  const pieces: string[][] = [[]];
  words.forEach((w, k) => {
    const base = w.replace(/^ו/, '').replace(/[,.;]+$/, '');
    if (k > 0 && COOKING_VERBS.has(base) && pieces[pieces.length - 1].length > 0) pieces.push([]);
    pieces[pieces.length - 1].push(w);
  });
  // a piece of a single word is not a step: it goes back to the previous piece (or, at the start, forward to the next one), unchanged
  const kept: string[][] = [];
  let carry: string[] = [];
  for (const piece of pieces) {
    const joined = [...carry, ...piece];
    if (joined.length < 2 && kept.length) { kept[kept.length - 1].push(...joined); carry = []; }
    else if (joined.length < 2) carry = joined;
    else { kept.push(joined); carry = []; }
  }
  if (carry.length) kept.push(carry);
  return kept.map((piece, idx) => {
    const text = piece.join(' ').replace(/[,;]+$/, '');
    return idx === 0 ? text : text.replace(/^ו(?=[א-ת])/, '');
  });
}

const LEADING_CONNECTOR = /^(?:קודם כל|קודם|ואז|ואחר כך|אחר כך|אחרי זה|ואחרי זה|לאחר מכן|ולאחר מכן|ובסוף|בסוף|ואחרי|אחרי)\s+(?=[א-ת])/;

/** Rule-based: numbered short steps, filler/duplicates removed, numbers/temperatures/times/tips kept verbatim. */
export function polishInstructions(raw: string): string {
  let t = raw.replace(/\r/g, '').trim();
  if (!t) return '';
  // Existing numbering / bullets at line start are dropped and rebuilt.
  t = t.replace(/^\s*(?:\d+[.)]|[-•*])\s+/gm, '');
  // Break at line ends, sentence ends and spoken connectors (the connector itself is dropped).
  t = t.replace(/\n+/g, '. ').replace(/\s+(?=(?:טיפ|שימי לב|שימו לב)(?:\s|:))/g, '|').replace(/([.!?])\s+/g, '$1|').replace(CONNECTORS, '|');
  // Clean each sentence first (filler words, a leading connector, a word said twice), then split long ones at cooking verbs.
  const pre = (st: string) => st.replace(FILLERS, ' ').replace(/\s+/g, ' ').trim()
    .replace(LEADING_CONNECTOR, '').replace(/(^|\s)(ו?)([א-ת]{3,})\s+\3(?=\s|$)/g, '$1$2$3');
  let steps = t.split(/[|]/).map(pre).filter(Boolean).flatMap((st) => (TIP_START.test(st) ? [st] : splitAtVerbs(st)));

  steps = steps.map((s) => {
    let x = s.replace(LEADING_CONNECTOR, '').replace(FILLERS, ' ').replace(/^(?:אז|טוב|ו)\s+(?=[א-ת])/, '').replace(/\s+/g, ' ').replace(/^[,.\s]+|[.,\s]+$/g, '');
    // Collapse immediate word repeats ("מערבבים מערבבים").
    x = x.replace(/(^|\s)([א-תa-z]{2,})(\s+\2)+(?=\s|$)/g, '$1$2');
    return x;
  }).filter((s) => s.length > 0);

  // One-word leftovers join the previous step instead of becoming a step of their own.
  const merged: string[] = [];
  for (const s of steps) {
    if (merged.length && s.split(' ').length < 2 && !TIP_START.test(s) && !/\d/.test(s) && !COOKING_VERBS.has(s.replace(/^ו/, ''))) merged[merged.length - 1] += ` ${s}`;
    else merged.push(s);
  }

  let n = 0;
  return merged.map((s) => {
    const body = s.charAt(0).toUpperCase() + s.slice(1);
    if (TIP_START.test(s)) return `💡 ${body}.`;
    n += 1;
    return `${n}. ${body}.`;
  }).join('\n');
}

// ───────────────────────────── Open Food Facts (free, optional, needs internet) ─────────────────────────────

/** Looks up per-100 g values. Returns null if offline / not found. Only the ingredient name leaves the browser. */
export async function lookupOpenFoodFacts(name: string): Promise<Nut | null> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,nutriments`;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(to);
    if (!res.ok) return null;
    const data = (await res.json()) as { products?: { nutriments?: Record<string, number> }[] };
    for (const p of data.products ?? []) {
      const n = p.nutriments ?? {};
      if (typeof n['energy-kcal_100g'] === 'number') {
        return { kcal: n['energy-kcal_100g'], protein: n.proteins_100g ?? 0, carbs: n.carbohydrates_100g ?? 0, fat: n.fat_100g ?? 0 };
      }
    }
    return null;
  } catch { return null; }
}

// ───────────────────────────── ingredients mentioned in the preparation text ─────────────────────────────

const aliasIndex = FOODS.flatMap((f) => f.aliases.map((a) => ({ f, a, k: normKey(a) }))).sort((x, y) => y.k.length - x.k.length);
const mentionRe = new Map<string, RegExp>();

/** Known foods named in a text ("מערבבים קמח כוסמין עם הביצים") — longest name first, so "קמח כוסמין" is not also counted as "קמח". Water is ignored. */
export function mentionedFoods(text: string): { name: string; key: string }[] {
  let rest = ' ' + normKey(text).replace(/[.,;:!?()]/g, ' ') + ' ';
  const found = new Map<string, string>();
  for (const { f, a, k } of aliasIndex) {
    let re = mentionRe.get(k);
    if (!re) {
      re = new RegExp('(^|\\s)([ובהלמכש]{0,2})(' + k.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&') + ')(?=\\s)', 'g');
      mentionRe.set(k, re);
    }
    rest = rest.replace(re, (m: string, sp: string) => {
      if (f.key !== 'מים' && !found.has(f.key)) found.set(f.key, a);
      return sp + ' '.repeat(m.length - sp.length);
    });
  }
  return [...found.entries()].map(([key, name]) => ({ key, name }));
}
