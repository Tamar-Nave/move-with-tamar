import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { RecipeDisclaimer } from '@/components/recipe-disclaimer';
import { Chip, C, Loading, Muted, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { RECIPE_CATEGORIES, recipeCategories, type Recipe } from '@/lib/recipes';
import { supabase } from '@/lib/supabase';
import { GLASS } from '@/lib/theme';

export default function RecipesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!session) return;
    const [r, f] = await Promise.all([
      supabase.from('recipes').select('*, recipe_ingredients(text)').order('created_at', { ascending: false }),
      supabase.from('recipe_favorites').select('recipe_id').eq('user_id', session.user.id),
    ]);
    setRecipes((r.data as Recipe[]) ?? []);
    setFavs(new Set(((f.data as { recipe_id: string }[]) ?? []).map((x) => x.recipe_id)));
  }, [session]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleFav(id: string) {
    if (!session) return;
    const next = new Set(favs);
    if (favs.has(id)) {
      next.delete(id);
      setFavs(next);
      await supabase.from('recipe_favorites').delete().eq('user_id', session.user.id).eq('recipe_id', id);
    } else {
      next.add(id);
      setFavs(next);
      await supabase.from('recipe_favorites').insert({ user_id: session.user.id, recipe_id: id });
    }
  }

  const q = query.trim();
  const shown = (recipes ?? []).filter((r) => {
    if (filter === 'favorites' && !favs.has(r.id)) return false;
    if (filter !== 'all' && filter !== 'favorites' && !recipeCategories(r).includes(filter)) return false;
    if (!q) return true;
    return r.title.includes(q) || (r.recipe_ingredients ?? []).some((i) => i.text.includes(q));
  });
  const usedCategories = RECIPE_CATEGORIES.filter((c) => (recipes ?? []).some((r) => recipeCategories(r).includes(c)));

  return (
    <Screen>
      <Title>מתכונים</Title>

      <View style={{ ...GLASS.input, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingHorizontal: 16, minHeight: 48 }}>
        <Icon name="search" size={20} color={C.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="חיפוש מתכון או מצרך" placeholderTextColor="#8C7C72"
          accessibilityLabel="חיפוש מתכון או מצרך" style={{ flex: 1, fontSize: 16, color: C.text, textAlign: 'right', minHeight: 44 }} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="הכל" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="♡ מועדפים" selected={filter === 'favorites'} onPress={() => setFilter('favorites')} />
        {usedCategories.map((c) => <Chip key={c} label={c} selected={filter === c} onPress={() => setFilter(c)} />)}
      </View>

      {!recipes && <Loading />}
      {recipes && shown.length === 0 && (
        <Muted>{filter === 'favorites' ? 'עוד אין מתכונים במועדפים. לוחצים על הלב כדי לשמור מתכון.' : 'לא נמצאו מתכונים.'}</Muted>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {shown.map((r) => (
          <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={r.title} onPress={() => router.push(`/recipes/${r.id}` as never)}
            style={{ ...GLASS.card, width: '47%', flexGrow: 1, borderRadius: 24, padding: 6 }}>
            <View style={{ height: 120, borderRadius: 19, overflow: 'hidden', backgroundColor: '#EFE5D6', alignItems: 'center', justifyContent: 'center' }}>
              {r.image_url
                ? <Image source={{ uri: r.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
                : <Icon name="food" size={34} color="#B7A797" />}
              <Pressable accessibilityRole="button" accessibilityLabel={favs.has(r.id) ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
                onPress={(e) => { e.stopPropagation?.(); toggleFav(r.id); }}
                style={{ ...GLASS.soft, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, position: 'absolute', top: 8, left: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={favs.has(r.id) ? 'heartFilled' : 'heart'} size={20} color={favs.has(r.id) ? C.primary : C.textMuted} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 6, paddingTop: 8, paddingBottom: 6, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: C.text, textAlign: 'right' }}>{r.title}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'right' }}>{recipeCategories(r).join(', ')}{r.minutes ? ` · ${r.minutes} דק׳` : ''}</Text>
              {r.calories ? <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'right' }}>{r.calories} קל׳{r.protein_g ? ` · ${r.protein_g} ג׳ חלבון` : ''}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
      <RecipeDisclaimer />
    </Screen>
  );
}
