// Small pieces of the recipe editor.
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { C } from '@/components/ui';
import { GLASS } from '@/lib/theme';
import { fmtNum } from '@/lib/recipe-engine';

const smallBtn = {
  ...GLASS.soft, minHeight: 36, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, justifyContent: 'center' as const,
};

export function LinkBtn({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[smallBtn, disabled && { opacity: 0.45 }]}>
      <Text style={{ fontSize: 13.5, fontWeight: '500', color: danger ? C.danger : C.primary }}>{label}</Text>
    </Pressable>
  );
}

/** Numeric text field that keeps what is typed ("1.", "0,") and reports a number (or null when empty). */
export function NumField({ label, value, onChange, placeholder, width }: { label: string; value: number | null; onChange: (n: number | null) => void; placeholder?: string; width?: number }) {
  const [text, setText] = useState(fmtNum(value));
  useEffect(() => {
    const parsed = Number(text.replace(',', '.'));
    const same = (value == null && text.trim() === '') || (value != null && Number.isFinite(parsed) && Math.abs(parsed - value) < 0.0051);
    if (!same) setText(fmtNum(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <View style={{ gap: 4, width, flex: width ? undefined : 1, minWidth: 0 }}>
      <Text style={{ fontSize: 13, color: C.text, textAlign: 'right' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label} value={text} placeholder={placeholder} placeholderTextColor="#8C7C72" inputMode="decimal" keyboardType="decimal-pad"
        onChangeText={(t) => {
          setText(t);
          const clean = t.replace(',', '.').trim();
          if (clean === '') onChange(null);
          else if (/^\d*\.?\d*$/.test(clean) && clean !== '.') onChange(Number(clean));
        }}
        style={{ ...GLASS.input, minHeight: 46, paddingHorizontal: 12, fontSize: 15.5, color: C.text, textAlign: 'right' }}
      />
    </View>
  );
}
