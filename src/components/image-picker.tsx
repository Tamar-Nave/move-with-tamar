import { createElement, useRef } from 'react';
import { Image, Platform, View } from 'react-native';

import { Btn, C, Muted } from '@/components/ui';

/** Pick a photo from the phone or computer (web). Shows the current image, if any. */
export function ImagePicker({ imageUrl, busy, onPick, onRemove }: {
  imageUrl: string | null; busy?: boolean; onPick: (file: File) => void; onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  if (Platform.OS !== 'web') return <Muted>העלאת תמונה זמינה באפליקציה בדפדפן.</Muted>;

  return (
    <View style={{ gap: 8 }}>
      {imageUrl && (
        // "contain" (not "cover") so a square photo — like a profile picture — never gets its top/bottom
        // cropped off to fill this wide, short box; the background shows through on the sides instead.
        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: C.background }}
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
      <Btn label={imageUrl ? 'החלפת תמונה' : 'הוספת תמונה'} variant="secondary" busy={busy} onPress={() => inputRef.current?.click()} />
      {imageUrl && <Btn label="הסרת התמונה" variant="secondary" onPress={onRemove} />}
    </View>
  );
}
