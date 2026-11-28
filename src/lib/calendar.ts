import { Linking, Platform } from 'react-native';

import { BRAND } from '@/lib/brand';
import { classLabel, type ClassRow } from '@/lib/classes';

const z = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}T${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z`;

export function isIosDevice(): boolean {
  if (Platform.OS === 'ios') return true;
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** One-tap "add this class to Google Calendar" (the calendar on Android phones). */
export function googleCalendarUrl(c: ClassRow): string {
  const start = new Date(c.starts_at);
  const end = new Date(start.getTime() + c.duration_min * 60000);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${classLabel(c)} · ${BRAND.name}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: c.notes && c.notes !== '[demo]' ? c.notes : 'נתראה באימון!',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function siteOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return BRAND.siteUrl;
}

/**
 * Opens the calendar file for one class. On an iPhone it must load in the same window: from an app on the
 * home screen, a new window opens an empty browser view instead of the "Add to Calendar" screen.
 */
export function openAppleCalendar(c: ClassRow) {
  const url = appleCalendarUrl(c);
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(url);
  else Linking.openURL(url);
}

/**
 * For Android phones without Google Calendar (Samsung and others) and for computers: saves the same
 * calendar file; opening it adds the class to whichever calendar app the device has.
 */
export function downloadCalendarFile(c: ClassRow) {
  const url = appleCalendarUrl(c);
  if (Platform.OS !== 'web' || typeof document === 'undefined') { Linking.openURL(url); return; }
  const a = document.createElement('a');
  a.href = url;
  a.download = 'move-with-tamar-class.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** One-tap "add this class to the iPhone calendar": a calendar file the iPhone opens in its Calendar app. */
export function appleCalendarUrl(c: ClassRow): string {
  // `k` (old kind) is kept for classes that still have one, `t` (the type's name) is what new classes use.
  const q = new URLSearchParams({ id: c.id, t: classLabel(c).slice(0, 60), s: c.starts_at, d: String(c.duration_min) });
  if (c.kind) q.set('k', c.kind);
  return `${siteOrigin()}/calendar/event.ics?${q.toString()}`;
}
