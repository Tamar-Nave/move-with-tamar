import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { MessageCard, NextClassCard, SubscriptionCard, type HomePlan } from '@/components/home-cards';
import { InstallPrompt } from '@/components/install-prompt';
import { Monogram } from '@/components/monogram';
import { C, Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { type ClassRow } from '@/lib/classes';
import { dateTimeLabel, todayYmd } from '@/lib/dates';
import { fetchMonthUsage } from '@/lib/progress';
import { supabase } from '@/lib/supabase';

type Message = { id: string; title: string; body: string; audience: string; created_at: string };

export default function HomeScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [next, setNext] = useState<ClassRow | null>(null);
  const [plan, setPlan] = useState<HomePlan | null>(null);
  const [usage, setUsage] = useState({ charged: 0, booked: 0 });
  const [left, setLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const today = todayYmd();
    const [b, m, e, msg, monthUsage] = await Promise.all([
      supabase.from('bookings').select('status, classes!inner(*, class_types(*))').eq('user_id', session.user.id).eq('status', 'booked')
        .gte('classes.starts_at', new Date().toISOString()),
      supabase.from('memberships').select('plan, ends_on').eq('user_id', session.user.id).eq('status', 'active')
        .lte('starts_on', today).gte('ends_on', today).order('created_at', { ascending: false }).limit(1),
      supabase.rpc('my_entries_left'),
      supabase.from('messages').select('id, title, body, audience, created_at').order('created_at', { ascending: false }).limit(10),
      fetchMonthUsage(session.user.id),
    ]);
    const classes = ((b.data as unknown as { classes: ClassRow }[]) ?? []).map((x) => x.classes)
      .filter((c) => c.status === 'scheduled').sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    setNext(classes[0] ?? null);
    const myPlan = ((m.data as HomePlan[]) ?? [])[0] ?? null;
    setUsage(monthUsage);
    setPlan(myPlan);
    setLeft(typeof e.data === 'number' ? e.data : null);
    setMessage(((msg.data as Message[]) ?? []).find((x) => x.audience === 'all' || x.audience === myPlan?.plan) ?? null);
    setLoaded(true);
  }, [session]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Monogram height={32} color={C.primary} />
        <Text style={{ fontSize: 12, fontWeight: '500', letterSpacing: 3.5, color: C.textMuted, writingDirection: 'ltr' }}>{BRAND.name.toUpperCase()}</Text>
      </View>

      <Text style={{ fontSize: 28, fontWeight: '600', letterSpacing: -0.4, color: C.text, textAlign: 'right', marginTop: 6 }}>שלום, {profile?.first_name ?? ''}</Text>

      <InstallPrompt dismissible />

      {!loaded && <Loading />}

      {loaded && (
        <>
          <SubscriptionCard plan={plan} used={plan?.plan === 'unlimited' ? usage.booked : usage.charged} left={left} />

          <NextClassCard next={next} onOpen={() => router.push(`/schedule/${next?.id}` as never)} onSchedule={() => router.push('/schedule' as never)} />

          {message && (
            <MessageCard title={message.title} date={dateTimeLabel(message.created_at).split(' · ')[0]} body={message.body}
              onAll={() => router.push('/messages' as never)} />
          )}
        </>
      )}
    </Screen>
  );
}
