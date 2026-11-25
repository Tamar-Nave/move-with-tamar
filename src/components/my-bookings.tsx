import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, Card, C, Loading, Muted } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { KIND_LABEL, type BookingStatus, type ClassRow } from '@/lib/classes';
import { dayLong, dayMonthLabel, timeLabel, ymdOf } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Item = { id: string; status: BookingStatus; attended: boolean | null; classes: ClassRow };

/** The signed-in member's registrations: upcoming or past. */
export function MyBookings() {
  const router = useRouter();
  const { session } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [items, setItems] = useState<Item[] | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('bookings')
      .select('id, status, attended, classes!inner(*)')
      .eq('user_id', session.user.id).neq('status', 'cancelled');
    setItems((data as unknown as Item[]) ?? []);
  }, [session]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = Date.now();
  const upcoming = (items ?? []).filter((i) => new Date(i.classes.starts_at).getTime() >= now)
    .sort((a, b) => a.classes.starts_at.localeCompare(b.classes.starts_at));
  const past = (items ?? []).filter((i) => new Date(i.classes.starts_at).getTime() < now && i.status === 'booked')
    .sort((a, b) => b.classes.starts_at.localeCompare(a.classes.starts_at));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([['upcoming', `עתידיים (${upcoming.length})`], ['past', `עבר (${past.length})`]] as const).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)}
            style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, justifyContent: 'center',
              borderColor: tab === key ? C.primary : '#D9D5CE', backgroundColor: tab === key ? C.primary : C.card }}>
            <Text style={{ fontSize: 15, color: tab === key ? '#fff' : C.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {!items && <Loading />}
      {items && list.length === 0 && <Muted>{tab === 'upcoming' ? 'את לא רשומה לאימונים קרובים.' : 'עוד אין אימונים קודמים.'}</Muted>}

      {list.map((i) => {
        const c = i.classes;
        const day = ymdOf(new Date(c.starts_at));
        let badge: { label: string; tone: 'green' | 'orange' | 'brand' | 'gray' } | null = null;
        if (c.status === 'cancelled') badge = { label: 'האימון בוטל', tone: 'gray' };
        else if (tab === 'past') badge = i.attended === true ? { label: 'הגעת', tone: 'green' } : i.attended === false ? { label: 'לא הגעת', tone: 'gray' } : null;
        else if (i.status === 'booked') badge = { label: '✓ רשומה', tone: 'brand' };
        else if (i.status === 'offered') badge = { label: 'התפנה לך מקום', tone: 'orange' };
        else if (i.status === 'waitlist') badge = { label: 'ברשימת המתנה', tone: 'orange' };

        return (
          <Pressable key={i.id} accessibilityRole="button" onPress={() => router.push(`/schedule/${c.id}` as never)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 56, height: 60, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: C.primaryDark }}>{dayLong(day)}</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: C.primaryDark }}>{Number(day.slice(8))}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'right' }}>{KIND_LABEL[c.kind]}</Text>
                <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right' }}>{dayMonthLabel(day)} · {timeLabel(c.starts_at)}</Text>
              </View>
              {badge && <Badge label={badge.label} tone={badge.tone} />}
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
