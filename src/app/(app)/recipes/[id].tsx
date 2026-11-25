import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { RecipeDisclaimer } from '@/components/recipe-disclaimer';
import { BackLink, Card, C, Loading, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Recipe } from '@/lib/recipes';
import { supabase } from '@/lib/supabase';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fav, setFav] = useState(false);
  const [tab, setTab] = useState<'ingredients' | 'steps'>('ingredients');
  const [openSubs, setOpenSubs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!session) return;
    Promise.all([
      supabase.from('recipes').select('*, recipe_ingredients(*)').eq('id', id).single(),
      supabase.from('recipe_favorites').select('recipe_id').eq('user_id', session.user.id).eq('recipe_id', id),
    ]).then(([r, f]) => {
      const data = r.data as Recipe | null;
      if (data?.recipe_ingredients) data.recipe_ingredients.sort((a, b) => a.position - b.position);
      setRecipe(data);
      setFav(((f.data as unknown[]) ?? []).length > 0);
      setLoaded(true);
    });
  }, [id, session]);

  async function toggleFav() {
    if (!session) return;
    setFav(!fav);
    if (fav) await supabase.from('recipe_favorites').delete().eq('user_id', session.user.id).eq('recipe_id', id);
    else await supabase.from('recipe_favorites').insert({ user_id: session.user.id, recipe_id: id });
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/recipes' as never));
  if (!loaded) return <Screen><Loading /></Screen>;
  if (!recipe) return <Screen><BackLink label="חזרה למתכונים" onPress={back} /><Title>המתכון לא נמצא</Title></Screen>;

  const nutrition = [
    ['קלוריות', recipe.calories, ''], ['חלבון', recipe.protein_g, ' ג׳'], ['פחמימות', recipe.carbs_g, ' ג׳'], ['שומן', recipe.fat_g, ' ג׳'],
  ].filter(([, v]) => v !== null && v !== undefined) as [string, number, string][];

  return (
    <Screen>
      <BackLink label="חזרה למתכונים" onPress={back} />
      {recipe.image_url && (
        <Image source={{ uri: recipe.image_url }} style={{ width: '100%', height: 220, borderRadius: 16 }} resizeMode="cover" accessibilityLabel={recipe.title} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Title>{recipe.title}</Title>
          <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right' }}>
            {[recipe.category, recipe.minutes ? `${recipe.minutes} דק׳` : null, recipe.servings ? `${recipe.servings} מנות` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={fav ? 'הסרה מהמועדפים' : 'הוספה למועדפים'} onPress={toggleFav}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? C.primary : C.textMuted} />
        </Pressable>
      </View>

      {nutrition.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {nutrition.map(([label, value, unit]) => (
            <View key={label} style={{ flex: 1, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{value}{unit}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>{label}</Text>
            </View>
          ))}
        </View>
      )}
      {nutrition.length > 0 && <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'right' }}>ערכים תזונתיים למנה</Text>}

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: '#E9E6E0', borderRadius: 12, padding: 4 }}>
        {([['ingredients', 'מצרכים'], ['steps', 'אופן הכנה']] as const).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)}
            style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === key ? C.card : 'transparent' }}>
            <Text style={{ fontSize: 15, fontWeight: tab === key ? '700' : '400', color: C.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'ingredients' && (
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {(recipe.recipe_ingredients ?? []).map((ing, i) => (
            <View key={ing.id ?? i} style={{ paddingVertical: 10, borderBottomWidth: i < (recipe.recipe_ingredients?.length ?? 0) - 1 ? 1 : 0, borderBottomColor: '#EEEBE6', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 15, color: C.text, flex: 1, textAlign: 'right' }}>{ing.text}</Text>
                {ing.substitutes.length > 0 && (
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: openSubs.has(i) }}
                    onPress={() => { const n = new Set(openSubs); if (n.has(i)) n.delete(i); else n.add(i); setOpenSubs(n); }}
                    style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#E6C7B5', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, color: C.primaryDark }}>⇄ חלופה</Text>
                  </Pressable>
                )}
              </View>
              {openSubs.has(i) && (
                <View style={{ backgroundColor: C.primarySoft, borderRadius: 10, padding: 10, gap: 4 }}>
                  {ing.substitutes.map((s) => <Text key={s} style={{ fontSize: 14, color: C.text, textAlign: 'right' }}>• {s}</Text>)}
                </View>
              )}
            </View>
          ))}
          {(recipe.recipe_ingredients ?? []).length === 0 && <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right', paddingVertical: 10 }}>לא הוזנו מצרכים.</Text>}
        </Card>
      )}
      {tab === 'steps' && (
        <Card>
          <Text style={{ fontSize: 15, color: C.text, textAlign: 'right', lineHeight: 24 }}>{recipe.instructions || 'לא הוזן אופן הכנה.'}</Text>
        </Card>
      )}
      <RecipeDisclaimer />
    </Screen>
  );
}
