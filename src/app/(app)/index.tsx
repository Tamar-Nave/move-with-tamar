import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { InstallPrompt } from '@/components/install-prompt';
import { Monogram } from '@/components/monogram';
import { Badge, Btn, Card, C, Loading, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { KIND_LABEL, type ClassRow } from '@/lib/classes';
import { dateTimeLabel, dayLong, dayMonthLabel, timeLabel, todayYmd, ymdOf } from '@/lib/dates';
import { PLAN_LABEL } from '@/lib/members';
import { supabase } from '@/lib/supabase';

type Plan = { plan: keyof typeof PLAN_LABEL; entries_per_month: number } | null;
type Message = { id: string; title: string; body: string; audience: string; created_at: string };

export default function HomeScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [next, setNext] = useState<ClassRow | null>(null);
  const [plan, setPlan] = useState<Plan>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const today = todayYmd();
    const [b, m, e, msg] = await Promise.all([
      supabase.from('bookings').select('status, classes!inner(*)').eq('user_id', session.user.id).eq('status', 'booked')
        .gte('classes.starts_at', new Date().toISOString()),
      supabase.from('memberships').select('plan, entries_per_month').eq('user_id', session.user.id).eq('status', 'active')
        .lte('starts_on', today).gte('ends_on', today).order('created_at', { ascending: false }).limit(1),
      supabase.rpc('my_entries_left'),
      supabase.from('messages').select('id, title, body, audience, created_at').order('created_at', { ascending: false }).limit(10),
    ]);
    const classes = ((b.data as unknown as { classes: ClassRow }[]) ?? []).map((x) => x.classes)
      .filter((c) => c.status === 'scheduled').sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    setNext(classes[0] ?? null);
    const myPlan = ((m.data as Plan[]) ?? [])[0] ?? null;
    setPlan(myPlan);
    setLeft(typeof e.data === 'number' ? e.data : null);
    setMessage(((msg.data as Message[]) ?? []).find((x) => x.audience === 'all' || x.audience === myPlan?.plan) ?? null);
    setLoaded(true);
  }, [session]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const nextDay = next ? ymdOf(new Date(next.starts_at)) : '';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Monogram height={34} color={C.primary} />
        <Text style={{ fontSize: 13, letterSpacing: 3, color: '#4A4641', writingDirection: 'ltr' }}>{BRAND.name.toUpperCase()}</Text>
      </View>

      <Text style={{ fontSize: 28, fontWeight: '700', color: C.text, textAlign: 'right', marginTop: 6 }}>שלום, {profile?.first_name ?? ''}</Text>

      <InstallPrompt dismissible />

      {!loaded && <Loading />}

      {loaded && (
        <>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ fontSize: 14, color: C.textMuted }}>המנוי שלי</Text>
            {!plan ? <Badge label="אין מנוי פעיל" tone="gray" />
              : plan.plan === 'unlimited' ? <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>ללא הגבלה</Text>
              : <Text style={{ fontSize: 15, color: C.text }}><Text style={{ fontSize: 22, fontWeight: '700', color: C.primary }}>{left ?? 0}</Text> מתוך {plan.entries_per_month} כניסות</Text>}
          </Card>

          <Card style={{ gap: 12 }}>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right' }}>האימון הבא שלך</Text>
            {next ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 60, height: 64, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: C.primaryDark }}>{dayLong(nextDay)}</Text>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: C.primaryDark }}>{Number(nextDay.slice(8))}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'right' }}>{KIND_LABEL[next.kind]}</Text>
                    <Text style={{ fontSize: 15, color: '#3D3A36', textAlign: 'right' }}>{dayMonthLabel(nextDay)} · {timeLabel(next.starts_at)}</Text>
                  </View>
                </View>
                <Btn label="לפרטי האימון" onPress={() => router.push(`/schedule/${next.id}` as never)} />
              </>
            ) : (
              <>
                <Muted>את לא רשומה לאימון קרוב.</Muted>
                <Btn label="לצפייה בלו״ז" onPress={() => router.push('/schedule' as never)} />
              </>
            )}
          </Card>

          {message && (
            <Card style={{ borderColor: C.primary }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{message.title}</Text>
                <Text style={{ fontSize: 12, color: C.textMuted }}>{dateTimeLabel(message.created_at).split(' · ')[0]}</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#3D3A36', textAlign: 'right' }}>{message.body}</Text>
              <Btn label="לכל ההודעות" variant="secondary" onPress={() => router.push('/messages' as never)} />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
