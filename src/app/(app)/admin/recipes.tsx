import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { BackLink, Btn, Card, C, Loading, Muted, Screen, Title } from '@/components/ui';
import { recipeCategories, type Recipe } from '@/lib/recipes';
import { supabase } from '@/lib/supabase';

export default function AdminRecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    setRecipes((data as Recipe[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <BackLink label="חזרה לניהול" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin' as never))} />
      <Title>מתכונים</Title>
      <Btn label="+ מתכון חדש" onPress={() => router.push('/admin/recipe/new' as never)} />
      {!recipes && <Loading />}
      {recipes?.length === 0 && <Muted>עוד אין מתכונים.</Muted>}
      {recipes?.map((r) => (
        <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/admin/recipe/${r.id}` as never)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EFE5D6', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {r.image_url ? <Image source={{ uri: r.image_url }} style={{ width: '100%', height: '100%' }} /> : <Icon name="food" size={24} color="#B7A797" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'right' }}>{r.title}</Text>
              <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right' }}>{recipeCategories(r).join(', ')}</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={C.textMuted} />
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
