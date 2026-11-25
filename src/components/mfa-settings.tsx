import { useEffect, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';

import { Badge, Btn, Card, C, ErrorText, Muted } from '@/components/ui';
import { challengeAndVerify, enrollTotp, getTotpFactor, unenrollTotp } from '@/lib/mfa';

/** Puts Supabase's QR exactly as given straight into the page (web only — this app has no native
 * build), instead of converting it to a data URI first. Two different conversions in a row came out
 * blank or unscannable, so this skips the conversion step entirely. */
function QrCode({ svg }: { svg: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !ref.current) return;
    ref.current.innerHTML = svg;
  }, [svg]);
  return <View ref={ref as never} style={{ width: 260, height: 260 }} />;
}

/** Admin-only: turn TOTP (Google Authenticator / Authy / 1Password, etc.) on or off for this account.
 * Shown only in the admin's own profile — members never see this. */
export function MfaSettings() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ factorId: string; secret: string; qrCode: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const factor = await getTotpFactor();
    setFactorId(factor?.id ?? null);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      setEnrolling(await enrollTotp());
    } catch (err) {
      setError(`לא הצלחנו להתחיל הרשמה: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBusy(false);
  }

  async function confirmEnroll() {
    if (!enrolling) return;
    setBusy(true);
    setError(null);
    try {
      await challengeAndVerify(enrolling.factorId, code);
      setEnrolling(null);
      setCode('');
      setMsg('אימות דו-שלבי הופעל.');
      await refresh();
    } catch (err) {
      setError(`הקוד לא נכון, או: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBusy(false);
  }

  async function remove() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      await unenrollTotp(factorId);
      setMsg('אימות דו-שלבי בוטל.');
      await refresh();
    } catch {
      setError('לא הצלחנו לבטל. נסי שוב.');
    }
    setBusy(false);
  }

  if (loading) return null;

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>אימות דו-שלבי</Text>
        {factorId && !enrolling && <Badge label="מופעל" tone="green" />}
      </View>
      <Muted>שכבת הגנה נוספת לחשבון הניהול: בכניסה תתבקשי גם קוד מאפליקציית אימות, בנוסף לסיסמה או לקוד במייל.</Muted>

      {error && <ErrorText>{error}</ErrorText>}
      {msg && <Text style={{ color: '#1F5F2E', textAlign: 'right' }}>{msg}</Text>}

      {!factorId && !enrolling && <Btn label="הפעלת אימות דו-שלבי" busy={busy} onPress={startEnroll} />}

      {enrolling && (
        <View style={{ gap: 10 }}>
          <Text style={{ textAlign: 'right', color: C.text }}>
            פתחי אפליקציית אימות (Google Authenticator, NetIQ Auth, Authy, 1Password וכו׳) והוסיפי חשבון חדש — בסריקת הקוד הזה:
          </Text>
          <View style={{ alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12 }}>
            <QrCode svg={enrolling.qrCode} />
          </View>
          <Muted>אם האפליקציה שלך לא תומכת בסריקה, או מעדיפה הזנה ידנית — זה המפתח:</Muted>
          <View style={{ backgroundColor: C.primarySoft, borderRadius: 10, padding: 12 }}>
            <Text selectable style={{ writingDirection: 'ltr', textAlign: 'center', fontSize: 16, letterSpacing: 2, color: C.text }}>
              {enrolling.secret}
            </Text>
          </View>
          <Muted>כתבי את המפתח הזה גם במקום בטוח נוסף (למשל מחברת) — אם המכשיר שלך יאבד, זו הדרך היחידה לשחזר גישה לניהול.</Muted>
          <Text style={{ textAlign: 'right', color: C.text, marginTop: 2 }}>לאחר ההוספה, הזיני כאן את הקוד בן 6 הספרות שמוצג באפליקציה:</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={{
              minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
              textAlign: 'center', fontSize: 22, letterSpacing: 6, color: C.text,
            }}
          />
          <Btn label="אישור והפעלה" busy={busy} disabled={code.trim().length < 6} onPress={confirmEnroll} />
          <Btn label="ביטול" variant="secondary" onPress={() => { setEnrolling(null); setCode(''); setError(null); }} />
        </View>
      )}

      {factorId && !enrolling && <Btn label="כיבוי אימות דו-שלבי" variant="secondary" busy={busy} onPress={remove} />}
    </Card>
  );
}
