// Health declaration: the app only knows whether the studio owner approved it, and when (migration 022).
import { todayYmd } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

/** The blank Ministry of Health form, served by the app itself (public/health-declaration.pdf). */
const FORM_URL = '/health-declaration.pdf';
const FORM_NAME = 'הצהרת-בריאות.pdf';

let form: File | null = null;
let loading: Promise<File | null> | null = null;

/**
 * Fetches the form ahead of time. iPhones only open the share sheet straight from a tap, so the file
 * has to be in memory already when the button is pressed.
 */
export function preloadHealthForm(): Promise<File | null> {
  if (form || typeof File === 'undefined') return Promise.resolve(form);
  loading ??= fetch(FORM_URL)
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('form unavailable'))))
    .then((blob) => (form = new File([blob], FORM_NAME, { type: 'application/pdf' })))
    .catch(() => { loading = null; return null; });
  return loading;
}

/** A normal download: the browser shows it, and the file lands in the device's downloads. */
function downloadHealthForm(): string {
  const a = document.createElement('a');
  a.href = FORM_URL;
  a.download = FORM_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return 'אם הטלפון שואל, לוחצים "הורדה". את הקובץ פותחים מתיקיית "הורדות" (באייפון: באפליקציית "קבצים").';
}

/**
 * Saves the blank form. In a browser this is a download. In the app on a phone's home screen downloads
 * don't work, so the share sheet is used there ("save to files", print, send).
 * (On computers the browser's share window may never open and never answer, so it isn't used there.)
 * Returns a message to show, or null when there is nothing to add.
 */
export async function saveHealthForm(useShareSheet: boolean): Promise<string | null> {
  if (!useShareSheet) return downloadHealthForm();
  const file = form ?? (await preloadHealthForm());
  if (!file) return 'לא הצלחנו לטעון את הטופס. בדקי את החיבור ונסי שוב.';
  if (!navigator.canShare?.({ files: [file] })) return downloadHealthForm();
  try {
    await navigator.share({ files: [file] });
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'AbortError') return null; // she closed the share sheet
    return name === 'NotAllowedError' ? 'לחצי שוב על "שמירת הטופס".' : downloadHealthForm();
  }
  return null;
}

const VALID_YEARS = 2;

/** An approval counts until the same date two years later. Dates are YYYY-MM-DD, so they compare as text. */
export function isHealthValid(approvedOn: string | null | undefined, today: string = todayYmd()): boolean {
  if (!approvedOn) return false;
  const expires = `${Number(approvedOn.slice(0, 4)) + VALID_YEARS}${approvedOn.slice(4)}`;
  return today < expires;
}

/** null = couldn't check (offline, or the table isn't there yet). Callers then show nothing rather than nag. */
export async function fetchMyHealthApproved(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('health_declarations').select('approved_on').eq('user_id', userId).maybeSingle();
  if (error) return null;
  return isHealthValid((data as { approved_on: string } | null)?.approved_on);
}

export const setHealthApproved = (userId: string, approved: boolean) =>
  approved
    ? supabase.from('health_declarations').upsert({ user_id: userId, approved_on: todayYmd() }, { onConflict: 'user_id' })
    : supabase.from('health_declarations').delete().eq('user_id', userId);

export const healthReminderText = (firstName: string) =>
  `היי ${firstName} מה שלומך?😊 \nרק תזכורת קטנה למלא ולחתום על הצהרת הבריאות ולהעביר אליי. את הטופס אפשר לפתוח באפליקציה, בפרופיל🙏 \nתודה🤍`;
