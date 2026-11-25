import { Stack } from 'expo-router';

import { BRAND } from '@/lib/brand';

export const unstable_settings = { anchor: 'index' };

export default function RecipesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BRAND.colors.background } }} />;
}
