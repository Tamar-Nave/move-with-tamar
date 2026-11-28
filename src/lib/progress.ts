// A member's attendance summary for the profile page. Only classes the admin marked "הגיעה" count.
import { addDays, israelToDate, startOfWeek, todayYmd, ymdOf } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type Progress = {
  month: number;        // attended classes this calendar month
  total: number;        // attended classes ever
  streakWeeks: number;  // consecutive weeks (Sunday-Saturday) with at least one attended class
};

export type GoalPlan = { plan: 'unlimited' | 'monthly_8'; entries_per_month: number } | null;

/** Counts from the start times of the classes the member attended. `today` is YYYY-MM-DD (Israel). */
export function computeProgress(attendedStarts: string[], today: string = todayYmd()): Progress {
  const days = attendedStarts.map((s) => ymdOf(new Date(s)));
  const month = days.filter((d) => d.slice(0, 7) === today.slice(0, 7)).length;
  const weeks = new Set(days.map((d) => startOfWeek(d)));
  // The week in progress doesn't break a streak: if nothing is marked in it yet, count back from last week.
  let cursor = startOfWeek(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streakWeeks = 0;
  while (weeks.has(cursor)) { streakWeeks++; cursor = addDays(cursor, -7); }
  return { month, total: days.length, streakWeeks };
}

/** An unlimited plan earns "מצטיינת" from this many attended classes in a month. */
export const UNLIMITED_EXCELLENT = 10;

/** "מצטיינת": 75% or more of an 8-entry card, or 10 classes on an unlimited plan. Starts over every month, because `month` does. */
export function isExcellent(p: Progress, plan: GoalPlan): boolean {
  if (!plan) return false;
  if (plan.plan === 'unlimited') return p.month >= UNLIMITED_EXCELLENT;
  return plan.entries_per_month > 0 && p.month / plan.entries_per_month >= 0.75;
}

export async function fetchMyProgress(userId: string): Promise<{ progress: Progress; plan: (GoalPlan & { ends_on: string }) | null }> {
  const today = todayYmd();
  const [b, m] = await Promise.all([
    supabase.from('bookings').select('classes!inner(starts_at)').eq('user_id', userId).eq('attended', true),
    supabase.from('memberships').select('plan, entries_per_month, ends_on').eq('user_id', userId).eq('status', 'active')
      .lte('starts_on', today).gte('ends_on', today).order('created_at', { ascending: false }).limit(1),
  ]);
  const starts = ((b.data as unknown as { classes: { starts_at: string } }[] | null) ?? []).map((x) => x.classes.starts_at);
  const plan = ((m.data as (NonNullable<GoalPlan> & { ends_on: string })[] | null) ?? [])[0] ?? null;
  return { progress: computeProgress(starts, today), plan };
}

/**
 * Registrations that take an entry this month (Israel time), future classes included.
 * Same rule as entries_left in the database: cancelled classes don't count.
 * `charged` is what an 8-entry card has used; `booked` is the count shown on an unlimited plan.
 */
export async function fetchMonthUsage(userId: string): Promise<{ charged: number; booked: number }> {
  const first = `${todayYmd().slice(0, 7)}-01`;
  const next = `${addDays(first, 32).slice(0, 7)}-01`;
  const { data } = await supabase.from('bookings').select('status, charged, classes!inner(starts_at, status)')
    .eq('user_id', userId).neq('classes.status', 'cancelled')
    .gte('classes.starts_at', israelToDate(first, '00:00').toISOString())
    .lt('classes.starts_at', israelToDate(next, '00:00').toISOString());
  const rows = (data as unknown as { status: string; charged: boolean }[] | null) ?? [];
  return { charged: rows.filter((x) => x.charged).length, booked: rows.filter((x) => x.status === 'booked').length };
}
