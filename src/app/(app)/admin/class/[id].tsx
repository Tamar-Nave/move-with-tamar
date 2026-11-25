import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AdminRoster } from '@/components/admin-roster';
import { BackLink, Loading, Muted, Screen, Title } from '@/components/ui';
import { KIND_LABEL, type ClassRow } from '@/lib/classes';
import { dateTimeLabel } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export default function AdminClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cls, setCls] = useState<ClassRow | null>(null);

  useEffect(() => {
    supabase.from('classes').select('*').eq('id', id).single().then(({ data }) => setCls((data as ClassRow | null) ?? null));
  }, [id]);

  if (!cls) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <BackLink label="חזרה לניהול" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin' as never))} />
      <View>
        <Title>{KIND_LABEL[cls.kind]}</Title>
        <Muted>{dateTimeLabel(cls.starts_at)}</Muted>
      </View>
      <AdminRoster cls={cls} />
    </Screen>
  );
}
