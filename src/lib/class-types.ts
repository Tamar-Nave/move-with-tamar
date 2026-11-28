// Class types (the studio's own list of workout types): shared type, palette, labels and the quick-fill matching.
import { parseClassText } from '@/lib/parse-class';

export type ClassTypeRow = {
  id: string; name: string; description: string; color: string;
  reminder_note: string | null; is_active: boolean; legacy_key: string | null; created_at?: string;
};

/** Accessible palette (always shown together with the name, so colour is never the only signal). */
export const CLASS_TYPE_COLORS = [
  // soft
  '#E8B4BC', '#A8D0E6', '#9AD1D4', '#B7C9B5', '#D6B89C', '#C9B8D9',
  // deep
  '#B54C68', '#2C5282', '#287D7D', '#3B6E52', '#8C4A32', '#6B3A5B',
];

const normKey = (s: string) => s.toLowerCase().replace(/[״"]/g, '').replace(/[׳']/g, '').replace(/\s+/g, ' ').trim();

// ───────────────────────────── class types: quick fill ─────────────────────────────

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const HEB_LATIN: Record<string, string> = { ס: 's', ק: 'k', כ: 'k', ך: 'k', ל: 'l', פ: 'p', ף: 'p', ט: 't', ת: 't', ג: 'g', ד: 'd', ב: 'b', ר: 'r', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ח: 'h', צ: 'z', ץ: 'z', ז: 'z', ש: 's' };
/** Consonant skeleton shared by a Latin name ("SCULPT") and its Hebrew spelling ("סקאלפט"). */
function skeleton(w: string): string {
  if (/[א-ת]/.test(w)) return [...w].map((ch) => HEB_LATIN[ch] ?? '').join('');
  return w.toLowerCase().replace(/ph/g, 'f').replace(/[cq]/g, 'k').replace(/[^a-z]/g, '').replace(/[aeiouyhw]/g, '');
}
const stripPrefix = (w: string) => w.replace(/^[ובהלמכש]{1,2}(?=.{3,})/, '');

/** Which of the studio's active types does the sentence mention? Local matching only. */
export function matchClassTypeRow(text: string, types: ClassTypeRow[]): { type?: ClassTypeRow; ambiguous: ClassTypeRow[] } {
  const words = normKey(text).replace(/[,.;!?()\-–—־/]/g, ' ').split(' ').filter(Boolean);
  const joined = ` ${words.join(' ')} `;
  const scored: { t: ClassTypeRow; score: number }[] = [];
  for (const t of types.filter((x) => x.is_active)) {
    const name = normKey(t.name).replace(/^אימוןs+/, '');
    const nameWords = name.split(' ').filter(Boolean);
    let score = 0;
    if (joined.includes(` ${name} `) || words.some((w) => stripPrefix(w) === name || w === name)) score = 10;
    else {
      // Per word of the type name: exact (after dropping a Hebrew prefix), a close spelling, or a Hebrew spelling of a Latin name.
      const hit = (nw: string) => words.some((w) => [w, stripPrefix(w)].some((c) => c === nw || (nw.length >= 4 && lev(c, nw) <= (nw.length >= 7 ? 2 : 1))
        || (/[a-z]/.test(nw) && skeleton(nw).length >= 4 && lev(skeleton(c), skeleton(nw)) <= 1 && /[א-ת]/.test(c))));
      const hits = nameWords.filter(hit).length;
      if (hits === nameWords.length) score = 9;
      else if (hits > 0 && nameWords.some((nw) => nw.length >= 4 && hit(nw))) score = 1; // only part of a multi-word name
    }
    if (score) scored.push({ t, score });
  }
  if (!scored.length) return { ambiguous: [] };
  const top = Math.max(...scored.map((s) => s.score));
  const best = scored.filter((s) => s.score === top).map((s) => s.t);
  // If one matched name contains the other ("פילאטיס" / "פילאטיס מכשירים"), prefer the longer one.
  best.sort((a, b) => b.name.length - a.name.length);
  if (best.length > 1 && !normKey(best[0].name).includes(normKey(best[1].name))) return { ambiguous: best };
  return { type: best[0], ambiguous: [] };
}

export function parseClassQuick(text: string, today: string, types: ClassTypeRow[]) {
  const p = parseClassText(text, today);
  const m = matchClassTypeRow(text, types);
  const warnings = p.warnings.filter((w) => !w.startsWith('לא זיהיתי:'));
  const missing: string[] = [];
  if (!m.type) missing.push('סוג אימון');
  if (!p.dates) missing.push('יום');
  if (!p.time) missing.push('שעה');
  if (m.ambiguous.length) warnings.unshift(`זיהיתי כמה סוגים אפשריים (${m.ambiguous.map((x) => x.name).join(', ')}). בחרי בטופס.`);
  else if (missing.length) warnings.unshift(`לא זיהיתי: ${missing.join(', ')}. כדאי לבחור בטופס.`);
  return { ...p, typeId: m.type?.id, typeName: m.type?.name, warnings };
}

