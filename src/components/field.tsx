import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { C } from '@/components/ui';

export function Field({ label, ltr, ...props }: { label: string; ltr?: boolean } & TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, color: C.text, textAlign: 'right' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8A857E"
        {...props}
        style={[
          { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', paddingHorizontal: 12, fontSize: 15.5, color: C.text, textAlign: ltr ? 'left' : 'right' },
          ltr ? { writingDirection: 'ltr' } : null,
          props.style,
        ]}
      />
    </View>
  );
}
