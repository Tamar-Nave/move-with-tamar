import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Field } from '@/components/field';
import { C, BackLink, Btn, Chip, ErrorText, Label, Muted, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const AUDIENCES = [
  { value: 'all', label: 'כל המתאמנות' },
  { value: 'unlimited', label: 'מנוי ללא הגבלה' },
  { value: 'monthly_8', label: 'מנוי 8 כניסות' },
];

// Ready-made messages. Text in [square brackets] must be filled in before sending.
const TEMPLATES = [
  { name: 'שינוי בלו״ז', audience: 'all', title: 'שינוי בלו״ז', body: 'הי יפות, האימון של [יום] ב־[שעה] עובר ל־[שעה חדשה]. מתנצלת על אי הנוחות, נתראה!' },
  { name: 'אימון בוטל', audience: 'all', title: 'האימון מתבטל', body: 'הי יפות, האימון של [יום] ב־[שעה] מתבטל. מתנצלת! אפשר להירשם לאימון אחר באפליקציה.' },
  { name: 'התפנו מקומות', audience: 'all', title: 'התפנו מקומות', body: 'התפנו מקומות באימון של [יום] ב־[שעה]. מי שרוצה להצטרף, ההרשמה פתוחה באפליקציה.' },
  { name: 'נפתחה הרשמה', audience: 'all', title: 'ההרשמה לשבוע הבא נפתחה', body: 'הי יפות, ההרשמה לאימונים של השבוע הבא פתוחה עכשיו באפליקציה. מוזמנות לתפוס מקום!' },
  { name: 'אימון חדש בלו״ז', audience: 'all', title: 'אימון חדש בלו״ז', body: 'נוסף אימון חדש: [סוג אימון] ב־[יום] ב־[שעה]. מוזמנות להירשם באפליקציה.' },
  { name: 'סטודיו סגור', audience: 'all', title: 'הסטודיו סגור', body: 'הי יפות, הסטודיו סגור ב־[תאריכים] ([סיבה]). חוזרים לפעילות ב־[תאריך]. נתראה!' },
  { name: 'כניסות נגמרות', audience: 'monthly_8', title: 'נשארו מעט כניסות', body: 'הי יפות, נשארו לכן מעט כניסות החודש. לחידוש המנוי אפשר לפנות אליי.' },
  { name: 'חידוש מנוי', audience: 'all', title: 'חידוש מנוי', body: 'הי יפות, המנוי מתחדש ב־[תאריך]. אשמח לעדכן אתכן ולחדש. אפשר לפנות אליי.' },
  { name: 'מתכון חדש', audience: 'all', title: 'מתכון חדש באפליקציה', body: 'הוספתי מתכון חדש: [שם המתכון]. אפשר למצוא אותו בלשונית "מתכונים".' },
  { name: 'ברוכה הבאה', audience: 'all', title: 'ברוכה הבאה!', body: 'שמחה שהצטרפת! אפשר להירשם לאימונים בלשונית "לו״ז". אם יש שאלות, אני כאן.' },
  { name: 'חג שמח', audience: 'all', title: 'חג שמח!', body: 'הי יפות, חג שמח לכן ולמשפחות! [פרטי שעות הפעילות בחג]' },
  { name: 'מוטיבציה', audience: 'all', title: 'שבוע חדש, כוח חדש', body: 'הי יפות, שבוע חדש מתחיל. מחכה לכן באימונים!' },
  { name: 'תזכורת תשלום', audience: 'all', title: 'תזכורת: חידוש מנוי לחודש', body: 'הי יפות, התחיל חודש חדש. מי שעוד לא חידשה/שילמה, אשמח שתעשו את זה בהקדם. תודה!' },
  { name: 'שינוי שעת אימון', audience: 'all', title: 'עדכון: שינוי שעת אימון', body: 'הי יפות, החל מ־[תאריך], השעה של [סוג אימון] ביום [יום] משתנה ל־[שעה חדשה]. מקווה שתמשיכו להצטרף!' },
  { name: 'תזכורת ציוד', audience: 'all', title: 'לא לשכוח', body: 'הי יפות, תזכורת להביא [פריט ציוד] לאימון הקרוב. נתראה!' },
];

export default function NewMessageScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const hasPlaceholders = /\[[^\]]*\]/.test(title + body);

  async function send() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('messages').insert({ title: title.trim(), body: body.trim(), audience });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: 'לא הצלחנו לשלוח. נסי שוב.' }); return; }
    setMsg({ ok: true, text: '✓ ההודעה נשלחה. היא מופיעה במסך הבית של המתאמנות, ומגיעה אליהן כהתראה.' });
    setTitle(''); setBody('');
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/admin' as never)), 1100);
  }

  return (
    <Screen>
      <BackLink label="חזרה לניהול" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin' as never))} />
      <Title>הודעה חדשה</Title>

      <Label>תבניות מוכנות (לחצי כדי למלא)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TEMPLATES.map((t) => (
          <Chip key={t.name} label={t.name} selected={title === t.title && body === t.body}
            onPress={() => { setTitle(t.title); setBody(t.body); setAudience(t.audience); setMsg(null); }} />
        ))}
      </View>

      <Label>למי לשלוח?</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {AUDIENCES.map((a) => <Chip key={a.value} label={a.label} selected={audience === a.value} onPress={() => setAudience(a.value)} />)}
      </View>
      <Field label="כותרת" value={title} onChangeText={setTitle} />
      <Field label="תוכן ההודעה" value={body} onChangeText={setBody} multiline style={{ minHeight: 110, paddingTop: 10, textAlignVertical: 'top' }} />
      {hasPlaceholders && <Text style={{ color: C.warning, fontSize: 14, textAlign: 'right' }}>יש בהודעה שדות להשלמה בסוגריים מרובעים. אפשר לשלוח רק אחרי שמחליפים אותם בפרטים.</Text>}
      <Muted>המתאמנות לא יכולות להגיב להודעה.</Muted>
      {msg && (msg.ok ? <Text style={{ color: C.success, textAlign: 'right' }}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText>)}
      <Btn label="שליחה" busy={busy} disabled={!title.trim() || !body.trim() || hasPlaceholders} onPress={send} />
    </Screen>
  );
}
