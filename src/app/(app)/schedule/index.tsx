import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MyBookings } from '@/components/my-bookings';
import { Badge, Card, C, ErrorText, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  KIND_LABEL, fetchRoster, spotsTaken, waitlistCount, type ClassRow, type MyBooking, type RosterEntry,
} from '@/lib/classes';
import { addDays, dayLong, dayMonthLabel, dayNumber, dayShort, israelToDate, startOfWeek, timeLabel, todayYmd, weekRangeLabel, ymdOf } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Counts = { taken: number; waiting: number };

export default function ScheduleScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState(startOfWeek(todayYmd()));
  const [selected, setSelected] = useState(todayYmd());
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [mine, setMine] = useState<Record<string, MyBooking>>({});
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'schedule' | 'mine'>('schedule');

  const load = useCallback(async () => {
    setError(null);
    const from = israelToDate(weekStart, '00:00').toISOString();
    const to = israelToDate(addDays(weekStart, 7), '00:00').toISOString();
    const { data, error: err } = await supabase
      .from('classes').select('*').eq('status', 'scheduled').gte('starts_at', from).lt('starts_at', to).order('starts_at');
    if (err) { setError('לא הצלחנו לטעון את הלו״ז. נסי לרענן.'); return; }
    const rows = (data as ClassRow[]) ?? [];
    setClasses(rows);

    if (session && rows.length) {
      const { data: b } = await supabase
        .from('bookings').select('id, class_id, status, offer_expires_at')
        .eq('user_id', session.user.id).neq('status', 'cancelled').in('class_id', rows.map((r) => r.id));
      setMine(Object.fromEntries(((b as MyBooking[]) ?? []).map((x) => [x.class_id, x])));
    } else setMine({});
  }, [weekStart, session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Open on the day of the next upcoming class, so the list is never empty by default.
  useEffect(() => {
    supabase.from('classes').select('starts_at').eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString()).order('starts_at').limit(1)
      .then(({ data }) => {
        const row = (data as { starts_at: string }[] | null)?.[0];
        if (!row) return;
        const day = ymdOf(new Date(row.starts_at));
        setWeekStart(startOfWeek(day));
        setSelected(day);
      });
  }, []);

  // Spots taken / waitlist for the classes of the selected day only.
  useEffect(() => {
    if (!classes) return;
    const day = classes.filter((c) => ymdOf(new Date(c.starts_at)) === selected);
    Promise.all(day.map(async (c) => [c.id, await fetchRoster(c.id)] as [string, RosterEntry[]])).then((all) =>
      setCounts((prev) => ({ ...prev, ...Object.fromEntries(all.map(([id, r]) => [id, { taken: spotsTaken(r), waiting: waitlistCount(r) }])) })),
    );
  }, [classes, selected]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayYmd();
  const hasClass = (d: string) => classes?.some((c) => ymdOf(new Date(c.starts_at)) === d);
  const dayClasses = (classes ?? []).filter((c) => ymdOf(new Date(c.starts_at)) === selected);

  function changeWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelected(next <= today && today < addDays(next, 7) ? today : next);
    setClasses(null);
  }

  return (
    <Screen>
      <Title>{view === 'schedule' ? 'לו״ז אימונים' : 'ההרשמות שלי'}</Title>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: '#E9E6E0', borderRadius: 12, padding: 4 }}>
        {([['schedule', 'לו״ז'], ['mine', 'ההרשמות שלי']] as const).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: view === key }} onPress={() => setView(key)}
            style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: view === key ? C.card : 'transparent' }}>
            <Text style={{ fontSize: 15, fontWeight: view === key ? '700' : '400', color: C.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'mine' && <MyBookings />}

      {view === 'schedule' && (<>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="שבוע קודם" onPress={() => changeWeek(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={24} color={C.text} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{weekRangeLabel(weekStart)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="שבוע הבא" onPress={() => changeWeek(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 4, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 6 }}>
        {days.map((d) => {
          const on = d === selected;
          return (
            <Pressable
              key={d} accessibilityRole="button" accessibilityLabel={`${dayLong(d)} ${dayMonthLabel(d)}`} accessibilityState={{ selected: on }}
              onPress={() => setSelected(d)}
              style={{ flex: 1, minHeight: 60, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? C.primary : 'transparent' }}>
              <Text style={{ fontSize: 12, color: on ? '#fff' : C.textMuted }}>{dayShort(d)}</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: on ? '#fff' : C.text }}>{dayNumber(d)}</Text>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasClass(d) ? (on ? '#fff' : C.primary) : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>

      <Muted>
        {dayLong(selected)} {dayMonthLabel(selected)}{classes ? ` · ${dayClasses.length === 0 ? 'אין אימונים' : dayClasses.length === 1 ? 'אימון אחד' : `${dayClasses.length} אימונים`}` : ''}
      </Muted>

      {error && <ErrorText>{error}</ErrorText>}
      {!classes && !error && <Loading />}

      {dayClasses.map((c) => {
        const cnt = counts[c.id];
        const m = mine[c.id];
        const now = new Date();
        const full = cnt ? cnt.taken >= c.capacity : false;
        const opensLater = new Date(c.registration_opens_at) > now;
        let badge: { label: string; tone: 'green' | 'orange' | 'brand' | 'gray' };
        if (m?.status === 'booked') badge = { label: '✓ רשומה', tone: 'brand' };
        else if (m?.status === 'offered') badge = { label: 'התפנה לך מקום', tone: 'orange' };
        else if (m?.status === 'waitlist') badge = { label: 'ברשימת המתנה', tone: 'orange' };
        else if (opensLater) badge = { label: 'ההרשמה עוד לא נפתחה', tone: 'gray' };
        else if (!cnt) badge = { label: '…', tone: 'gray' };
        else if (full) badge = { label: cnt.waiting ? `מלא · ${cnt.waiting} ממתינות` : 'מלא', tone: 'orange' };
        else badge = { label: `${c.capacity - cnt.taken} מקומות`, tone: 'green' };

        return (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/schedule/${c.id}` as never)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: m?.status === 'booked' ? C.primary : C.border, borderWidth: m?.status === 'booked' ? 2 : 1 }}>
              <View style={{ width: 60, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{timeLabel(c.starts_at)}</Text>
                <Text style={{ fontSize: 12, color: C.textMuted }}>{c.duration_min} דק׳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'right' }}>{KIND_LABEL[c.kind]}</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right' }}>{cnt ? `${cnt.taken} מתוך ${c.capacity}` : ' '}</Text>
              </View>
              <Badge label={badge.label} tone={badge.tone} />
            </Card>
          </Pressable>
        );
      })}

      </>)}
    </Screen>
  );
}
