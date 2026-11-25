import { supabase } from '@/lib/supabase';

/** Whether the signed-in session still needs a TOTP code before it's fully trusted. */
export async function getMfaPending(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return !!data.nextLevel && data.nextLevel !== data.currentLevel;
}

/** The user's verified TOTP factor, if they ever finished setting one up. */
export async function getTotpFactor() {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.[0] ?? null;
}

export async function enrollTotp() {
  // A unique name each time — otherwise retrying after a cancelled/failed attempt collides with the
  // leftover unverified factor from the previous try ("a factor with this name already exists").
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Move with Tamar',
    friendlyName: `admin-totp-${Date.now()}`,
  });
  if (error) throw error;
  return { factorId: data.id, secret: data.totp.secret, qrCode: data.totp.qr_code };
}

/** Used both to finish enrolling a new factor and to pass the login-time challenge — same call either way. */
export async function challengeAndVerify(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw error;
}

export async function unenrollTotp(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
