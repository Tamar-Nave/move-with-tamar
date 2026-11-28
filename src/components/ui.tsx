import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
  type GestureResponderEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND } from '@/lib/brand';
import { BADGE_TONES, GLASS, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/lib/theme';

export const C = BRAND.colors;

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={[{ flex: 1 }, GLASS.screen]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        {/* the bottom padding keeps the last item above the floating tab bar */}
        <View style={{ width: '100%', maxWidth: 520, padding: 20, paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_GAP * 2 + 12, gap: 14 }}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export const Title = ({ children }: { children: ReactNode }) => <Text style={s.title}>{children}</Text>;
export const Muted = ({ children, style }: { children: ReactNode; style?: object }) => (
  <Text style={[s.muted, style]}>{children}</Text>
);
export const Label = ({ children, style }: { children: ReactNode; style?: object }) => <Text style={[s.label, style]}>{children}</Text>;

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** A small fixed-size square button for a single glyph (+ / − / icon) — never stretches like a label button. */
export function IconBtn({
  icon, onPress, label, variant = 'secondary', disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap; onPress: (e: GestureResponderEvent) => void; label: string;
  variant?: 'secondary' | 'primary'; disabled?: boolean;
}) {
  const fg = variant === 'primary' ? '#fff' : icon === 'logo-whatsapp' ? '#2F7D4F' : C.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.iconBtn, variant === 'primary' ? GLASS.primary : GLASS.soft,
        { opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}>
      <Ionicons name={icon} size={17} color={fg} />
    </Pressable>
  );
}

export function Btn({
  label, onPress, variant = 'primary', disabled, busy,
}: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'health'; disabled?: boolean; busy?: boolean }) {
  const off = disabled || busy;
  // Danger is outlined, never filled, so it can't be mistaken for the terracotta main action.
  const filled = variant === 'primary' || variant === 'health';
  const look = filled ? (off ? s.btnOff : variant === 'health' ? GLASS.health : GLASS.primary) : variant === 'danger' ? [GLASS.soft, s.btnDanger] : GLASS.soft;
  const fg = filled ? (off ? '#9C8B81' : '#fff') : variant === 'danger' ? C.danger : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn, look, { opacity: off && !filled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [s.chip, selected ? GLASS.primary : GLASS.soft, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Text style={{ color: selected ? '#fff' : C.text, fontSize: 14, fontWeight: selected ? '600' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'green' | 'orange' | 'red' | 'brand' | 'gray' }) {
  const t = BADGE_TONES[tone];
  return (
    <View style={{ backgroundColor: t.bg, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: t.fg, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <View style={[s.back, GLASS.soft]}>
        <Ionicons name="chevron-forward" size={17} color={C.primary} />
        <Text style={{ color: C.primary, fontSize: 14, fontWeight: '500' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** A collapsible card section. Collapsed, it shows a one-line summary instead of its contents — for settings people rarely need to change. */
export function Disclosure({
  title, summary, children, defaultOpen,
}: { title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { marginTop: 0, fontWeight: '600' }]}>{title}</Text>
          {!open && summary ? <Muted>{summary}</Muted> : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} style={{ marginTop: 3 }} />
      </Pressable>
      {open && <View style={{ gap: 10 }}>{children}</View>}
    </View>
  );
}

export function Loading() {
  return <ActivityIndicator size={28} color={C.primary} style={{ marginTop: 40 }} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="alert" style={{ color: C.danger, fontSize: 14, textAlign: 'right' }}>{children}</Text>;
}

const s = StyleSheet.create({
  title: { fontSize: 25, fontWeight: '600', color: C.text, textAlign: 'right', letterSpacing: -0.2 },
  muted: { fontSize: 13.5, color: C.textMuted, textAlign: 'right', lineHeight: 21 },
  label: { fontSize: 13.5, fontWeight: '600', color: C.text, textAlign: 'right', marginTop: 4, letterSpacing: 0.1 },
  card: { ...GLASS.card, padding: 18, gap: 10 },
  btn: { minHeight: 48, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 8 },
  btnText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  btnOff: { backgroundColor: 'rgba(235,229,218,0.85)', borderColor: 'transparent' },
  btnDanger: { borderWidth: 1.5, borderColor: 'rgba(154,43,18,0.34)' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 40, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 36, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13 },
});
