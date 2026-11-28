// The top of the profile page. These pieces only display what they are given.
import { Image, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Ring, RingCaption, RingCard } from '@/components/ring-card';
import { C } from '@/components/ui';
import { GLASS, webOnly } from '@/lib/theme';
import type { GoalPlan } from '@/lib/progress';

export function ProfileHeader({ name, initials, avatarUrl, subtitle, excellent }: {
  name: string; initials: string; avatarUrl: string | null | undefined; subtitle: string; excellent: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={s.avatar}>
        {avatarUrl
          ? <Image source={{ uri: avatarUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} accessibilityLabel={name} />
          : <Text style={s.initials}>{initials}</Text>}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 6 }}>
          <Text style={s.name}>{name}</Text>
          {excellent && (
            // the moving shine is added in web-setup.ts
            <View style={s.badge} {...({ dataSet: { shine: '1' } } as object)}>
              <Icon name="star" color="#5A3A06" size={13} />
              <Text style={s.badgeText}>מצטיינת</Text>
            </View>
          )}
        </View>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const TILES: { icon: IconName; color: string; from: string; to: string }[] = [
  { icon: 'calendarCheck', color: '#5F7D57', from: '#DFE8D6', to: '#FAFBF5' },
  { icon: 'trophy', color: '#9A6B12', from: '#F6E4B4', to: '#FDF7E8' },
  { icon: 'flame', color: C.primary, from: '#F3D3C2', to: '#FCF0E8' },
];

export function StatTiles({ month, total, streakWeeks }: { month: number; total: number; streakWeeks: number }) {
  const values: [number, string][] = [[month, 'הגעות החודש'], [total, 'סה״כ הגעות'], [streakWeeks, 'שבועות ברצף']];
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {values.map(([value, label], i) => (
        <View key={label} style={s.stat}>
          <View style={[s.bubble, { backgroundColor: TILES[i].from }, webOnly({ backgroundImage: `linear-gradient(150deg, ${TILES[i].from}, ${TILES[i].to})` })]}>
            <Icon name={TILES[i].icon} color={TILES[i].color} size={20} />
          </View>
          <Text style={s.value}>{value}</Text>
          <Text style={s.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** An 8-entry card shows progress towards the card; an unlimited plan shows this month's count. */
export function GoalCard({ plan, attended }: { plan: NonNullable<GoalPlan>; attended: number }) {
  if (plan.plan === 'unlimited') {
    return (
      <RingCard title="החודש שלי" tile={<><Ring fraction={1} value={attended} halo label={`${attended} אימונים החודש`} /><RingCaption>אימונים</RingCaption></>} />
    );
  }
  const goal = plan.entries_per_month;
  const percent = goal ? Math.min(100, Math.round((attended / goal) * 100)) : 0;
  return (
    <RingCard title="יעד חודשי" tile={<Ring fraction={percent / 100} value={`${percent}%`} label={`${percent}% מהיעד`} />}>
      <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right' }}>{attended} מתוך {goal} אימונים</Text>
    </RingCard>
  );
}

const s = StyleSheet.create({
  avatar: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: C.primary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3E4D6', ...webOnly({ backgroundImage: 'linear-gradient(150deg, #EDD6BF, #F1ECE2)', boxShadow: '0 8px 18px rgba(92,74,66,0.16)' }),
  },
  initials: { color: C.primary, fontSize: 22, fontWeight: '600' },
  name: { fontSize: 22, fontWeight: '600', color: C.text, textAlign: 'right' },
  subtitle: { fontSize: 13, color: C.textMuted, textAlign: 'right' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 13, paddingVertical: 5, backgroundColor: '#F6CF74', overflow: 'hidden',
    ...webOnly({ backgroundImage: 'linear-gradient(135deg, #FCEBB2 0%, #F2C55C 55%, #F9DE93 100%)', boxShadow: '0 0 0 3px rgba(246,208,110,0.28), 0 8px 18px rgba(214,160,40,0.42)' }),
  },
  badgeText: { color: '#5A3A06', fontSize: 13, fontWeight: '600' },
  stat: { ...GLASS.card, flex: 1, borderRadius: 26, padding: 6, paddingBottom: 12, alignItems: 'center', gap: 4 },
  bubble: { alignSelf: 'stretch', height: 44, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 28, fontWeight: '600', color: '#5C4A42', lineHeight: 34 },
  label: { fontSize: 12, color: C.textMuted, textAlign: 'center' },
});
