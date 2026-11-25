import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Badge, Btn, Card, C, ErrorText, Muted } from '@/components/ui';
import { disablePush, enablePush, getPushState, sendTestNotification, type PushState } from '@/lib/push';

/** Turn push notifications on or off for this device. */
export function NotificationSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => { getPushState().then(setState).catch(() => setState('unsupported')); }, []);

  async function run(fn: () => Promise<PushState>) {
    setBusy(true);
    setError(null);
    try { setState(await fn()); } catch { setError('לא הצלחנו להפעיל התראות. נסי שוב.'); }
    setBusy(false);
  }

  async function test() {
    setTestSent(false);
    const { error: err } = await sendTestNotification();
    if (err) setError('לא הצלחנו לשלוח התראת ניסיון.'); else setTestSent(true);
  }

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>התראות</Text>
        {state === 'on' && <Badge label="מופעלות" tone="green" />}
      </View>
      <Muted>תזכורת לפני אימון, הודעות מתמר, ועדכון כשמתפנה לך מקום ברשימת המתנה.</Muted>

      {state === 'ios-install' && (
        <View style={{ backgroundColor: C.primarySoft, borderRadius: 12, padding: 12, gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'right' }}>באייפון צריך קודם להוסיף את האפליקציה למסך הבית</Text>
          <Text style={{ fontSize: 14, color: '#3D3A36', textAlign: 'right', lineHeight: 21 }}>
            1. פותחים את האתר ב־Safari.{'\n'}
            2. לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה).{'\n'}
            3. בוחרים "הוספה למסך הבית" ולוחצים "הוספה".{'\n'}
            4. פותחים את האפליקציה מהאייקון החדש, וחוזרים לכאן להפעיל התראות.
          </Text>
        </View>
      )}
      {state === 'unsupported' && <Muted>הדפדפן הזה לא תומך בהתראות. אפשר לנסות ב־Chrome או ב־Safari.</Muted>}
      {state === 'denied' && <Muted>ההתראות חסומות בדפדפן. כדי להפעיל אותן, צריך לאפשר התראות לאתר בהגדרות הדפדפן.</Muted>}

      {error && <ErrorText>{error}</ErrorText>}
      {state === 'off' && <Btn label="הפעלת התראות" busy={busy} onPress={() => run(enablePush)} />}
      {state === 'on' && (
        <>
          <Btn label="שליחת התראת ניסיון" variant="secondary" onPress={test} />
          {testSent && <Muted>נשלחה. היא אמורה להגיע תוך דקה.</Muted>}
          <Btn label="כיבוי התראות במכשיר הזה" variant="secondary" busy={busy} onPress={() => run(disablePush)} />
        </>
      )}
    </Card>
  );
}
