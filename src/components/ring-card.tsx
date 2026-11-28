// A card with text on the right and a progress ring inside a tinted tile on the left
// ("המנוי שלי" on the home screen, the monthly goal on the profile).
import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { C, Card } from '@/components/ui';
import { webOnly } from '@/lib/theme';

const SIZE = 88;
const STROKE = 8;
const R = 36;
const LENGTH = 2 * Math.PI * R;

/** `fraction` is 0..1. `halo` adds a soft outer circle (used when there is no upper limit). */
export function Ring({ fraction, value, halo, label }: { fraction: number; value: string | number; halo?: boolean; label: string }) {
  const gradient = 'ring' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const filled = Math.max(0, Math.min(1, fraction));
  return (
    <View style={[s.ring, halo && { marginVertical: 4 }]} accessible accessibilityLabel={label}>
      {halo && <View style={s.halo} />}
      <View style={s.disc} />
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#9A4630" />
            <Stop offset="1" stopColor="#D28C69" />
          </LinearGradient>
        </Defs>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.85)" strokeWidth={STROKE} fill="none" />
        {filled > 0 && (
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={`url(#${gradient})`} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={`${LENGTH * filled} ${LENGTH}`} />
        )}
      </Svg>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

export const RingCaption = ({ children }: { children: ReactNode }) => <Text style={s.caption}>{children}</Text>;

export function RingCard({ title, children, tile }: { title: string; children?: ReactNode; tile?: ReactNode }) {
  return (
    <Card style={s.card}>
      <View style={s.text}>
        <Text style={s.title}>{title}</Text>
        {children}
      </View>
      {tile && <View style={s.tile}>{tile}</View>}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  text: { flex: 1, gap: 3, paddingHorizontal: 6, alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '600', color: C.text, textAlign: 'right' },
  tile: {
    width: '47%', minWidth: 156, maxWidth: 230, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 22,
    backgroundColor: 'rgba(237,214,191,0.55)',
    ...webOnly({ backgroundImage: 'linear-gradient(150deg, rgba(237,214,191,0.72), rgba(240,237,230,0.7))' }),
  },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', ...webOnly({ filter: 'drop-shadow(0 6px 10px rgba(166,78,55,0.22))' }) },
  disc: { position: 'absolute', top: 11, bottom: 11, left: 11, right: 11, borderRadius: SIZE, backgroundColor: 'rgba(255,255,255,0.85)' },
  halo: {
    position: 'absolute', top: -5, bottom: -5, left: -5, right: -5, borderRadius: SIZE, borderWidth: 1, borderColor: 'rgba(166,78,55,0.4)',
    ...webOnly({ boxShadow: '0 0 20px #EDD6BF' }),
  },
  value: { fontSize: 22, fontWeight: '600', color: '#5C4A42' },
  caption: { fontSize: 12, fontWeight: '600', color: '#5C4A42', textAlign: 'center', lineHeight: 15 },
});
