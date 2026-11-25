import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { Monogram } from '@/components/monogram';
import { Btn, C, Muted } from '@/components/ui';
import { BRAND } from '@/lib/brand';

type BeforeInstallPromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
const isIOS = () => Platform.OS === 'web' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Shown once, before the very first login, so a new member sets up the home-screen icon (needed for
 * push notifications) before anything else. `onContinue` moves on to the normal login screen.
 */
export function InstallIntroScreen({ onContinue }: { onContinue: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function installOnAndroid() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.colors.background, padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 400, gap: 16, alignItems: 'center' }}>
        <Monogram height={56} color={C.primary} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' }}>לפני שנכנסים</Text>
        <Text style={{ fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22 }}>
          כדאי להוסיף את {BRAND.name} למסך הבית — כך שיהיה קל לפתוח אותה, ושיגיעו התראות על אימונים והודעות.
        </Text>

        <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
          {deferredPrompt ? (
            <>
              <Muted style={{ textAlign: 'center' }}>לחיצה אחת, וזהו.</Muted>
              <Btn label="התקנת האפליקציה" onPress={installOnAndroid} />
            </>
          ) : isIOS() ? (
            <Muted style={{ textAlign: 'center' }}>
              לוחצים על כפתור השיתוף (ריבוע עם חץ כלפי מעלה) בסרגל התחתון של ספארי, ואז על &quot;הוספה למסך הבית&quot;.
            </Muted>
          ) : (
            <Muted style={{ textAlign: 'center' }}>
              בתפריט הדפדפן (שלוש הנקודות למעלה), בוחרים &quot;התקנת אפליקציה&quot; או &quot;הוספה למסך הבית&quot;.
            </Muted>
          )}
        </View>

        <Btn label="המשך לכניסה" variant="secondary" onPress={onContinue} />
      </View>
    </View>
  );
}
