import { addDays, israelToDate, todayYmd } from '@/lib/dates';
import { isHealthValid } from '@/lib/health';
import { supabase } from '@/lib/supabase';

export type MemberProfile = { id: string; email: string; first_name: string; last_name: string | null; phone: string | null; is_admin: boolean };
export type Membership = {
  id: string; user_id: string; plan: 'unlimited' | 'monthly_8'; entries_per_month: number; bonus_entries: number;
  starts_on: string; ends_on: string; status: 'active' | 'frozen' | 'ended';
};
export type Invite = { email: string; first_name: string; last_name: string | null };

export type MemberOverview = {
  profile: MemberProfile;
  membership: Membership | null;
  entriesLeft: number | null; // null = unlimited or no plan
  bonusThisMonth: number; // entries added by hand for the current month
  paidThisMonth: boolean | null; // null = not relevant (no active membership this calendar month)
  healthApproved: boolean | null; // null = not relevant (the admin) or couldn't check
};

export const PLAN_LABEL = { unlimited: 'ללא הגבלה', monthly_8: '8 כניסות בחודש' } as const;
export const fullName = (p: { first_name: string; last_name: string | null }) => `${p.first_name} ${p.last_name ?? ''}`.trim();

function monthBounds() {
  const today = todayYmd();
  const first = `${today.slice(0, 7)}-01`;
  const next = addDays(first, 32).slice(0, 7) + '-01';
  return { first, next, last: addDays(next, -1) };
}
export const endOfThisMonth = () => monthBounds().last;
export const currentYearMonth = () => todayYmd().slice(0, 7);

export async function fetchMembersOverview(): Promise<{ members: MemberOverview[]; pending: Invite[] }> {
  const { first, next } = monthBounds();
  const today = todayYmd();
  const ym = currentYearMonth();
  const [p, m, b, inv, pay, health, bonus] = await Promise.all([
    supabase.from('profiles').select('id, email, first_name, last_name, phone, is_admin').order('first_name'),
    supabase.from('memberships').select('*').in('status', ['active', 'frozen']).order('created_at', { ascending: false }),
    // a cancelled class gives the entry back, so it doesn't count (same rule as entries_left, migration 021)
    supabase.from('bookings').select('user_id, classes!inner(starts_at, status)').eq('charged', true).neq('classes.status', 'cancelled')
      .gte('classes.starts_at', israelToDate(first, '00:00').toISOString()).lt('classes.starts_at', israelToDate(next, '00:00').toISOString()),
    supabase.from('invites').select('email, first_name, last_name'),
    supabase.from('membership_payments').select('user_id').eq('year_month', ym),
    supabase.from('health_declarations').select('user_id, approved_on'),
    supabase.from('membership_bonus').select('membership_id, entries').eq('month', first),
  ]);
  const profiles = (p.data as MemberProfile[]) ?? [];
  const memberships = (m.data as Membership[]) ?? [];
  const paid = new Set(((pay.data as { user_id: string }[]) ?? []).map((x) => x.user_id));
  const approvals = new Map(((health.data as { user_id: string; approved_on: string }[]) ?? []).map((x) => [x.user_id, x.approved_on]));
  const bonuses = new Map(((bonus.data as { membership_id: string; entries: number }[]) ?? []).map((x) => [x.membership_id, x.entries]));
  const used: Record<string, number> = {};
  for (const row of (b.data as { user_id: string }[]) ?? []) used[row.user_id] = (used[row.user_id] ?? 0) + 1;

  const members = profiles.map((profile) => {
    const membership = memberships.find((x) => x.user_id === profile.id && x.starts_on <= today && x.ends_on >= today) ?? null;
    // before migration 023 has run, the old column still holds the bonus
    const bonusThisMonth = !membership ? 0 : bonus.error ? membership.bonus_entries : bonuses.get(membership.id) ?? 0;
    const entriesLeft =
      membership?.plan === 'monthly_8' ? membership.entries_per_month + bonusThisMonth - (used[profile.id] ?? 0) : null;
    const paidThisMonth = membership && membership.status === 'active' ? paid.has(profile.id) : null;
    const healthApproved = health.error || profile.is_admin ? null : isHealthValid(approvals.get(profile.id));
    return { profile, membership, entriesLeft, bonusThisMonth, paidThisMonth, healthApproved };
  });
  const joined = new Set(profiles.map((x) => x.email.toLowerCase()));
  const pending = ((inv.data as Invite[]) ?? []).filter((i) => !joined.has(i.email.toLowerCase()));
  return { members, pending };
}

export const setPaidThisMonth = (userId: string, paid: boolean) =>
  paid
    ? supabase.from('membership_payments').upsert({ user_id: userId, year_month: currentYearMonth() }, { onConflict: 'user_id,year_month' })
    : supabase.from('membership_payments').delete().eq('user_id', userId).eq('year_month', currentYearMonth());

// Israeli phone -> international digits for wa.me (e.g. "050-123-4567" -> "972501234567").
export function whatsAppDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

export const paymentReminderText = (firstName: string) =>
  `היי ${firstName} מה שלומך?😊 \nרק תזכורת קטנה לגבי תשלום המנוי החודשי בסטודיו. אשמח שתסדירי אותו בהקדם🙏 \nתודה🤍`;

export function whatsAppUrl(phone: string | null | undefined, text?: string): string | null {
  const num = whatsAppDigits(phone);
  if (!num) return null;
  return text ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : `https://wa.me/${num}`;
}
