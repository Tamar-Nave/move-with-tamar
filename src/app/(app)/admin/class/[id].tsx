import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AdminRoster } from '@/components/admin-roster';
import { BackLink, Loading, Muted, Screen, Title } from '@/components/ui';
import { CLASS_SELECT, classColor, classDescription, classLabel, type ClassRow } from '@/lib/classes';
import { dateTimeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export default function AdminClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cls, setCls] = useState<ClassRow | null>(null);

  useEffect(() => {
    supabase.from('classes').select(CLASS_SELECT).eq('id', id).single().then(({ data }) => setCls((data as ClassRow | null) ?? null));
  }, [id]);

  if (!cls) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      {/* This screen is reached from the class page in the schedule tab, so "back" returns there (it lives in the admin tab, whose own history only has the admin menu). */}
      <BackLink label="חזרה לאימון" onPress={() => router.navigate(`/schedule/${id}` as never)} />
      <View style={{ borderRightWidth: classColor(cls) ? 6 : 0, borderRightColor: classColor(cls) ?? undefined, paddingRight: classColor(cls) ? 12 : 0 }}>
        <Title>{classLabel(cls)}</Title>
        <Muted>{dateTimeLabel(cls.starts_at)}</Muted>
        {classDescription(cls) ? <Muted>{classDescription(cls)}</Muted> : null}
      </View>
      <AdminRoster cls={cls} />
    </Screen>
  );
}
