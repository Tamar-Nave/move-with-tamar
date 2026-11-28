import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { BackLink, Card, C, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { dateTimeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Message = { id: string; title: string; body: string; audience: string; created_at: string };

export default function MessagesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<Message[] | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const today = new Date().toISOString().slice(0, 10);
    const [msgs, mem] = await Promise.all([
      supabase.from('messages').select('id, title, body, audience, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('memberships').select('plan').eq('user_id', session.user.id).eq('status', 'active').lte('starts_on', today).gte('ends_on', today).limit(1),
    ]);
    const plan = ((mem.data as { plan: string }[]) ?? [])[0]?.plan;
    setItems(((msgs.data as Message[]) ?? []).filter((m) => m.audience === 'all' || m.audience === plan));
  }, [session]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <BackLink label="חזרה לבית" onPress={() => router.back()} />
      <Title>הודעות מהסטודיו</Title>
      {!items && <Loading />}
      {items?.length === 0 && <Muted>אין הודעות עדיין.</Muted>}
      {items?.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, flexShrink: 1, textAlign: 'right' }}>{m.title}</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>{dateTimeLabel(m.created_at).split(' · ')[0]}</Text>
          </View>
          <Text style={{ fontSize: 15, color: C.text, textAlign: 'right', lineHeight: 22 }}>{m.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}
