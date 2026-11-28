import { createElement, useRef } from 'react';
import { Image, Platform, View } from 'react-native';

import { Btn, C, Muted } from '@/components/ui';

/** Pick a photo from the phone or computer (web). Shows the current image, if any; `compact` shows just the buttons (the photo is already visible elsewhere). */
export function ImagePicker({ imageUrl, busy, onPick, onRemove, compact }: {
  imageUrl: string | null; busy?: boolean; onPick: (file: File) => void; onRemove: () => void; compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  if (Platform.OS !== 'web') return <Muted>העלאת תמונה זמינה באפליקציה בדפדפן.</Muted>;

  return (
    <View style={{ gap: 8 }}>
      {imageUrl && !compact && (
        // "contain" (not "cover") so a square photo — like a profile picture — never gets its top/bottom
        // cropped off to fill this wide, short box; the background shows through on the sides instead.
        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 180, borderRadius: 18, backgroundColor: C.background }}
          resizeMode="contain" accessibilityLabel="התמונה שנבחרה" />
      )}
      {createElement('input', {
        ref: inputRef, type: 'file', accept: 'image/*', style: { display: 'none' },
        onChange: (e: { target: HTMLInputElement }) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        },
      })}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Btn label={imageUrl ? 'החלפת תמונה' : 'הוספת תמונה'} variant="secondary" busy={busy} onPress={() => inputRef.current?.click()} /></View>
        {imageUrl && <View style={{ flex: 1 }}><Btn label="מחיקת התמונה" variant="secondary" onPress={onRemove} /></View>}
      </View>
    </View>
  );
}
