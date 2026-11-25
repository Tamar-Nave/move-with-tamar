import { Stack } from 'expo-router';

import { BRAND } from '@/lib/brand';

// Always keep the schedule list under any class details, so the tab never gets stuck on one class.
export const unstable_settings = { anchor: 'index' };

export default function ScheduleLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BRAND.colors.background } }} />;
}
