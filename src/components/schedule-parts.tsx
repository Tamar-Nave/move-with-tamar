// Pieces of the schedule tab. They only display what they are given.
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { Badge, C, Card } from '@/components/ui';
import { classColor, classDescription, classLabel, type ClassRow } from '@/lib/classes';
import { dayLong, dayMonthLabel, dayNumber, dayShort, timeLabel, weekRangeLabel, ymdOf } from '@/lib/dates';
import { GLASS, tintOf, webOnly } from '@/lib/theme';

export type BadgeSpec = { label: string; tone: 'green' | 'orange' | 'brand' | 'gray' };

export function WeekNav({ weekStart, onChange }: { weekStart: string; onChange: (delta: number) => void }) {
  const arrow = (delta: number, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => onChange(delta)}
      style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, GLASS.soft, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
      {/* right-to-left: "back in time" points to the right */}
      <Icon name={delta < 0 ? 'chevronRight' : 'chevronLeft'} color={C.primary} size={20} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {arrow(-1, 'שבוע קודם')}
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>{weekRangeLabel(weekStart)}</Text>
      {arrow(1, 'שבוע הבא')}
    </View>
  );
}

export function DayStrip({ days, selected, hasClass, onSelect }: {
  days: string[]; selected: string; hasClass: (day: string) => boolean | undefined; onSelect: (day: string) => void;
}) {
  return (
    <Card style={{ flexDirection: 'row', gap: 2, padding: 6 }}>
      {days.map((d) => {
        const on = d === selected;
        return (
          <Pressable
            key={d} accessibilityRole="button" accessibilityLabel={`${dayLong(d)} ${dayMonthLabel(d)}`} accessibilityState={{ selected: on }}
            onPress={() => onSelect(d)}
            style={[{ flex: 1, minHeight: 66, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 2 }, on ? GLASS.primary : null]}>
            <Text style={{ fontSize: 12, color: on ? '#fff' : C.textMuted }}>{dayShort(d)}</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: on ? '#fff' : C.text }}>{dayNumber(d)}</Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasClass(d) ? (on ? '#fff' : C.primary) : 'transparent' }} />
          </Pressable>
        );
      })}
    </Card>
  );
}

const stripe = (color: string | null): ViewStyle => (color ? { borderRightWidth: 5, borderRightColor: color } : {});
const tile = (color: string): ViewStyle => ({
  backgroundColor: tintOf(color, 0.16),
  ...webOnly({ backgroundImage: `linear-gradient(150deg, ${tintOf(color, 0.28)}, ${tintOf(color, 0.1)})` }),
});
const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 };

/** One class of the chosen day. A class she is registered to gets a terracotta frame. */
export function ClassListItem({ cls, taken, badge, registered, onPress }: {
  cls: ClassRow; taken: number | null; badge: BadgeSpec; registered: boolean; onPress: () => void;
}) {
  const color = classColor(cls);
  const frame: ViewStyle = registered ? { borderWidth: 2, borderColor: 'rgba(166,78,55,0.7)' } : {};
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ ...row, ...frame, ...stripe(color) }}>
        <View style={[{ width: 62, minHeight: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, tile(color ?? C.primary)]}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: C.text }}>{timeLabel(cls.starts_at)}</Text>
          <Text style={{ fontSize: 11.5, color: C.textMuted }}>{cls.duration_min} דק׳</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'right' }}>{classLabel(cls)}</Text>
          {classDescription(cls) ? <Text numberOfLines={1} style={{ fontSize: 12.5, color: C.textMuted, textAlign: 'right' }}>{classDescription(cls)}</Text> : null}
          <Text style={{ fontSize: 12.5, color: C.textMuted, textAlign: 'right' }}>{taken != null ? `${taken} מתוך ${cls.capacity}` : ' '}</Text>
        </View>
        <View style={{ maxWidth: 112 }}><Badge label={badge.label} tone={badge.tone} /></View>
      </Card>
    </Pressable>
  );
}

/** One of her registrations: a date tile instead of the time. */
export function BookingListItem({ cls, badge, onPress }: { cls: ClassRow; badge: BadgeSpec | null; onPress: () => void }) {
  const day = ymdOf(new Date(cls.starts_at));
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ ...row, ...stripe(classColor(cls)) }}>
        <View style={[{ width: 56, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2E6D9' }, webOnly({ backgroundImage: 'linear-gradient(150deg, rgba(237,214,191,0.72), #FBF7F0)' })]}>
          <Text style={{ fontSize: 12, color: C.textMuted }}>{dayLong(day)}</Text>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#5C4A42' }}>{Number(day.slice(8))}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'right' }}>{classLabel(cls)}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right' }}>{dayMonthLabel(day)} · {timeLabel(cls.starts_at)}</Text>
        </View>
        {badge && <View style={{ maxWidth: 112 }}><Badge label={badge.label} tone={badge.tone} /></View>}
      </Card>
    </Pressable>
  );
}
