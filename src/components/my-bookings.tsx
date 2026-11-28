import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { BookingListItem, type BadgeSpec } from '@/components/schedule-parts';
import { Segmented } from '@/components/segmented';
import { Loading, Muted } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { type BookingStatus, type ClassRow } from '@/lib/classes';
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
      .select('id, status, attended, classes!inner(*, class_types(*))')
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
      <Segmented options={[['upcoming', `עתידיים (${upcoming.length})`], ['past', `עבר (${past.length})`]] as const} value={tab} onChange={setTab} />

      {!items && <Loading />}
      {items && list.length === 0 && <Muted>{tab === 'upcoming' ? 'את לא רשומה לאימונים קרובים.' : 'עוד אין אימונים קודמים.'}</Muted>}

      {list.map((i) => {
        const c = i.classes;
        let badge: BadgeSpec | null = null;
        if (c.status === 'cancelled') badge = { label: 'האימון בוטל', tone: 'gray' };
        else if (tab === 'past') badge = i.attended === true ? { label: 'הגעת', tone: 'green' } : i.attended === false ? { label: 'לא הגעת', tone: 'gray' } : null;
        else if (i.status === 'booked') badge = { label: '✓ רשומה', tone: 'brand' };
        else if (i.status === 'offered') badge = { label: 'התפנה לך מקום', tone: 'orange' };
        else if (i.status === 'waitlist') badge = { label: 'ברשימת המתנה', tone: 'orange' };

        return <BookingListItem key={i.id} cls={c} badge={badge} onPress={() => router.push(`/schedule/${c.id}` as never)} />;
      })}
    </View>
  );
}
