// A glass track with a few options; the chosen one is lifted in a soft terracotta-tinted pill.
import { Pressable, Text, View } from 'react-native';

import { C } from '@/components/ui';
import { GLASS, webOnly } from '@/lib/theme';

export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={{
      flexDirection: 'row', padding: 5, borderRadius: 999, borderWidth: 1, borderColor: GLASS.edge,
      backgroundColor: 'rgba(255,255,255,0.48)', ...webOnly({ boxShadow: 'inset 0 1px 4px rgba(92,74,66,0.08)' }),
    }}>
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(key)}
            style={{
              flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
              backgroundColor: on ? '#FBF3EA' : 'transparent',
              ...(on ? webOnly({ backgroundImage: `linear-gradient(150deg, #fff, ${C.primarySoft})`, boxShadow: '0 4px 12px rgba(92,74,66,0.12)' }) : {}),
            }}>
            <Text style={{ fontSize: 14.5, fontWeight: on ? '600' : '400', color: on ? C.primary : C.textMuted }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
