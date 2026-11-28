import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BackLink, Btn, Card, C, ErrorText, Label, Loading, Muted, Screen, Title } from '@/components/ui';
import { siteOrigin } from '@/lib/calendar';
import { supabase } from '@/lib/supabase';

const STEPS = [
  'פתחי את Google Calendar במחשב (calendar.google.com).',
  'בצד, ליד "יומנים אחרים", לחצי על + ובחרי "מכתובת URL".',
  'הדביקי את הקישור שהעתקת, ולחצי "הוספת יומן".',
  'היומן יופיע גם באפליקציית גוגל קלנדר בטלפון, באותו חשבון גוגל.',
];

export default function StudioCalendarScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    supabase.rpc('my_calendar_token').then(({ data, error: err }) => {
      if (err || typeof data !== 'string') setError('לא הצלחנו לטעון את הקישור. נסי לרענן.');
      else setToken(data);
    });
  }, []);

  const url = token ? `${siteOrigin()}/calendar/admin/${token}.ics` : '';

  async function copy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function reset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    const { data, error: err } = await supabase.rpc('reset_calendar_token');
    setConfirmReset(false);
    if (err || typeof data !== 'string') { setError('לא הצלחנו ליצור קישור חדש.'); return; }
    setToken(data);
  }

  return (
    <Screen>
      <BackLink label="חזרה לניהול" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin' as never))} />
      <Title>יומן גוגל של הסטודיו</Title>
      <Muted>קישור שמראה ביומן שלך את כל האימונים בלו״ז: אימון חדש, שינוי שעה וביטול. מחברים אותו פעם אחת.</Muted>

      {error && <ErrorText>{error}</ErrorText>}
      {!token && !error && <Loading />}

      {token && (
        <>
          <Card style={{ gap: 10 }}>
            <Label>הקישור שלך</Label>
            <Text selectable style={{ fontSize: 13, color: C.textMuted, textAlign: 'left', writingDirection: 'ltr' }}>{url}</Text>
            <Btn label={copied ? '✓ הועתק' : 'העתקת הקישור'} onPress={copy} />
          </Card>

          <Card style={{ gap: 8 }}>
            <Label>איך מחברים ל-Google Calendar</Label>
            {STEPS.map((s, i) => (
              <View key={s} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontSize: 15, color: C.primaryDark, fontWeight: '600' }}>{i + 1}.</Text>
                <Text style={{ flex: 1, fontSize: 15, color: C.text, textAlign: 'right' }}>{s}</Text>
              </View>
            ))}
          </Card>

          <Card style={{ gap: 6 }}>
            <Label>חשוב לדעת</Label>
            <Muted>גוגל מעדכנת יומנים שמחוברים בקישור בקצב שלה, בדרך כלל אחרי כמה שעות ולפעמים עד יום. אימון חדש לא יופיע ביומן ברגע שהוספת אותו, ואי אפשר להאיץ את זה. להוספה מיידית של אימון אחד יש כפתור "הוספה ליומן" בדף האימון.</Muted>
            <Muted>אימון שבוטל נעלם מהיומן. הקישור סודי: מי שיש לה אותו רואה את כל האימונים (לא את שמות המתאמנות).</Muted>
          </Card>

          <Btn variant="secondary" label={confirmReset ? 'בטוחה? הקישור הישן יפסיק לעבוד. לחצי שוב' : 'יצירת קישור חדש (אם הקישור דלף)'} onPress={reset} />
        </>
      )}
    </Screen>
  );
}
