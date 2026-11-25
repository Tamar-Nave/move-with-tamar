import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { Badge, Btn, Card, C, ErrorText, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  KIND_LABEL, fetchRoster, friendlyDbError, rosterDisplayName, spotsTaken, waitlistCount,
  type ClassRow, type MyBooking, type RosterEntry,
} from '@/lib/classes';
import { googleCalendarUrl, isIosDevice, openAppleCalendar } from '@/lib/calendar';
import { dateTimeLabel, timeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, profile } = useAuth();
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [mine, setMine] = useState<MyBooking | null>(null);
  const [entries, setEntries] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmCancelClass, setConfirmCancelClass] = useState(false);

  const load = useCallback(async () => {
    const [c, r, b, e] = await Promise.all([
      supabase.from('classes').select('*').eq('id', id).single(),
      fetchRoster(id),
      session
        ? supabase.from('bookings').select('id, class_id, status, offer_expires_at').eq('class_id', id).eq('user_id', session.user.id).neq('status', 'cancelled').maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc('my_entries_left'),
    ]);
    setCls((c.data as ClassRow | null) ?? null);
    setRoster(r);
    setMine((b.data as MyBooking | null) ?? null);
    setEntries(typeof e.data === 'number' ? e.data : null);
    setLoaded(true);
  }, [id, session]);

  useEffect(() => { load(); }, [load]);

  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error: err } = await fn();
    if (err) setError(friendlyDbError(err.message));
    await load();
    setBusy(false);
  }

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!cls) return <Screen><Title>האימון לא נמצא</Title><Btn label="חזרה ללו״ז" variant="secondary" onPress={() => router.back()} /></Screen>;

  const now = new Date();
  const taken = spotsTaken(roster);
  const waiting = waitlistCount(roster);
  const full = taken >= cls.capacity;
  const started = new Date(cls.starts_at) <= now;
  const opensAt = new Date(cls.registration_opens_at);
  const cancelDeadline = new Date(new Date(cls.starts_at).getTime() - cls.cancel_hours_before * 3600_000);
  const canCancel = now <= cancelDeadline;
  const people = roster.filter((r) => r.status === 'booked' || r.status === 'offered');
  const queue = roster.filter((r) => r.status === 'waitlist');
  const myQueuePos = mine?.status === 'waitlist' ? queue.findIndex((q) => q.booking_id === mine.id) + 1 : 0;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/schedule' as never))} style={{ minHeight: 44, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-forward" size={18} color={C.primaryDark} />
          <Text style={{ color: C.primaryDark, fontSize: 15 }}>חזרה ללו״ז</Text>
        </View>
      </Pressable>

      <View>
        <Title>{KIND_LABEL[cls.kind]}</Title>
        <Text style={{ fontSize: 16, color: C.text, textAlign: 'right', marginTop: 2 }}>{dateTimeLabel(cls.starts_at).split(' · ')[0]}</Text>
        <Text style={{ fontSize: 16, color: C.text, textAlign: 'right', writingDirection: 'ltr' }}>
          {timeLabel(cls.starts_at)} – {timeLabel(new Date(new Date(cls.starts_at).getTime() + cls.duration_min * 60000))}
        </Text>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{taken} מתוך {cls.capacity} נרשמו</Text>
          {full ? <Badge label={waiting ? `מלא · ${waiting} ממתינות` : 'מלא'} tone="orange" /> : <Badge label={`${cls.capacity - taken} מקומות פנויים`} tone="green" />}
        </View>
        {people.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }}
            accessibilityLabel={`${people.length} נרשמות. ${showAll ? 'הסתרת הרשימה' : 'הצגת הרשימה'}`}
            onPress={() => setShowAll(!showAll)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
            {people.slice(-5).map((p, i) => (
              <View key={p.booking_id} style={{ marginStart: i === 0 ? 0 : -12, borderRadius: 24, borderWidth: 2, borderColor: C.card }}>
                <Avatar p={p} size={40} />
              </View>
            ))}
            {people.length > 5 && (
              <View style={{ marginStart: -12, width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.card, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.primaryDark }}>+{people.length - 5}</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={20} color={C.textMuted} />
          </Pressable>
        )}
        {showAll && (
          <View style={{ gap: 10, marginTop: 4 }}>
            {people.map((p) => (
              <View key={p.booking_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar p={p} size={36} />
                <Text style={{ fontSize: 15, color: C.text }}>{rosterDisplayName(p, people)}</Text>
              </View>
            ))}
            {queue.length > 0 && (
              <>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'right', marginTop: 6 }}>רשימת המתנה</Text>
                {queue.map((q, i) => (
                  <View key={q.booking_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar p={q} size={36} />
                    <Text style={{ fontSize: 15, color: C.text }}>{i + 1}. {rosterDisplayName(q, queue)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </Card>

      <Card>
        <Row k="אפשר לבטל עד" v={`עד ${dateTimeLabel(cancelDeadline.toISOString())}`} />
        {cls.notes ? <Row k="הערות" v={cls.notes} /> : null}
      </Card>

      {error && <ErrorText>{error}</ErrorText>}

      {mine?.status === 'booked' && (
        <>
          <Badge label="✓ את רשומה לאימון הזה" tone="brand" />
          <Btn label="ביטול הרשמה" variant="danger" busy={busy} disabled={!canCancel || started}
            onPress={() => act(() => supabase.rpc('cancel_booking', { p_booking: mine.id }))} />
          {!canCancel && !started && <Muted>זמן הביטול עבר. לביטול כדאי לפנות לתמר.</Muted>}
          {!started && (
            <Card>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, textAlign: 'right' }}>להוסיף את האימון ליומן?</Text>
              {(isIosDevice()
                ? [['הוספה ליומן אפל (אייפון)', 'apple'], ['הוספה ליומן Google', 'google']]
                : [['הוספה ליומן Google (אנדרואיד)', 'google'], ['הוספה ליומן אפל (אייפון)', 'apple']]
              ).map(([label, which]) => (
                <Btn key={label} label={label} variant="secondary"
                  onPress={() => (which === 'apple' ? openAppleCalendar(cls) : Linking.openURL(googleCalendarUrl(cls)))} />
              ))}
              <Muted>האימון נכנס ליומן כאירוע רגיל. אם תבטלי הרשמה או שהאימון ישתנה, צריך למחוק או לעדכן אותו ביומן בעצמך.</Muted>
            </Card>
          )}
        </>
      )}

      {mine?.status === 'offered' && mine.offer_expires_at && (
        <Card style={{ borderColor: C.primary, borderWidth: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'right' }}>התפנה לך מקום!</Text>
          <Muted>צריך לאשר עד {timeLabel(mine.offer_expires_at)}, אחרת המקום עובר לבאה בתור.</Muted>
          <Btn label="מאשרת את המקום" busy={busy} onPress={() => act(() => supabase.rpc('confirm_offer', { p_booking: mine.id }))} />
          <Btn label="לא מתאים לי" variant="secondary" busy={busy} onPress={() => act(() => supabase.rpc('cancel_booking', { p_booking: mine.id }))} />
        </Card>
      )}

      {mine?.status === 'waitlist' && (
        <>
          <Badge label={`ברשימת המתנה · מקום ${myQueuePos || ''}`} tone="orange" />
          <Muted>כשיתפנה מקום נשלח לך הודעה, ויהיו לך {cls.waitlist_confirm_minutes} דקות לאשר.</Muted>
          <Btn label="הסרה מרשימת ההמתנה" variant="secondary" busy={busy} onPress={() => act(() => supabase.rpc('cancel_booking', { p_booking: mine.id }))} />
        </>
      )}

      {!mine && (
        started ? <Btn label="האימון כבר התחיל" onPress={() => {}} disabled />
        : opensAt > now ? <Btn label={`ההרשמה נפתחת ב־${dateTimeLabel(cls.registration_opens_at)}`} onPress={() => {}} disabled />
        : <Btn label={full ? 'הצטרפות לרשימת ההמתנה' : 'הרשמה לאימון'} busy={busy} onPress={() => act(() => supabase.rpc('book_class', { p_class: cls.id }))} />
      )}

      {profile?.is_admin && (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>ניהול האימון</Text>
            <Badge label="רק את רואה" tone="gray" />
          </View>
          <Btn label="משתתפות ונוכחות" onPress={() => router.push(`/admin/class/${cls.id}` as never)} />
          <Btn label={confirmCancelClass ? 'בטוחה? לחצי שוב לביטול האימון' : 'ביטול האימון'} variant="danger" busy={busy}
            onPress={async () => {
              if (!confirmCancelClass) { setConfirmCancelClass(true); return; }
              setBusy(true);
              const { error: err } = await supabase.from('classes').update({ status: 'cancelled' }).eq('id', cls.id);
              setBusy(false);
              if (err) { setError('לא הצלחנו לבטל את האימון.'); return; }
              router.canGoBack() ? router.back() : router.replace('/schedule' as never);
            }} />
        </Card>
      )}
    </Screen>
  );
}

function Avatar({ p, size = 44 }: { p: RosterEntry; size?: number }) {
  return p.avatar_url ? (
    <Image source={{ uri: p.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={p.first_name} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E9E6E0', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: '#5A564F' }}>{p.first_name.slice(0, 1)}</Text>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontSize: 14, color: C.textMuted }}>{k}</Text>
      <Text style={{ fontSize: 14, color: C.text, flexShrink: 1, textAlign: 'left' }}>{v}</Text>
    </View>
  );
}
