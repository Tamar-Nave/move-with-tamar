import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';

const C = BRAND.colors;

function icon(name: React.ComponentProps<typeof Ionicons>['name']) {
  return ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
}

// A tab link would otherwise carry the id of the last opened class (/schedule?id=...) and reopen it.
// Tapping these tabs always opens the tab's list.
function backToList(router: { navigate: (href: never) => void }, path: string) {
  return {
    tabPress: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      router.navigate(path as never);
    },
  };
}

export default function AppLayout() {
  const router = useRouter();
  const { profile } = useAuth();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, height: 72, paddingTop: 8, paddingBottom: 12 },
        tabBarLabelStyle: { fontSize: 12 },
        sceneStyle: { backgroundColor: C.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'בית', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: 'לו״ז', tabBarIcon: icon('calendar-outline'), popToTopOnBlur: true }} listeners={backToList(router, '/schedule')} />
      <Tabs.Screen name="recipes" options={{ title: 'מתכונים', tabBarIcon: icon('book-outline'), popToTopOnBlur: true }} listeners={backToList(router, '/recipes')} />
      <Tabs.Screen name="profile" options={{ title: 'פרופיל', tabBarIcon: icon('person-outline') }} />
      {/* Reachable only from the home screen's "לכל ההודעות" button, not from the tab bar.
          `href: null` looked right but actually blocks navigating to the screen at all — hiding
          just the tab bar button (and keeping the screen itself fully reachable) needs this instead.
          `tabBarButton: () => null` alone still reserves this tab's equal-width slot in the bar,
          which showed up as an empty gap next to "ניהול" — `tabBarItemStyle` collapses that slot. */}
      <Tabs.Screen name="messages" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen
        name="admin"
        options={{ title: 'ניהול', tabBarIcon: icon('settings-outline'), popToTopOnBlur: true, href: profile?.is_admin ? undefined : null }}
        listeners={backToList(router, '/admin')}
      />
    </Tabs>
  );
}
