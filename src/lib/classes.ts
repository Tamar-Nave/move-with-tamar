import { supabase } from '@/lib/supabase';

export type ClassRow = {
  id: string;
  kind: 'sculpt' | 'functional';
  starts_at: string;
  duration_min: number;
  capacity: number;
  registration_opens_at: string;
  cancel_hours_before: number;
  waitlist_confirm_minutes: number;
  notes: string | null;
  status: 'scheduled' | 'cancelled';
};

export type BookingStatus = 'booked' | 'waitlist' | 'offered' | 'cancelled';

export type MyBooking = { id: string; class_id: string; status: BookingStatus; offer_expires_at: string | null };

export type RosterEntry = {
  booking_id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  status: BookingStatus;
  queue_pos: number | null;
};

/** First name, plus the last name too but only when someone else in the list shares that first name. */
export function rosterDisplayName(entry: RosterEntry, list: RosterEntry[]): string {
  const sameFirstName = list.filter((x) => x.first_name === entry.first_name).length > 1;
  return sameFirstName && entry.last_name ? `${entry.first_name} ${entry.last_name}` : entry.first_name;
}

export const KIND_LABEL: Record<ClassRow['kind'], string> = { sculpt: 'SCULPT', functional: 'פונקציונלי' };

const ERRORS: Record<string, string> = {
  not_authenticated: 'צריך להיכנס מחדש.',
  class_unavailable: 'האימון הזה לא זמין.',
  class_started: 'האימון כבר התחיל.',
  registration_not_open: 'ההרשמה לאימון הזה עוד לא נפתחה.',
  no_active_membership: 'אין לך מנוי פעיל. כדאי לפנות לתמר.',
  already_registered: 'את כבר רשומה לאימון הזה.',
  no_entries_left: 'נגמרו הכניסות שלך החודש. כדאי לפנות לתמר.',
  offer_expired: 'ההצעה פגה, והמקום עבר לבאה בתור.',
  cancellation_closed: 'זמן הביטול עבר. לביטול כדאי לפנות לתמר.',
  booking_not_found: 'ההרשמה לא נמצאה.',
  forbidden: 'אין לך הרשאה לפעולה הזו.',
};

export function friendlyDbError(message: string | undefined): string {
  if (!message) return 'משהו השתנה. נסי שוב.';
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : 'משהו השתבש. נסי שוב.';
}

export async function fetchRoster(classId: string): Promise<RosterEntry[]> {
  const { data } = await supabase.rpc('class_roster', { p_class: classId });
  return (data as RosterEntry[] | null) ?? [];
}

export function spotsTaken(roster: RosterEntry[]) {
  return roster.filter((r) => r.status === 'booked' || r.status === 'offered').length;
}
export const waitlistCount = (roster: RosterEntry[]) => roster.filter((r) => r.status === 'waitlist').length;
