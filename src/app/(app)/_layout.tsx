import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HealthPopup } from '@/components/health';
import { tabIcon, tabScreenOptions } from '@/components/tab-bar';
import { useAuth } from '@/lib/auth';

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
  const insets = useSafeAreaInsets();
  return (
    <>
      <Tabs safeAreaInsets={{ bottom: 0 }} screenOptions={tabScreenOptions(insets.bottom)}>
        <Tabs.Screen name="index" options={{ title: 'בית', tabBarIcon: tabIcon('home') }} />
        <Tabs.Screen name="schedule" options={{ title: 'לו״ז', tabBarIcon: tabIcon('calendar'), popToTopOnBlur: true }} listeners={backToList(router, '/schedule')} />
        <Tabs.Screen name="recipes" options={{ title: 'מתכונים', tabBarIcon: tabIcon('book'), popToTopOnBlur: true }} listeners={backToList(router, '/recipes')} />
        <Tabs.Screen name="profile" options={{ title: 'פרופיל', tabBarIcon: tabIcon('user') }} />
        {/* Reachable only from the home screen's "לכל ההודעות" button, not from the tab bar.
            `href: null` looked right but actually blocks navigating to the screen at all — hiding
            just the tab bar button (and keeping the screen itself fully reachable) needs this instead.
            `tabBarButton: () => null` alone still reserves this tab's equal-width slot in the bar,
            which showed up as an empty gap next to "ניהול" — `tabBarItemStyle` collapses that slot. */}
        <Tabs.Screen name="messages" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen
          name="admin"
          options={{ title: 'ניהול', tabBarIcon: tabIcon('settings'), popToTopOnBlur: true, href: profile?.is_admin ? undefined : null }}
          listeners={backToList(router, '/admin')}
        />
      </Tabs>
      <HealthPopup />
    </>
  );
}
