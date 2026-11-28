import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { MyBookings } from '@/components/my-bookings';
import { ClassListItem, DayStrip, WeekNav, type BadgeSpec } from '@/components/schedule-parts';
import { Segmented } from '@/components/segmented';
import { ErrorText, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  CLASS_SELECT, fetchRoster, spotsTaken, waitlistCount, type ClassRow, type MyBooking, type RosterEntry,
} from '@/lib/classes';
import { addDays, dayLong, dayMonthLabel, israelToDate, startOfWeek, todayYmd, ymdOf } from '@/lib/dates';
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
      .from('classes').select(CLASS_SELECT).eq('status', 'scheduled').gte('starts_at', from).lt('starts_at', to).order('starts_at');
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

      <Segmented options={[['schedule', 'לו״ז'], ['mine', 'ההרשמות שלי']] as const} value={view} onChange={setView} />

      {view === 'mine' && <MyBookings />}

      {view === 'schedule' && (<>
      <WeekNav weekStart={weekStart} onChange={changeWeek} />

      <DayStrip days={days} selected={selected} hasClass={hasClass} onSelect={setSelected} />

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
        let badge: BadgeSpec;
        if (m?.status === 'booked') badge = { label: '✓ רשומה', tone: 'brand' };
        else if (m?.status === 'offered') badge = { label: 'התפנה לך מקום', tone: 'orange' };
        else if (m?.status === 'waitlist') badge = { label: 'ברשימת המתנה', tone: 'orange' };
        else if (opensLater) badge = { label: 'ההרשמה עוד לא נפתחה', tone: 'gray' };
        else if (!cnt) badge = { label: '…', tone: 'gray' };
        else if (full) badge = { label: cnt.waiting ? `מלא · ${cnt.waiting} ממתינות` : 'מלא', tone: 'orange' };
        else badge = { label: `${c.capacity - cnt.taken} מקומות`, tone: 'green' };

        return (
          <ClassListItem key={c.id} cls={c} taken={cnt ? cnt.taken : null} badge={badge} registered={m?.status === 'booked'}
            onPress={() => router.push(`/schedule/${c.id}` as never)} />
        );
      })}

      </>)}
    </Screen>
  );
}
