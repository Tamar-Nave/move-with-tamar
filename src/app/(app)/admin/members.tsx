import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Field } from '@/components/field';
import { Badge, BackLink, Btn, Card, Chip, C, ErrorText, IconBtn, Label, Loading, Muted, Screen, Title } from '@/components/ui';
import {
  PLAN_LABEL, fetchMembersOverview, fullName, paymentReminderText, setPaidThisMonth, whatsAppUrl,
  type Invite, type MemberOverview,
} from '@/lib/members';
import { supabase } from '@/lib/supabase';

export default function MembersScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberOverview[] | null>(null);
  const [pending, setPending] = useState<Invite[]>([]);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [invitePlan, setInvitePlan] = useState<'none' | 'unlimited' | 'monthly_8'>('none');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetchMembersOverview();
    setMembers(r.members);
    setPending(r.pending);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function togglePaid(m: MemberOverview, next: boolean) {
    setToggleError(null);
    setMembers((prev) => prev?.map((x) => (x.profile.id === m.profile.id ? { ...x, paidThisMonth: next } : x)) ?? prev);
    let error: unknown = null;
    try {
      ({ error } = await setPaidThisMonth(m.profile.id, next));
    } catch (e) {
      error = e;
    }
    if (error) {
      setToggleError(`לא הצלחנו לעדכן את ${fullName(m.profile)}. נסי שוב, ואם זה חוזר תגידי לי.`);
      load(); // revert to the real state
    }
  }

  const cleanEmail = email.trim().toLowerCase();
  const valid = first.trim().length > 0 && /^\S+@\S+\.\S+$/.test(cleanEmail);

  async function invite() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('invites').insert({
      email: cleanEmail, first_name: first.trim(), last_name: last.trim() || null,
      plan: invitePlan === 'none' ? null : invitePlan,
    });
    setBusy(false);
    if (error) setMsg({ ok: false, text: error.code === '23505' ? 'המייל הזה כבר הוזמן.' : 'לא הצלחנו לשמור את ההזמנה.' });
    else {
      const planNote = invitePlan === 'none' ? '' : ` עם מנוי ${PLAN_LABEL[invitePlan]} פעיל מהרגע שתיכנס`;
      setMsg({ ok: true, text: `${first.trim()} הוזמנה${planNote}. היא יכולה להיכנס לאפליקציה עם המייל הזה.` });
      setFirst(''); setLast(''); setEmail(''); setInvitePlan('none');
      load();
    }
  }

  return (
    <Screen>
      <BackLink label="חזרה לניהול" onPress={() => router.back()} />
      <Title>מתאמנות ומנויים</Title>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'right' }}>הזמנת מתאמנת חדשה</Text>
        <Muted>רק מי שהוזמנה יכולה להיכנס לאפליקציה. אחרי ההזמנה היא נכנסת עם המייל, ושם את מגדירה לה מנוי.</Muted>
        <Field label="שם פרטי" value={first} onChangeText={setFirst} />
        <Field label="שם משפחה (אופציונלי)" value={last} onChangeText={setLast} />
        <Field label="אימייל" ltr value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Label>מנוי (אופציונלי — כדי שתוכל להירשם לאימון מיד כשהיא נכנסת)</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="בלי מנוי כרגע" selected={invitePlan === 'none'} onPress={() => setInvitePlan('none')} />
          <Chip label="8 כניסות בחודש" selected={invitePlan === 'monthly_8'} onPress={() => setInvitePlan('monthly_8')} />
          <Chip label="ללא הגבלה" selected={invitePlan === 'unlimited'} onPress={() => setInvitePlan('unlimited')} />
        </View>
        {invitePlan !== 'none' && <Muted>המנוי יהיה בתוקף עד סוף החודש הנוכחי, ויהיה צריך לחדש אותו ב-1 לחודש הבא.</Muted>}
        {msg && (msg.ok ? <Text style={{ color: '#1F5F2E', textAlign: 'right' }}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText>)}
        <Btn label="הזמנה" busy={busy} disabled={!valid} onPress={invite} />
      </Card>

      {toggleError && <ErrorText>{toggleError}</ErrorText>}

      {!members && <Loading />}
      {members?.map((row) => {
        const { profile, membership, entriesLeft, paidThisMonth } = row;
        const unpaid = paidThisMonth === false;
        return (
          <Pressable key={profile.id} accessibilityRole="button" onPress={() => router.push(`/admin/member/${profile.id}` as never)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E9E6E0', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#5A564F' }}>{profile.first_name.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: unpaid ? '#9A2B12' : C.text, textAlign: 'right' }}>
                  {fullName(profile)}{profile.is_admin ? ' (מנהלת)' : ''}
                </Text>
                <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right' }}>
                  {membership ? `${PLAN_LABEL[membership.plan]}${entriesLeft !== null ? ` · נשארו ${entriesLeft}` : ''}` : 'אין מנוי פעיל'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                {!membership ? <Badge label="ללא מנוי" tone="gray" />
                  : membership.status === 'frozen' ? <Badge label="מוקפא" tone="orange" />
                  : entriesLeft !== null && entriesLeft <= 1 ? <Badge label="כמעט נגמר" tone="orange" />
                  : <Badge label="פעיל" tone="green" />}
                {paidThisMonth !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {unpaid && (
                      <IconBtn icon="logo-whatsapp" label={`וואטסאפ ל${profile.first_name} - תזכורת תשלום`}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          const url = whatsAppUrl(profile.phone, paymentReminderText(profile.first_name));
                          if (url) Linking.openURL(url);
                        }} />
                    )}
                    <Pressable accessibilityRole="button" accessibilityLabel={unpaid ? 'סימון ששילמה החודש' : 'סימון שלא שילמה החודש'}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{ minHeight: 44, justifyContent: 'center' }}
                      onPress={(e) => { e.stopPropagation?.(); togglePaid(row, !paidThisMonth); }}>
                      <Badge label={paidThisMonth ? '✓ שולם' : 'לא שולם'} tone={paidThisMonth ? 'green' : 'red'} />
                    </Pressable>
                  </View>
                )}
              </View>
            </Card>
          </Pressable>
        );
      })}

      {pending.map((i) => (
        <Card key={i.email} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FBFAF8' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, color: C.text, textAlign: 'right' }}>{i.first_name} {i.last_name ?? ''}</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right', writingDirection: 'ltr' }}>{i.email}</Text>
          </View>
          <Badge label="הוזמנה · עוד לא נכנסה" tone="gray" />
        </Card>
      ))}
    </Screen>
  );
}
