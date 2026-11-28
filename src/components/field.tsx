import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { C } from '@/components/ui';
import { GLASS } from '@/lib/theme';

export function Field({ label, ltr, ...props }: { label: string; ltr?: boolean } & TextInputProps) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.text, textAlign: 'right' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8C7C72"
        {...props}
        style={[
          { ...GLASS.input, minHeight: 46, paddingHorizontal: 14, fontSize: 15.5, color: C.text, textAlign: ltr ? 'left' : 'right' },
          ltr ? { writingDirection: 'ltr' } : null,
          props.style,
        ]}
      />
    </View>
  );
}
