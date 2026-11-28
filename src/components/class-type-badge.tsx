import { Text, View } from 'react-native';

import { C } from '@/components/ui';
import type { ClassTypeRow } from '@/lib/class-types';
import { classLabel, type ClassRow } from '@/lib/classes';

/** Name of a class as plain text. Its colour is shown as a stripe on the side of the block that contains it. */
export function ClassName({ cls, size = 17 }: { cls: Pick<ClassRow, 'kind' | 'class_types'>; size?: number }) {
  return <Text style={{ fontSize: size, fontWeight: '600', color: C.text, textAlign: 'right' }}>{classLabel(cls)}</Text>;
}

/** Colour dot + name (used where types themselves are listed). */
export function ClassTypeBadge({ type, fallback }: { type: Pick<ClassTypeRow, 'name' | 'color' | 'is_active'> | null | undefined; fallback?: string }) {
  if (!type) return <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.text, textAlign: 'right' }}>{fallback ?? 'אימון'}</Text>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: type.color }} />
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.text }}>{type.name}{type.is_active ? '' : ' (לא פעיל)'}</Text>
    </View>
  );
}
