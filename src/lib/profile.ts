import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';

/** Shrinks a photo to a small square-ish size, so profile pictures load instantly (web only). */
async function compressImage(file: File, max = 480): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress failed'))), 'image/jpeg', 0.85));
}

/** Every member's photo lives at "<their own id>.jpg" — storage policies only let her overwrite her own file. */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const blob = await compressImage(file);
  const path = `${userId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  // Cache-bust: the filename never changes, so without this the browser may keep showing the old photo.
  return `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
}
