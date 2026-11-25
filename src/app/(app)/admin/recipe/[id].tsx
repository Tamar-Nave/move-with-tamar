import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Field } from '@/components/field';
import { ImagePicker } from '@/components/image-picker';
import { BackLink, Btn, Card, Chip, C, ErrorText, Label, Loading, Muted, Screen, Title } from '@/components/ui';
import { RECIPE_CATEGORIES, uploadRecipeImage, type Recipe } from '@/lib/recipes';
import { supabase } from '@/lib/supabase';

type Row = { text: string; subs: string };
const num = (s: string) => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Math.round(Number(s)) : null);
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(RECIPE_CATEGORIES[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rows, setRows] = useState<Row[]>([{ text: '', subs: '' }]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    supabase.from('recipes').select('*, recipe_ingredients(*)').eq('id', id).single().then(({ data }) => {
      const r = data as Recipe | null;
      if (r) {
        setTitle(r.title); setCategory(r.category); setImageUrl(r.image_url);
        setMinutes(str(r.minutes)); setServings(str(r.servings)); setCalories(str(r.calories));
        setProtein(str(r.protein_g)); setCarbs(str(r.carbs_g)); setFat(str(r.fat_g)); setInstructions(r.instructions ?? '');
        const ings = [...(r.recipe_ingredients ?? [])].sort((a, b) => a.position - b.position);
        setRows(ings.length ? ings.map((i) => ({ text: i.text, subs: i.substitutes.join(', ') })) : [{ text: '', subs: '' }]);
      }
      setLoaded(true);
    });
  }, [id, isNew]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/recipes' as never));

  async function pickImage(file: File) {
    setUploading(true);
    setError(null);
    try { setImageUrl(await uploadRecipeImage(file)); } catch { setError('לא הצלחנו להעלות את התמונה. נסי תמונה אחרת.'); }
    setUploading(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const fields = {
      title: title.trim(), category, image_url: imageUrl, minutes: num(minutes), servings: num(servings),
      calories: num(calories), protein_g: num(protein), carbs_g: num(carbs), fat_g: num(fat), instructions: instructions.trim() || null,
    };
    let recipeId = id;
    if (isNew) {
      const { data, error: err } = await supabase.from('recipes').insert(fields).select('id').single();
      if (err || !data) { setBusy(false); setError('לא הצלחנו לשמור. נסי שוב.'); return; }
      recipeId = (data as { id: string }).id;
    } else {
      const { error: err } = await supabase.from('recipes').update(fields).eq('id', id);
      if (err) { setBusy(false); setError('לא הצלחנו לשמור. נסי שוב.'); return; }
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
    }
    const ingredients = rows.filter((r) => r.text.trim()).map((r, i) => ({
      recipe_id: recipeId, position: i + 1, text: r.text.trim(),
      substitutes: r.subs.split(',').map((s) => s.trim()).filter(Boolean),
    }));
    if (ingredients.length) {
      const { error: err } = await supabase.from('recipe_ingredients').insert(ingredients);
      if (err) { setBusy(false); setError('המתכון נשמר, אבל המצרכים לא נשמרו. נסי לשמור שוב.'); return; }
    }
    setBusy(false);
    back();
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    await supabase.from('recipes').delete().eq('id', id);
    setBusy(false);
    back();
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (!loaded) return <Screen><Loading /></Screen>;
  return (
    <Screen>
      <BackLink label="חזרה למתכונים" onPress={back} />
      <Title>{isNew ? 'מתכון חדש' : 'עריכת מתכון'}</Title>

      <Field label="שם המתכון" value={title} onChangeText={setTitle} />
      <Label>קטגוריה</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {RECIPE_CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>

      <Label>תמונה</Label>
      <ImagePicker imageUrl={imageUrl} busy={uploading} onPick={pickImage} onRemove={() => setImageUrl(null)} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="זמן הכנה (דקות)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="מספר מנות" value={servings} onChangeText={setServings} keyboardType="number-pad" /></View>
      </View>

      <Label>ערכים תזונתיים למנה (אופציונלי)</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="קלוריות" value={calories} onChangeText={setCalories} keyboardType="number-pad" /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="חלבון (ג׳)" value={protein} onChangeText={setProtein} keyboardType="number-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="פחמימות (ג׳)" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Field label="שומן (ג׳)" value={fat} onChangeText={setFat} keyboardType="number-pad" /></View>
      </View>

      <Label>מצרכים</Label>
      <Muted>לכל מצרך אפשר להוסיף חלופות, מופרדות בפסיק. למשל: "קמח כוסמין, קמח מלא".</Muted>
      {rows.map((r, i) => (
        <Card key={i} style={{ gap: 8 }}>
          <Field label={`מצרך ${i + 1}`} value={r.text} onChangeText={(t) => setRow(i, { text: t })} placeholder="למשל: כוס שיבולת שועל" />
          <Field label="חלופות (אופציונלי)" value={r.subs} onChangeText={(t) => setRow(i, { subs: t })} />
          {rows.length > 1 && (
            <Pressable accessibilityRole="button" onPress={() => setRows(rows.filter((_, j) => j !== i))} style={{ minHeight: 36, justifyContent: 'center' }}>
              <Text style={{ color: '#9A2B12', fontSize: 14, textAlign: 'right' }}>הסרת המצרך</Text>
            </Pressable>
          )}
        </Card>
      ))}
      <Btn label="+ הוספת מצרך" variant="secondary" onPress={() => setRows([...rows, { text: '', subs: '' }])} />

      <Field label="אופן הכנה" value={instructions} onChangeText={setInstructions} multiline
        placeholder={'1. ...\n2. ...'} style={{ minHeight: 140, paddingTop: 10, textAlignVertical: 'top' }} />

      {error && <ErrorText>{error}</ErrorText>}
      <Btn label={isNew ? 'שמירת המתכון' : 'שמירת השינויים'} busy={busy} disabled={!title.trim() || uploading} onPress={save} />
      {!isNew && <Btn label={confirmDelete ? 'בטוחה? לחצי שוב למחיקת המתכון' : 'מחיקת המתכון'} variant="danger" busy={busy} onPress={remove} />}
    </Screen>
  );
}
