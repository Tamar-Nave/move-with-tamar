import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { NativePickerInput } from '@/components/form-inputs';
import { BackLink, Btn, Card, Chip, C, Disclosure, ErrorText, IconBtn, Label, Muted, Screen, Title } from '@/components/ui';
import { parseClassQuick, type ClassTypeRow } from '@/lib/class-types';
import { CLASS_DEFAULTS, defaultCancelHours, defaultReminderMinutes, isMorningClass } from '@/lib/defaults';
import { addDays, dateTimeLabel, dayLong, dayMonthLabel, israelToDate, startOfWeek, todayYmd } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { GLASS } from '@/lib/theme';

type OpenMode = 'weekly' | 'now' | 'before' | 'custom';

/** When registration opens for the class on `classYmd` (week index i = repeated weeks). */
function opensAt(mode: OpenMode, classYmd: string, start: Date, customDate: string, customTime: string, beforeDays: number, i: number): Date {
  if (mode === 'weekly') return israelToDate(addDays(startOfWeek(classYmd), -3), CLASS_DEFAULTS.openTime); // Thursday before the week
  if (mode === 'now') return new Date();
  if (mode === 'custom') return israelToDate(addDays(customDate, 7 * i), customTime);
  return new Date(start.getTime() - beforeDays * 24 * 3600_000); // 'before'
}

function openModeShort(mode: OpenMode, beforeDays: number): string {
  if (mode === 'weekly') return 'ברירת מחדל';
  if (mode === 'now') return 'מיד';
  if (mode === 'custom') return 'ידנית';
  return beforeDays === 1 ? 'יום לפני' : `${beforeDays} ימים לפני`;
}

export default function NewClassScreen() {
  const router = useRouter();
  const [types, setTypes] = useState<ClassTypeRow[] | null>(null); // the studio's active class types
  const [typeId, setTypeId] = useState<string | null>(null);
  const [date, setDate] = useState(addDays(todayYmd(), 1));
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState(50);
  const [capacity, setCapacity] = useState(12);
  const [openMode, setOpenMode] = useState<OpenMode>('weekly');
  const [beforeDays, setBeforeDays] = useState(1);
  const [customDate, setCustomDate] = useState(todayYmd());
  const [customTime, setCustomTime] = useState('20:00');
  const [cancelOverride, setCancelOverride] = useState<number | null>(null);   // null = follow the default for this hour
  const [reminderOverride, setReminderOverride] = useState<number | null>(null); // null = follow the default for this hour
  const [waitMinutes, setWaitMinutes] = useState<number>(CLASS_DEFAULTS.waitlistConfirmMinutes);
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [extraDates, setExtraDates] = useState<string[]>([]); // more class days from quick fill ("שני ורביעי")
  const [quickText, setQuickText] = useState('');
  const [quickResult, setQuickResult] = useState<{ filled: string[]; warnings: string[] } | null>(null);

  useEffect(() => {
    supabase.from('class_types').select('*').eq('is_active', true).order('created_at').then(({ data }) => {
      const list = (data as ClassTypeRow[] | null) ?? [];
      setTypes(list);
      setTypeId((cur) => cur ?? list[0]?.id ?? null);
    });
  }, []);
  const type = types?.find((t) => t.id === typeId);

  function applyQuick() {
    const p = parseClassQuick(quickText, todayYmd(), types ?? []);
    const filled: string[] = [];
    if (p.typeId) { setTypeId(p.typeId); filled.push(p.typeName!); }
    if (p.dates) {
      setDate(p.dates[0]);
      setExtraDates(p.dates.slice(1));
      filled.push(p.dates.map((d) => `יום ${dayLong(d)} ${dayMonthLabel(d)}`).join(', '));
    }
    if (p.time) { setTime(p.time); setCancelOverride(null); setReminderOverride(null); filled.push(`שעה ${p.time}`); }
    if (p.capacity) { setCapacity(Math.min(60, Math.max(1, p.capacity))); filled.push(`${p.capacity} משתתפות`); }
    if (p.duration) { setDuration(Math.min(180, Math.max(10, p.duration))); filled.push(`${p.duration} דקות`); }
    if (p.repeatWeeks != null) { setRepeatWeeks(p.repeatWeeks); filled.push(p.repeatWeeks ? `חזרה ל־${p.repeatWeeks} שבועות` : 'בלי חזרה'); }
    if (p.openNow) { setOpenMode('now'); filled.push('הרשמה נפתחת מיד'); }
    if (p.notes) { setNotes(p.notes); filled.push(`הערה: ${p.notes}`); }
    setQuickResult({ filled, warnings: p.warnings });
    setMessage(null);
  }

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  const validCustom = openMode !== 'custom' || (/^\d{4}-\d{2}-\d{2}$/.test(customDate) && /^\d{2}:\d{2}$/.test(customTime));
  const cancelHours = cancelOverride ?? defaultCancelHours(time);
  const reminderMinutes = reminderOverride ?? defaultReminderMinutes(time);
  const morning = isMorningClass(time);
  const totalClasses = (1 + extraDates.length) * (repeatWeeks + 1);
  const reminderHours = Math.round(reminderMinutes / 60);
  const advancedSummary =
    `פתיחת הרשמה: ${openModeShort(openMode, beforeDays)} · ביטול עד ${cancelHours} ש׳ · תזכורת ${reminderHours} ש׳ לפני · המתנה ${waitMinutes} דק׳ · ` +
    `חזרה: ${repeatWeeks ? `${repeatWeeks} שבועות` : 'ללא'}${notes.trim() ? ' · יש הערה' : ''}`;

  let openPreview = '';
  if (validDate && validCustom) {
    openPreview = opensAt(openMode, date, israelToDate(date, time), customDate, customTime, beforeDays, 0).toISOString();
  }

  async function create() {
    if (!typeId) { setMessage({ ok: false, text: 'בחרי סוג אימון.' }); return; }
    setBusy(true);
    setMessage(null);
    const rows = [date, ...extraDates].flatMap((baseDate) => Array.from({ length: repeatWeeks + 1 }, (_, i) => {
      const ymd = addDays(baseDate, 7 * i);
      const start = israelToDate(ymd, time);
      return {
        type_id: typeId, starts_at: start.toISOString(), duration_min: duration, capacity,
        registration_opens_at: opensAt(openMode, ymd, start, customDate, customTime, beforeDays, i).toISOString(),
        cancel_hours_before: cancelHours, reminder_minutes_before: reminderMinutes,
        waitlist_confirm_minutes: waitMinutes, notes: notes.trim() || null,
      };
    }));
    const { error } = await supabase.from('classes').insert(rows);
    setBusy(false);
    if (error) { setMessage({ ok: false, text: 'לא הצלחנו לשמור את האימון. נסי שוב.' }); return; }
    setMessage({ ok: true, text: rows.length === 1 ? '✓ האימון נוסף ללו״ז.' : `✓ ${rows.length} אימונים נוספו ללו״ז.` });
    // Leave a moment to read the confirmation, then back to the admin list (not just back() — a direct link here has no history to pop).
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/admin' as never)), 1100);
  }

  return (
    <Screen>
      <BackLink label="חזרה לניהול" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin' as never))} />
      <Title>אימון חדש</Title>

      <Card style={{ gap: 8 }}>
        <Label>מילוי מהיר</Label>
        <Muted>כתבי או הקליטי (במיקרופון של המקלדת) משפט אחד, והטופס יתמלא. הסוג מזוהה מול סוגי האימונים שהגדרת. למשל: "{types?.[0]?.name ?? 'SCULPT'} שלישי ב־19:00, 10 משתתפות, כל שבוע".</Muted>
        <TextInput value={quickText} onChangeText={setQuickText} accessibilityLabel="מילוי מהיר של האימון" multiline placeholderTextColor="#8C7C72"
          placeholder={`${types?.[0]?.name ?? 'פונקציונלי'} ראשון ורביעי בשבע בערב, 12 מקומות`}
          style={{ ...GLASS.input, minHeight: 80, padding: 14, fontSize: 15.5, color: C.text, textAlign: 'right' }} />
        <Btn label="מילוי הטופס" variant="secondary" disabled={!quickText.trim()} onPress={applyQuick} />
        {quickResult && (
          <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
            {quickResult.filled.length > 0 && <Text style={{ fontSize: 14, color: C.success, textAlign: 'right' }}>מילאתי: {quickResult.filled.join(' · ')}</Text>}
            {quickResult.warnings.map((w) => <Text key={w} style={{ fontSize: 14, color: C.primaryDark, textAlign: 'right' }}>{w}</Text>)}
            <Muted>בדקי את הטופס למטה לפני השמירה.</Muted>
          </View>
        )}
      </Card>

      <Card style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Label>סוג אימון</Label>
          {!types && <Muted>טוענת את סוגי האימונים…</Muted>}
          <Wrap>{(types ?? []).map((t) => <Chip key={t.id} label={t.name} selected={typeId === t.id} onPress={() => setTypeId(t.id)} />)}</Wrap>
          {types && types.length === 0 && (
            <View style={{ gap: 6 }}>
              <Muted>עוד אין סוגי אימונים פעילים. צריך להגדיר לפחות אחד.</Muted>
              <Btn label="להגדרת סוגי אימונים" variant="secondary" onPress={() => router.push('/admin/class-types' as never)} />
            </View>
          )}
          {type && (
            <View style={{ borderRightWidth: 6, borderRightColor: type.color, paddingRight: 10, gap: 2 }}>
              {type.description ? <Muted>{type.description}</Muted> : null}
              {type.reminder_note ? <Muted>התזכורת תכלול: "{type.name} מתחיל ב־{time} ({type.reminder_note})"</Muted> : null}
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 7, minWidth: 0 }}><Label style={{ marginTop: 0 }}>תאריך</Label><NativePickerInput type="date" label="תאריך" value={date} onChange={setDate} /></View>
          <View style={{ flex: 1, gap: 7, minWidth: 0 }}><Label style={{ marginTop: 0 }}>שעה</Label><NativePickerInput type="time" label="שעה" value={time} onChange={setTime} /></View>
        </View>
        {extraDates.length > 0 && (
          <View style={{ gap: 6 }}>
            <Muted>ובאותה שעה גם (לחיצה מסירה):</Muted>
            <Wrap>{extraDates.map((d) => (
              <Chip key={d} label={`✕ יום ${dayLong(d)} ${dayMonthLabel(d)}`} selected onPress={() => setExtraDates(extraDates.filter((x) => x !== d))} />
            ))}</Wrap>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 28 }}>
          <View style={{ gap: 6 }}>
            <Label>מקום ל</Label>
            <Stepper value={capacity} onChange={setCapacity} min={1} max={60} label="משתתפות" />
          </View>
          <View style={{ gap: 6 }}>
            <Label>משך (דקות)</Label>
            <Stepper value={duration} onChange={setDuration} min={10} max={180} step={5} label="דקות" />
          </View>
        </View>
      </Card>

      <Disclosure title="הגדרות נוספות" summary={advancedSummary}>
        <View style={{ gap: 6 }}>
          <Label>מתי ההרשמה נפתחת</Label>
          <Wrap>
            <Chip label="ברירת מחדל (חמישי 20:00)" selected={openMode === 'weekly'} onPress={() => setOpenMode('weekly')} />
            <Chip label="מיד" selected={openMode === 'now'} onPress={() => setOpenMode('now')} />
            <Chip label="לפני האימון" selected={openMode === 'before'} onPress={() => setOpenMode('before')} />
            <Chip label="תאריך ושעה קבועים" selected={openMode === 'custom'} onPress={() => setOpenMode('custom')} />
          </Wrap>
          {openMode === 'before' && (
            <View style={{ gap: 4 }}>
              <Label>כמה ימים לפני האימון</Label>
              <Stepper value={beforeDays} onChange={setBeforeDays} min={1} max={30} label="ימים" />
            </View>
          )}
          {openMode === 'custom' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}><NativePickerInput type="date" label="תאריך פתיחת הרשמה" value={customDate} onChange={setCustomDate} /></View>
              <View style={{ flex: 1, minWidth: 0 }}><NativePickerInput type="time" label="שעת פתיחת הרשמה" value={customTime} onChange={setCustomTime} /></View>
            </View>
          )}
          {openPreview ? <Muted>ההרשמה תיפתח: {dateTimeLabel(openPreview)}{repeatWeeks ? ' (ובכל שבוע לפי אותו כלל)' : ''}</Muted> : null}
        </View>

        <View style={{ gap: 4 }}>
          <Label>אפשר לבטל עד (שעות לפני האימון)</Label>
          <Stepper value={cancelHours} onChange={setCancelOverride} min={1} max={48} label="שעות" />
          <Muted>ברירת מחדל: {CLASS_DEFAULTS.cancelHours} שעות, ו־{CLASS_DEFAULTS.morningCancelHours} לאימון בוקר (לפני {CLASS_DEFAULTS.morningBeforeHour}:00). {morning ? 'זה אימון בוקר.' : ''}</Muted>
        </View>

        <View style={{ gap: 4 }}>
          <Label>תזכורת למתאמנות (שעות לפני האימון)</Label>
          <Stepper value={reminderHours} onChange={(h) => setReminderOverride(h * 60)} min={1} max={24} label="שעות" />
          <Muted>ברירת מחדל: שעתיים, ו־13 שעות לאימון בוקר (כלומר בערב הקודם).</Muted>
        </View>

        <View style={{ gap: 4 }}>
          <Label>זמן לאישור מקום מרשימת המתנה (דקות)</Label>
          <Stepper value={waitMinutes} onChange={setWaitMinutes} min={5} max={120} step={1} label="דקות" />
        </View>

        <View style={{ gap: 4 }}>
          <Label>חזרה על האימון (שבועות נוספים)</Label>
          <Stepper value={repeatWeeks} onChange={setRepeatWeeks} min={0} max={12} label="שבועות" />
          <Muted>0 = בלי חזרה, רק האימון הזה.</Muted>
        </View>

        <View style={{ gap: 6 }}>
          <Label>הערות (אופציונלי)</Label>
          <TextInput value={notes} onChangeText={setNotes} accessibilityLabel="הערות" multiline placeholderTextColor="#8C7C72"
            style={{ ...GLASS.input, minHeight: 80, padding: 14, fontSize: 15.5, color: C.text, textAlign: 'right' }} />
        </View>
      </Disclosure>

      {message && (message.ok ? <Text style={{ color: C.success, textAlign: 'right' }}>{message.text}</Text> : <ErrorText>{message.text}</ErrorText>)}
      <Btn label={totalClasses > 1 ? `הוספת ${totalClasses} אימונים` : 'הוספת האימון'} busy={busy} disabled={!validDate || !validCustom || !typeId} onPress={create} />
    </Screen>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

function Stepper({ value, onChange, min, max, step = 1, label }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconBtn icon="remove" label={`הפחתת ${label}`} onPress={() => onChange(Math.max(min, value - step))} />
      <Text accessibilityLabel={`${value} ${label}`} style={{ fontSize: 17, fontWeight: '600', minWidth: 30, textAlign: 'center', color: C.text }}>{value}</Text>
      <IconBtn icon="add" label={`הוספת ${label}`} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}
