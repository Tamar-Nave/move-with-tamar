import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, C, Muted, Screen, Title } from '@/components/ui';

function MenuCard({ icon, title, subtitle, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={24} color={C.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'right' }}>{title}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right' }}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-back" size={20} color={C.textMuted} />
      </Card>
    </Pressable>
  );
}

export default function AdminHome() {
  const router = useRouter();
  return (
    <Screen>
      <Title>ניהול</Title>
      <MenuCard icon="add-circle-outline" title="אימון חדש" subtitle="הוספת אימון ללו״ז, כולל חזרה שבועית" onPress={() => router.push('/admin/new-class' as never)} />
      <MenuCard icon="megaphone-outline" title="הודעה חדשה" subtitle="הודעה לכל המתאמנות או לקבוצה" onPress={() => router.push('/admin/new-message' as never)} />
      <MenuCard icon="people-outline" title="מתאמנות ומנויים" subtitle="הזמנת מתאמנת, מנוי וכניסות" onPress={() => router.push('/admin/members' as never)} />
      <MenuCard icon="restaurant-outline" title="מתכונים" subtitle="הוספה ועריכה של מתכונים, כולל תמונה וחלופות" onPress={() => router.push('/admin/recipes' as never)} />
      <Muted>לניהול משתתפות, נוכחות וביטול של אימון מסוים: לוחצים על האימון בלשונית לו״ז.</Muted>
    </Screen>
  );
}
