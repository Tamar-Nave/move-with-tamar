import { supabase } from '@/lib/supabase';

export type Ingredient = { id?: string; position: number; text: string; substitutes: string[] };
export type Recipe = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  minutes: number | null;
  servings: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  instructions: string | null;
  recipe_ingredients?: Ingredient[];
};

export const RECIPE_CATEGORIES = ['ארוחת בוקר', 'צהריים', 'ערב', 'נשנושים', 'אחרי אימון', 'קינוחים'];

const BUCKET = 'recipe-images';

/** Shrinks a photo to at most 1200px and JPEG, so recipes load fast on phones (web only). */
async function compressImage(file: File, max = 1200): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress failed'))), 'image/jpeg', 0.82));
}

export async function uploadRecipeImage(file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
