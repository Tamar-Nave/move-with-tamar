import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type GestureResponderEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND } from '@/lib/brand';

export const C = BRAND.colors;

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 520, padding: 20, gap: 14 }}>{children}</View>
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
  const bg = variant === 'primary' ? (disabled ? '#C9B2A6' : C.primary) : C.card;
  const fg = variant === 'primary' ? '#fff' : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.iconBtn, { backgroundColor: bg, borderColor: variant === 'primary' ? bg : C.border, opacity: pressed ? 0.8 : disabled ? 0.4 : 1 },
      ]}>
      <Ionicons name={icon} size={17} color={fg} />
    </Pressable>
  );
}

export function Btn({
  label, onPress, variant = 'primary', disabled, busy,
}: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; busy?: boolean }) {
  const off = disabled || busy;
  const bg = variant === 'primary' ? (off ? '#C9B2A6' : C.primary) : C.card;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? '#9A2B12' : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn, { backgroundColor: bg, borderColor: variant === 'primary' ? bg : C.border, opacity: pressed ? 0.85 : off && variant !== 'primary' ? 0.5 : 1 },
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
      style={[s.chip, selected && { backgroundColor: C.primary, borderColor: C.primary }]}>
      <Text style={{ color: selected ? '#fff' : C.text, fontSize: 14.5 }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'green' | 'orange' | 'red' | 'brand' | 'gray' }) {
  const t = {
    green: { bg: '#E3F1E6', fg: '#1F5F2E' },
    orange: { bg: '#FDEBD8', fg: '#8A3A0C' },
    red: { bg: '#FBE4E0', fg: '#9A2B12' },
    brand: { bg: C.primary, fg: '#fff' },
    gray: { bg: '#ECEAE6', fg: '#4A4641' },
  }[tone];
  return (
    <View style={{ backgroundColor: t.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: t.fg, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-forward" size={18} color={C.primaryDark} />
        <Text style={{ color: C.primaryDark, fontSize: 15 }}>{label}</Text>
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
  return <Text accessibilityRole="alert" style={{ color: '#9A2B12', fontSize: 14, textAlign: 'right' }}>{children}</Text>;
}

const s = StyleSheet.create({
  title: { fontSize: 25, fontWeight: '700', color: C.text, textAlign: 'right', letterSpacing: 0.1 },
  muted: { fontSize: 13.5, color: C.textMuted, textAlign: 'right', lineHeight: 19 },
  label: { fontSize: 13.5, fontWeight: '600', color: C.text, textAlign: 'right', marginTop: 4, letterSpacing: 0.1 },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 3px rgba(43,38,34,0.05)' } as object : {}),
  },
  btn: { minHeight: 48, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontSize: 15.5, fontWeight: '700' },
  iconBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 38, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
});
