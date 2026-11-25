import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Field } from '@/components/field';
import { NativePickerInput } from '@/components/form-inputs';
import { BackLink, Badge, Btn, Card, Chip, C, ErrorText, Label, Loading, Muted, Screen, Title } from '@/components/ui';
import { todayYmd } from '@/lib/dates';
import {
  PLAN_LABEL, endOfThisMonth, fetchMembersOverview, fullName, paymentReminderText, setPaidThisMonth, whatsAppUrl,
  type MemberOverview,
} from '@/lib/members';
import { supabase } from '@/lib/supabase';

export default function MemberScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id; // expo-router can hand back an array
  const router = useRouter();
  const [m, setM] = useState<MemberOverview | null>(null);
  const [plan, setPlan] = useState<'unlimited' | 'monthly_8'>('monthly_8');
  const [endsOn, setEndsOn] = useState(endOfThisMonth());
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetchMembersOverview();
    const found = r.members.find((x) => x.profile.id === id) ?? null;
    setM(found);
    setPhone(found?.profile.phone ?? '');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function run(label: string, fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setMsg(null);
    let error: unknown = null;
    try {
      ({ error } = await fn());
    } catch (e) {
      error = e;
    }
    setBusy(false);
    const detail = (error as { message?: string } | null)?.message;
    setMsg(error ? { ok: false, text: `משהו השתבש. נסי שוב.${detail ? ` (${detail})` : ''}` } : { ok: true, text: label });
    await load();
  }

  if (!m) return <Screen><Loading /></Screen>;
  const { profile, membership, entriesLeft, paidThisMonth } = m;
  const waChatUrl = whatsAppUrl(phone);
  const waReminderUrl = whatsAppUrl(phone, paymentReminderText(profile.first_name));

  const saveMembership = () =>
    run('המנוי נשמר.', async () => {
      // end any current plan, then start the new one
      const end = await supabase.from('memberships').update({ status: 'ended' }).eq('user_id', id).in('status', ['active', 'frozen']);
      if (end.error) return end;
      return supabase.from('memberships').insert({ user_id: id, plan, ends_on: endsOn, starts_on: todayYmd() });
    });

  const savePhone = () => run('הטלפון נשמר.', () => supabase.from('profiles').update({ phone: phone.trim() || null }).eq('id', id));
  const togglePaid = () => run(paidThisMonth ? 'סומן שעדיין לא שילמה.' : 'סומן ששילמה החודש.',
    () => setPaidThisMonth(id, !paidThisMonth));

  return (
    <Screen>
      <BackLink label="חזרה למתאמנות" onPress={() => router.back()} />
      <View>
        <Title>{fullName(profile)}</Title>
        <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right', writingDirection: 'ltr' }}>{profile.email}</Text>
      </View>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'right' }}>המנוי הנוכחי</Text>
        {membership ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge label={PLAN_LABEL[membership.plan]} tone="brand" />
              {membership.status === 'frozen' && <Badge label="מוקפא" tone="orange" />}
              {paidThisMonth !== null && (
                <Pressable accessibilityRole="button" accessibilityLabel={paidThisMonth ? 'סימון שעדיין לא שילמה' : 'סימון ששילמה החודש'}
                  disabled={busy} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ minHeight: 44, justifyContent: 'center' }}
                  onPress={togglePaid}>
                  <Badge label={paidThisMonth ? '✓ שולם' : 'לא שולם'} tone={paidThisMonth ? 'green' : 'red'} />
                </Pressable>
              )}
            </View>
            <Muted>בתוקף עד {membership.ends_on}{entriesLeft !== null ? ` · נשארו ${entriesLeft} כניסות החודש (כולל ${membership.bonus_entries} שהוספת)` : ''}</Muted>
            {membership.plan === 'monthly_8' && (
              <Btn label="+ הוספת כניסה אחת" variant="secondary" busy={busy}
                onPress={() => run('נוספה כניסה.', () => supabase.from('memberships').update({ bonus_entries: membership.bonus_entries + 1 }).eq('id', membership.id))} />
            )}
            {membership.status === 'active'
              ? <Btn label="הקפאת המנוי" variant="secondary" busy={busy} onPress={() => run('המנוי הוקפא.', () => supabase.from('memberships').update({ status: 'frozen' }).eq('id', membership.id))} />
              : <Btn label="ביטול ההקפאה" variant="secondary" busy={busy} onPress={() => run('ההקפאה בוטלה.', () => supabase.from('memberships').update({ status: 'active' }).eq('id', membership.id))} />}
            <Btn label="סיום המנוי" variant="danger" busy={busy} onPress={() => run('המנוי הסתיים.', () => supabase.from('memberships').update({ status: 'ended' }).eq('id', membership.id))} />
          </>
        ) : <Muted>אין מנוי פעיל. בלי מנוי היא לא יכולה להירשם לאימונים.</Muted>}
        {msg && (msg.ok ? <Text style={{ color: '#1F5F2E', textAlign: 'right' }}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText>)}
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'right' }}>{membership ? 'החלפה או חידוש מנוי' : 'הפעלת מנוי'}</Text>
        <Label>סוג מנוי</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label="8 כניסות בחודש" selected={plan === 'monthly_8'} onPress={() => { setPlan('monthly_8'); setEndsOn(endOfThisMonth()); }} />
          <Chip label="ללא הגבלה" selected={plan === 'unlimited'} onPress={() => { setPlan('unlimited'); setEndsOn(endOfThisMonth()); }} />
        </View>
        <Label>בתוקף עד</Label>
        <NativePickerInput type="date" label="בתוקף עד" value={endsOn} onChange={setEndsOn} />
        <Muted>שני סוגי המנוי נספרים לפי חודש קלנדרי: ברירת המחדל היא סוף החודש הנוכחי, וב־1 לחודש הבא צריך לחדש (וגם לסמן תשלום מחדש).</Muted>
        <Btn label="שמירת מנוי" busy={busy} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)} onPress={saveMembership} />
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'right' }}>טלפון ווואטסאפ</Text>
        <Field label="טלפון" ltr value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="050-1234567" />
        <Btn label="שמירת טלפון" variant="secondary" busy={busy} disabled={phone.trim() === (profile.phone ?? '')} onPress={savePhone} />
        {waChatUrl ? (
          <>
            <Btn label="💬 פתיחת צ'אט בוואטסאפ" variant="secondary" onPress={() => Linking.openURL(waChatUrl)} />
            {paidThisMonth === false && waReminderUrl && (
              <Btn label="💬 תזכורת תשלום בוואטסאפ" onPress={() => Linking.openURL(waReminderUrl)} />
            )}
          </>
        ) : <Muted>אין מספר טלפון שמור, אז אי אפשר לפתוח וואטסאפ. הוסיפי מספר למעלה ושמרי.</Muted>}
      </Card>

      {msg && (msg.ok ? <Text style={{ color: '#1F5F2E', textAlign: 'right' }}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText>)}
    </Screen>
  );
}
