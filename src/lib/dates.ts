// Calendar helpers. The studio runs on Israel time; calendar-day math is done on "YYYY-MM-DD" strings.
export const TZ = 'Asia/Jerusalem';

const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function parts(date: Date) {
  const o: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(date)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o;
}

/** Calendar day (Israel time) of an instant, as YYYY-MM-DD. */
export function ymdOf(date: Date): string {
  const p = parts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export const todayYmd = () => ymdOf(new Date());

const utcNoon = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

export function addDays(ymd: string, n: number): string {
  const d = utcNoon(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (ymd: string) => utcNoon(ymd).getUTCDay();
export const startOfWeek = (ymd: string) => addDays(ymd, -weekdayOf(ymd)); // weeks start on Sunday
export const dayShort = (ymd: string) => DAY_SHORT[weekdayOf(ymd)];
export const dayLong = (ymd: string) => DAY_LONG[weekdayOf(ymd)];
export const dayNumber = (ymd: string) => Number(ymd.slice(8, 10));
/** "2027-03-31" -> "31/03" (Israeli order). */
export const shortDate = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
/** "2027-03-31" -> "31/03/2027". */
export const fullDate = (ymd: string) => `${shortDate(ymd)}/${ymd.slice(0, 4)}`;

export function dayMonthLabel(ymd: string): string {
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utcNoon(ymd));
}

export function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const month = (s: string) => new Intl.DateTimeFormat('he-IL', { month: 'long', timeZone: 'UTC' }).format(utcNoon(s));
  const a = dayNumber(weekStart);
  const b = dayNumber(end);
  return month(weekStart) === month(end)
    ? `${a}–${b} ב${month(end)} ${end.slice(0, 4)}`
    : `${a} ב${month(weekStart)} – ${b} ב${month(end)} ${end.slice(0, 4)}`;
}

export function timeLabel(iso: string | Date): string {
  const p = parts(typeof iso === 'string' ? new Date(iso) : iso);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  const day = ymdOf(d);
  return `${dayLong(day)} ${dayMonthLabel(day)} · ${timeLabel(d)}`;
}

function offsetMinutes(at: Date): number {
  const p = parts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Israel wall-clock date + time -> real instant. */
export function israelToDate(ymd: string, hhmm: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, h, mi);
  let t = naive - offsetMinutes(new Date(naive)) * 60000;
  t = naive - offsetMinutes(new Date(t)) * 60000;
  return new Date(t);
}
