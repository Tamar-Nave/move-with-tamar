// Free-text class entry: turns a Hebrew sentence (typed, or dictated with the phone keyboard's mic)
// into new-class form fields. Pure rule-based parsing — no AI, no network, no cost.
// Example: "SCULPT שלישי ב-19:00, 10 משתתפות, כל שבוע" → sculpt, next Tuesday, 19:00, capacity 10, weekly.
import { addDays, startOfWeek, weekdayOf } from '@/lib/dates';

export type ParsedClass = {
  kind?: 'sculpt' | 'functional';
  dates?: string[];      // YYYY-MM-DD, one per class day mentioned
  time?: string;         // HH:MM
  capacity?: number;
  duration?: number;     // minutes
  repeatWeeks?: number;  // same meaning as the form's repeat chips (0 = once)
  openNow?: boolean;     // registration opens immediately
  notes?: string;
  warnings: string[];
};

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const DEFAULT_REPEAT_WEEKS = 4;

// Longest first, so "שתים עשרה" wins over "שתים".
const NUMBER_WORDS: [string, number][] = [
  ['אחת עשרה', 11], ['אחד עשר', 11], ['שתים עשרה', 12], ['שתיים עשרה', 12], ['שנים עשר', 12],
  ['חמש עשרה', 15], ['עשרים', 20], ['שלושים', 30], ['ארבעים', 40], ['חמישים', 50],
  ['אחת', 1], ['אחד', 1], ['שתיים', 2], ['שתים', 2], ['שניים', 2], ['שלוש', 3], ['שלושה', 3],
  ['ארבע', 4], ['ארבעה', 4], ['חמש', 5], ['חמישה', 5], ['שש', 6], ['שישה', 6], ['שבע', 7], ['שבעה', 7],
  ['שמונה', 8], ['תשע', 9], ['תשעה', 9], ['עשר', 10], ['עשרה', 10],
];

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

export function parseClassText(input: string, today: string): ParsedClass {
  const out: ParsedClass = { warnings: [] };
  let t = ` ${input.trim()} `;

  // Notes: everything after "הערה" / "הערות".
  const note = t.match(/\sהער(?:ה|ות)[:\s]+(.+)$/);
  if (note) { out.notes = note[1].trim(); t = t.slice(0, note.index) + ' '; }

  t = t.toLowerCase().replace(/[״"]/g, '"').replace(/[׳']/g, "'");

  // Class type.
  if (/פונקצי|פאנקש|functional/.test(t)) out.kind = 'functional';
  else if (/sculpt|scalp|skulpt|ס[קכ]א?ו?ל[פף]/.test(t)) out.kind = 'sculpt';

  // Explicit date: 18/11, 18.11, 18/11/26.
  const dates: string[] = [];
  t = t.replace(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d:])/g, (m, d, mo, y, off: number) => {
    const day = Number(d), month = Number(mo);
    if (m.includes('.') && /שעה\s*$/.test(t.slice(0, off))) return m; // "בשעה 7.30" is a time
    if (month < 1 || month > 12 || day < 1 || day > 31) return m;
    let year = y ? Number(y.length === 2 ? `20${y}` : y) : Number(today.slice(0, 4));
    let ymd = `${year}-${pad(month)}-${pad(day)}`;
    if (!y && ymd < today) { year += 1; ymd = `${year}-${pad(month)}-${pad(day)}`; }
    dates.push(ymd);
    return ' ';
  });

  // Clock times: 19:00, 7:30, 19.30.
  let time: { h: number; m: number; explicit24: boolean } | undefined;
  t = t.replace(/(\d{1,2})[:.](\d{2})/, (m, h, mi) => {
    const H = Number(h), M = Number(mi);
    if (H > 23 || M > 59) return m;
    time = { h: H, m: M, explicit24: H >= 12 || h.length === 2 };
    return ' __T__ ';
  });

  // Punctuation → spaces; number words → digits; split Hebrew prefixes off digits ("ב19" → "ב 19").
  t = t.replace(/[,;!?()\-–—־/]/g, ' ');
  for (const [word, n] of NUMBER_WORDS) {
    t = t.replace(new RegExp(`(\\s)([בלוה]{0,2})${word}(?=\\s)`, 'g'), `$1$2 ${n}`);
  }
  t = t.replace(/([א-ת])(\d)/g, '$1 $2').replace(/\s+/g, ' ');

  // Duration.
  t = t.replace(/(\d{1,3})\s*(?:דקות|דק'|דק)(?=\s)/, (_, n) => { out.duration = Number(n); return ' '; });
  if (out.duration == null) {
    if (/(?:של|למשך|אורך)\s+שעה\s+וחצי/.test(t)) { out.duration = 90; t = t.replace(/(?:של|למשך|אורך)\s+שעה\s+וחצי/, ' '); }
    else if (/(?:של|למשך|אורך)\s+שעה(?=\s)/.test(t)) { out.duration = 60; t = t.replace(/(?:של|למשך|אורך)\s+שעה/, ' '); }
  }

  // Repeat.
  t = t.replace(/(?:ל\s*)?(\d{1,2})\s*שבועות/, (_, n) => { out.repeatWeeks = Number(n); return ' '; });
  if (out.repeatWeeks == null && /כל שבוע|שבועי|קבוע/.test(t)) {
    out.repeatWeeks = DEFAULT_REPEAT_WEEKS;
  }
  t = t.replace(/כל שבוע|שבועי|קבוע/g, ' ');

  // Capacity.
  t = t.replace(/(\d{1,3})\s*(?:משתתפות|משתתפים|מקומות|מתאמנות|מתאמנים|בנות|אנשים|נשים|איש)/, (_, n) => { out.capacity = Number(n); return ' '; });
  if (out.capacity == null) {
    t = t.replace(/(?:עד|מקסימום|מקס)\s+(\d{1,3})(?=\s)/, (_, n) => { out.capacity = Number(n); return ' '; });
  }

  // Registration opens now.
  if (/(?:הרשמה|לפתוח|פתיחה|פתוח)\s*(?:מיד|עכשיו|מיידית)/.test(t)) out.openNow = true;

  // Days.
  const nextWeek = /(?:ב)?שבוע הבא/.test(t);
  t = t.replace(/(?:ב)?שבוע הבא/g, ' ');
  if (/\s(?:ל|ב)?מחרתיים\s/.test(t)) dates.push(addDays(today, 2));
  else if (/\s(?:ל|ב)?מחר\s/.test(t)) dates.push(addDays(today, 1));
  if (/\s(?:ל|ב)?היום\s/.test(t)) dates.push(today);
  const dayIdx: number[] = [];
  for (const m of t.matchAll(/\s(?:ו?ב?|ו?ה?)(?:ימי?\s+|יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?=\s)/g)) {
    dayIdx.push(DAYS.indexOf(m[1]));
  }
  for (const m of t.matchAll(/\s(?:יום|ימי)\s+([אבגדהוש])'?(?=\s)/g)) dayIdx.push(DAY_LETTERS.indexOf(m[1]));
  for (const idx of dayIdx) {
    const ymd = nextWeek
      ? addDays(startOfWeek(today), 7 + idx)
      : addDays(today, ((idx - weekdayOf(today) + 7) % 7) || 7);
    if (!dates.includes(ymd)) dates.push(ymd);
  }
  if (dates.length) out.dates = [...new Set(dates)].sort();

  // Spoken time: "בשבע בערב", "ב 8 וחצי בבוקר", "בשעה 6".
  if (!time) {
    const m = t.match(/(?:\s|^)(?:ב|בשעה)?\s*(\d{1,2})(?:\s+(וחצי|ורבע|ועשרים|ועשר))?(?:\s+(בבוקר|בערב|בצהריים|בצהרים|אחה"צ|אחר הצהריים|בלילה))?(?=\s)/);
    if (m && Number(m[1]) <= 23) {
      const mins = { 'וחצי': 30, 'ורבע': 15, 'ועשרים': 20, 'ועשר': 10 }[m[2] as string] ?? 0;
      let h = Number(m[1]);
      const period = m[3];
      if (period && period !== 'בבוקר' && h < 12) h += 12;
      else if (!period && h >= 1 && h <= 5) h += 12;
      else if (!period && h >= 6 && h <= 11) out.warnings.push(`השעה ${hhmm(h, mins)}: הנחתי בוקר. לערב, אמרי "בערב".`);
      time = { h, m: mins, explicit24: true };
    }
  } else if (!time.explicit24) {
    if (/בערב|בצהריים|בצהרים|אחה"צ|אחר הצהריים|בלילה/.test(t) && time.h < 12) time.h += 12;
  }
  if (time && time.h < 24) out.time = hhmm(time.h, time.m);

  const missing: string[] = [];
  if (!out.kind) missing.push('סוג אימון');
  if (!out.dates) missing.push('יום');
  if (!out.time) missing.push('שעה');
  if (missing.length) out.warnings.unshift(`לא זיהיתי: ${missing.join(', ')}. כדאי לבחור בטופס.`);
  return out;
}
