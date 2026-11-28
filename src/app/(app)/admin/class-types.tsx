import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ClassTypeBadge } from '@/components/class-type-badge';
import { Field } from '@/components/field';
import { LinkBtn } from '@/components/recipe-parts';
import { BackLink, Btn, Card, C, ErrorText, Label, Loading, Muted, Screen, Title } from '@/components/ui';
import { CLASS_TYPE_COLORS, type ClassTypeRow } from '@/lib/class-types';
import { friendlyDbError } from '@/lib/classes';
import { supabase } from '@/lib/supabase';

type Draft = { id: string | null; name: string; description: string; color: string; reminder_note: string; is_active: boolean };
const EMPTY: Draft = { id: null, name: '', description: '', color: CLASS_TYPE_COLORS[4], reminder_note: '', is_active: true };

export default function ClassTypesScreen() {
  const router = useRouter();
  const [types, setTypes] = useState<ClassTypeRow[] | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      supabase.from('class_types').select('*').order('created_at'),
      supabase.from('classes').select('type_id'),
    ]);
    if (t.error) { setError('לא הצלחנו לטעון את סוגי האימונים. נסי לרענן.'); return; }
    setTypes((t.data as ClassTypeRow[]) ?? []);
    const counts: Record<string, number> = {};
    for (const r of (c.data as { type_id: string | null }[] | null) ?? []) if (r.type_id) counts[r.type_id] = (counts[r.type_id] ?? 0) + 1;
    setUsage(counts);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin' as never));

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true); setError(null); setMsg(null);
    const fields = {
      name: editing.name.trim(), description: editing.description.trim(), color: editing.color,
      reminder_note: editing.reminder_note.trim() || null, is_active: editing.is_active,
    };
    const { error: err } = editing.id
      ? await supabase.from('class_types').update(fields).eq('id', editing.id)
      : await supabase.from('class_types').insert(fields);
    setBusy(false);
    if (err) { setError('לא הצלחנו לשמור. נסי שוב.'); return; }
    setMsg(editing.id ? '✓ הסוג עודכן. השם והצבע החדשים מופיעים גם באימונים שכבר שובצו.' : '✓ הסוג נוסף.');
    setEditing(null);
    load();
  }

  async function setActive(t: ClassTypeRow, active: boolean) {
    const { error: err } = await supabase.from('class_types').update({ is_active: active }).eq('id', t.id);
    if (err) setError('לא הצלחנו לעדכן. נסי שוב.'); else load();
  }

  async function remove(id: string) {
    const t = types?.find((x) => x.id === id);
    if (!t) return;
    setBusy(true); setError(null); setMsg(null);
    const n = usage[id] ?? 0;
    if (n === 0) {
      const { error: err } = await supabase.from('class_types').delete().eq('id', id);
      if (err) setError(friendlyDbError(err.message));
      else setMsg('✓ הסוג נמחק (לא היו לו אימונים).');
    } else {
      const { error: err } = await supabase.from('class_types').update({ is_active: false }).eq('id', id);
      if (err) setError('לא הצלחנו להסתיר. נסי שוב.');
      else setMsg(`הסוג הוסתר מטופס אימון חדש. ${n} אימונים שלו נשארו בלו״ז כרגיל.`);
    }
    setBusy(false);
    setEditing(null);
    load();
  }

  return (
    <Screen>
      <BackLink label="חזרה לניהול" onPress={back} />
      <Title>סוגי אימונים</Title>
      <Muted>הסוגים שנבחרים בעת הוספת אימון. שם, צבע ותיאור מוצגים בלו״ז של המתאמנות.</Muted>
      {msg && <Text accessibilityLiveRegion="polite" style={{ color: C.success, textAlign: 'right' }}>{msg}</Text>}
      {error && <ErrorText>{error}</ErrorText>}
      {!types && !error && <Loading />}

      {types?.map((t) => (
        <Card key={t.id} style={{ borderRightWidth: 6, borderRightColor: t.color, opacity: t.is_active ? 1 : 0.65 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <ClassTypeBadge type={t} />
            <Text style={{ fontSize: 12, color: C.textMuted }}>{usage[t.id] ?? 0} אימונים בלו״ז</Text>
          </View>
          {t.description ? <Text style={{ fontSize: 14, color: C.text, textAlign: 'right' }}>{t.description}</Text> : null}
          {t.reminder_note ? <Muted>הערת תזכורת: {t.reminder_note}</Muted> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <LinkBtn label="עריכה" onPress={() => { setMsg(null); setError(null); setEditing({ id: t.id, name: t.name, description: t.description, color: t.color, reminder_note: t.reminder_note ?? '', is_active: t.is_active }); }} />
            {!t.is_active && <LinkBtn label="החזרה לפעילים" onPress={() => setActive(t, true)} />}
          </View>
        </Card>
      ))}
      {types?.length === 0 && <Muted>עוד אין סוגי אימונים. אפשר להוסיף את הראשון.</Muted>}

      {types && !editing && <Btn label="+ סוג אימון חדש" onPress={() => { setMsg(null); setError(null); setEditing({ ...EMPTY }); }} />}

      {editing && (
        <Card style={{ gap: 12 }}>
          <Label>{editing.id ? 'עריכת סוג אימון' : 'סוג אימון חדש'}</Label>
          <Field label="שם האימון" value={editing.name} maxLength={60} onChangeText={(name) => setEditing({ ...editing, name })} />
          <Field label="תיאור האימון" value={editing.description} maxLength={400} onChangeText={(description) => setEditing({ ...editing, description })} multiline style={{ minHeight: 70, paddingTop: 10, textAlignVertical: 'top' }} />
          <Field label="הערת תזכורת (אופציונלי, תתווסף להתראה לפני האימון)" value={editing.reminder_note} maxLength={120} onChangeText={(reminder_note) => setEditing({ ...editing, reminder_note })} />
          <Label>צבע</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CLASS_TYPE_COLORS.map((c) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`צבע ${c}`} accessibilityState={{ selected: editing.color === c }} onPress={() => setEditing({ ...editing, color: c })}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: editing.color === c ? 3 : 0, borderColor: C.text }}>
                {editing.color === c && <Text style={{ color: '#fff', fontWeight: '600' }}>✓</Text>}
              </Pressable>
            ))}
          </View>
          <View style={{ borderRightWidth: 6, borderRightColor: editing.color, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 18, padding: 12, gap: 4 }}>
            <Muted>כך זה ייראה בלו״ז:</Muted>
            <ClassTypeBadge type={{ name: editing.name || 'שם האימון', color: editing.color, is_active: true }} />
            {editing.description ? <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right' }}>{editing.description}</Text> : null}
          </View>
          <Btn label="שמירה" busy={busy} disabled={!editing.name.trim()} onPress={save} />
          <Btn label="ביטול" variant="secondary" onPress={() => setEditing(null)} />
          {editing.id ? (
            <Btn variant="danger" busy={busy}
              label={(usage[editing.id] ?? 0) > 0 ? `מחיקה (יש ${usage[editing.id]} אימונים: הסוג יוסתר והם יישארו)` : 'מחיקת הסוג'}
              onPress={() => remove(editing.id!)} />
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
