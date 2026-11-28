import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Card, C, Muted, Screen, Title } from '@/components/ui';
import { webOnly } from '@/lib/theme';

function MenuCard({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', ...webOnly({ backgroundImage: 'linear-gradient(150deg, rgba(237,214,191,0.75), #F8F4EC)' }) }}>
          <Icon name={icon} size={22} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: C.text, textAlign: 'right' }}>{title}</Text>
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
      <MenuCard icon="users" title="מתאמנות ומנויים" subtitle="הזמנת מתאמנת, מנוי וכניסות" onPress={() => router.push('/admin/members' as never)} />
      <MenuCard icon="plus" title="אימון חדש" subtitle="הוספת אימון ללו״ז, כולל חזרה שבועית" onPress={() => router.push('/admin/new-class' as never)} />
      <MenuCard icon="megaphone" title="הודעה חדשה" subtitle="הודעה לכל המתאמנות או לקבוצה" onPress={() => router.push('/admin/new-message' as never)} />
      <MenuCard icon="food" title="מתכונים" subtitle="הוספה ועריכה של מתכונים, כולל תמונה וחלופות" onPress={() => router.push('/admin/recipes' as never)} />
      <MenuCard icon="palette" title="סוגי אימונים" subtitle="שם, תיאור, צבע והערת תזכורת לכל סוג אימון" onPress={() => router.push('/admin/class-types' as never)} />
      <MenuCard icon="calendarCheck" title="יומן גוגל של הסטודיו" subtitle="כל האימונים שהוספת, ביומן שלך אוטומטית" onPress={() => router.push('/admin/studio-calendar' as never)} />
      <Muted>לניהול משתתפות, נוכחות וביטול של אימון מסוים: לוחצים על האימון בלשונית לו״ז.</Muted>
    </Screen>
  );
}
