// The floating glass tab bar: shared look for the bottom tabs.
import { Icon, type IconName } from '@/components/icon';
import { BRAND } from '@/lib/brand';
import { BADGE_TONES, GLASS, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/lib/theme';

const C = BRAND.colors;

export function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: unknown }) {
    return <Icon name={name} color={color as string} />;
  };
}

export function tabScreenOptions(bottomInset: number) {
  return {
    headerShown: false,
    tabBarActiveTintColor: C.primary,
    tabBarInactiveTintColor: C.textMuted,
    tabBarActiveBackgroundColor: BADGE_TONES.brand.bg,
    // Floats above the content (screens leave room for it at the bottom, see Screen in ui.tsx).
    tabBarStyle: {
      ...GLASS.bar,
      position: 'absolute' as const, left: TAB_BAR_GAP, right: TAB_BAR_GAP, bottom: Math.max(bottomInset, TAB_BAR_GAP),
      maxWidth: 492, marginHorizontal: 'auto' as const,
      height: TAB_BAR_HEIGHT, paddingTop: 6, paddingBottom: 6, paddingHorizontal: 6,
      borderRadius: 32, borderWidth: 1, borderTopWidth: 1, borderTopColor: GLASS.edge,
    },
    tabBarItemStyle: { borderRadius: 26, overflow: 'hidden' as const },
    tabBarLabelStyle: { fontSize: 11.5, fontWeight: '500' as const },
    tabBarLabelPosition: 'below-icon' as const, // also on wide screens, where beside-icon truncates the Hebrew labels
    sceneStyle: { backgroundColor: C.background },
  };
}
