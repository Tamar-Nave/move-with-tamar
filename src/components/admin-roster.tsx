import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, Btn, Card, Chip, C, ErrorText, Label, Loading, Muted } from '@/components/ui';
import { friendlyDbError, type ClassRow } from '@/lib/classes';
import { fetchMembersOverview, fullName, type MemberOverview } from '@/lib/members';
import { supabase } from '@/lib/supabase';

type Row = {
  id: string; user_id: string; status: 'booked' | 'waitlist' | 'offered'; charged: boolean; attended: boolean | null;
  profiles: { first_name: string; last_name: string | null } | null;
};
type Mode = 'charge' | 'free' | 'add';

/** Tamar's tools for one class: add/remove participants, manage the waitlist, mark attendance. */
export function AdminRoster({ cls, onChange }: { cls: ClassRow; onChange?: () => void }) {
  const id = cls.id;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<Mode>('charge');
  const [pick, setPick] = useState<string | null>(null);
  const [asWaitlist, setAsWaitlist] = useState(false);
  const [cancelRow, setCancelRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, o] = await Promise.all([
      supabase.from('bookings').select('id, user_id, status, charged, attended, profiles!user_id(first_name, last_name)')
        .eq('class_id', id).neq('status', 'cancelled').order('created_at'),
      fetchMembersOverview(),
    ]);
    if (b.error) setError('לא הצלחנו לטעון את רשימת המשתתפות. נסי לרענן את הדף.');
    setRows((b.data as unknown as Row[]) ?? []);
    setMembers(o.members);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error: err } = await fn();
    if (err) setError(friendlyDbError(err.message));
    setBusy(false);
    await load();
    onChange?.();
    return !err;
  }

  if (!rows) return <Loading />;

  const registered = new Set(rows.map((r) => r.user_id));
  const available = members.filter((m) => !registered.has(m.profile.id));
  const chosen = available.find((m) => m.profile.id === pick);
  const noEntries = chosen && chosen.entriesLeft !== null && chosen.entriesLeft <= 0;
  const going = rows.filter((r) => r.status !== 'waitlist');
  const waiting = rows.filter((r) => r.status === 'waitlist');
  const name = (r: Row) => (r.profiles ? fullName(r.profiles) : '—');

  async function addMember() {
    if (!pick) return;
    const ok = asWaitlist
      ? await run(() => supabase.from('bookings').insert({ class_id: id, user_id: pick, status: 'waitlist', charged: false }))
      : await run(() => supabase.rpc('admin_book', { p_class: id, p_user: pick, p_charge: mode !== 'free', p_add_entry: mode === 'add' }));
    if (ok) { setAdding(false); setPick(null); setMode('charge'); setAsWaitlist(false); }
  }

  async function doCancel(refund: boolean) {
    if (!cancelRow) return;
    await run(() => supabase.rpc('admin_cancel_booking', { p_booking: cancelRow.id, p_refund: refund }));
    setCancelRow(null);
  }

  const setAttended = (r: Row, v: boolean) =>
    run(() => supabase.from('bookings').update({ attended: r.attended === v ? null : v }).eq('id', r.id));

  return (
    <View style={{ gap: 14 }}>
      <Muted>{going.length} מתוך {cls.capacity} רשומות{waiting.length ? ` · ${waiting.length} ברשימת המתנה` : ''}</Muted>
      {error && <ErrorText>{error}</ErrorText>}

      {!adding ? (
        <Btn label="+ הוספת מתאמנת לאימון" variant="secondary" onPress={() => setAdding(true)} />
      ) : (
        <Card style={{ borderColor: C.primary, borderWidth: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'right' }}>הוספת מתאמנת</Text>
          {available.length === 0 && <Muted>כל המתאמנות כבר רשומות.</Muted>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {available.map((m) => <Chip key={m.profile.id} label={fullName(m.profile)} selected={pick === m.profile.id} onPress={() => setPick(m.profile.id)} />)}
          </View>
          {chosen && (
            <>
              <Label>לאן להוסיף?</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="לאימון" selected={!asWaitlist} onPress={() => setAsWaitlist(false)} />
                <Chip label="לרשימת ההמתנה" selected={asWaitlist} onPress={() => setAsWaitlist(true)} />
              </View>
              {!asWaitlist && (
                <>
                  {noEntries && <Text style={{ color: C.warning, textAlign: 'right' }}>לא נשארו לה כניסות החודש. אפשר לרשום אותה בכל זאת:</Text>}
                  <Label>איך לרשום?</Label>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Chip label="וחיוב כניסה" selected={mode === 'charge'} onPress={() => setMode('charge')} />
                    <Chip label="בלי חיוב" selected={mode === 'free'} onPress={() => setMode('free')} />
                    <Chip label="והוספת כניסה" selected={mode === 'add'} onPress={() => setMode('add')} />
                  </View>
                  <Muted>{mode === 'charge' ? 'תרד לה כניסה אחת.' : mode === 'free' ? 'לא תרד לה כניסה.' : 'תתווסף לה כניסה, ותרד כניסה על האימון. בפועל היא לא מפסידה כלום.'}</Muted>
                </>
              )}
              {asWaitlist && <Muted>היא תתווסף לסוף התור. כשיתפנה מקום היא תקבל הצעה.</Muted>}
              <Btn label={asWaitlist ? `הוספת ${chosen.profile.first_name} לרשימת ההמתנה` : `רישום של ${chosen.profile.first_name}`} busy={busy} onPress={addMember} />
            </>
          )}
          <Btn label="סגירה" variant="secondary" onPress={() => { setAdding(false); setPick(null); setAsWaitlist(false); }} />
        </Card>
      )}

      <Text style={{ fontSize: 18, fontWeight: '600', color: C.text, textAlign: 'right' }}>רשומות</Text>
      {going.length === 0 && <Muted>עוד אין רשומות לאימון הזה.</Muted>}
      {going.map((r) => (
        <Card key={r.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>{name(r)}</Text>
            {r.status === 'offered' && <Badge label="הוצע לה מקום" tone="orange" />}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip label={r.attended === true ? '✓ הגיעה' : 'הגיעה'} selected={r.attended === true} onPress={() => setAttended(r, true)} />
            <Chip label={r.attended === false ? '✗ לא הגיעה' : 'לא הגיעה'} selected={r.attended === false} onPress={() => setAttended(r, false)} />
            <Pressable accessibilityRole="button" onPress={() => setCancelRow(r)} style={{ minHeight: 40, paddingHorizontal: 14, justifyContent: 'center' }}>
              <Text style={{ color: C.danger, fontSize: 15 }}>הורדה מהאימון</Text>
            </Pressable>
          </View>
          {cancelRow?.id === r.id && (
            <View style={{ backgroundColor: C.primarySoft, borderRadius: 18, padding: 14, gap: 8 }}>
              <Text style={{ fontSize: 14, color: C.text, textAlign: 'right' }}>להוריד את {r.profiles?.first_name} מהאימון? המקום יוצע לראשונה ברשימת ההמתנה.</Text>
              <Btn label="להוריד ולהחזיר כניסה" busy={busy} onPress={() => doCancel(true)} />
              <Btn label="להוריד בלי להחזיר כניסה" variant="secondary" busy={busy} onPress={() => doCancel(false)} />
              <Btn label="לא, להשאיר" variant="secondary" onPress={() => setCancelRow(null)} />
            </View>
          )}
        </Card>
      ))}

      <Text style={{ fontSize: 18, fontWeight: '600', color: C.text, textAlign: 'right' }}>רשימת המתנה</Text>
      {waiting.length === 0 && <Muted>אין אף אחת ברשימת ההמתנה.</Muted>}
      {waiting.map((r, i) => (
        <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, color: C.text }}>{i + 1}. {name(r)}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable accessibilityRole="button" disabled={busy || going.length >= cls.capacity}
              onPress={() => run(() => supabase.from('bookings').update({
                status: 'booked', offer_expires_at: null,
                charged: members.find((m) => m.profile.id === r.user_id)?.membership?.plan === 'monthly_8',
              }).eq('id', r.id))}
              style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', opacity: going.length >= cls.capacity ? 0.4 : 1 }}>
              <Text style={{ color: C.primaryDark, fontSize: 15 }}>העברה לאימון</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => run(() => supabase.rpc('admin_cancel_booking', { p_booking: r.id, p_refund: true }))} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' }}>
              <Text style={{ color: C.danger, fontSize: 15 }}>הסרה</Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </View>
  );
}
