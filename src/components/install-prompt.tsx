import { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';

import { Btn, C, Card, Muted } from '@/components/ui';

// Chrome/Android fires this before showing its own install UI; capturing it lets us show our
// own button and trigger the real native install prompt with deferredPrompt.prompt().
type BeforeInstallPromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

export function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
const isIOS = () => Platform.OS === 'web' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const DISMISS_KEY = 'install-prompt-dismissed';
const DONE_KEY = 'install-prompt-done';
const remember = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* private browsing, etc. */ } };

/**
 * "Add to home screen" helper. Android/Chrome gets a real one-tap install button; iPhone (which has
 * no such API) gets the manual steps. `dismissible` shows a close button that remembers the choice
 * (use that on the home screen); leave it off for a persistent copy, e.g. in the profile screen.
 */
export function InstallPrompt({ dismissible }: { dismissible?: boolean }) {
  const [dismissed, setDismissed] = useState(!!dismissible);
  const [standalone, setStandalone] = useState(true);
  const [done, setDone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // opened from the home-screen icon: it is installed, so a browser tab on the same device needn't ask again
    if (isStandalone()) remember(DONE_KEY);
    setStandalone(isStandalone());
    try {
      setDone(localStorage.getItem(DONE_KEY) === '1');
      if (dismissible) setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch { setDismissed(false); }
    const installed = () => { remember(DONE_KEY); setDone(true); };
    window.addEventListener('appinstalled', installed);
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, [dismissible]);

  if (Platform.OS !== 'web' || standalone || dismissed || done) return null;

  function dismiss() {
    setDismissed(true);
    if (dismissible) remember(DISMISS_KEY);
  }

  async function installOnAndroid() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  return (
    <Card style={{ gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'right' }}>הוספת האפליקציה למסך הבית</Text>
      {deferredPrompt ? (
        <>
          <Muted>כדי לקבל התראות ולהשתמש באפליקציה כמו באפליקציות רגילות, כדאי להתקין אותה.</Muted>
          <Btn label="התקנת האפליקציה" onPress={installOnAndroid} />
        </>
      ) : isIOS() ? (
        <Muted>לוחצים על כפתור השיתוף (ריבוע עם חץ כלפי מעלה) בסרגל התחתון של ספארי, ואז על "הוספה למסך הבית".</Muted>
      ) : (
        <Muted>בתפריט הדפדפן (שלוש הנקודות למעלה), בוחרים "התקנת אפליקציה" או "הוספה למסך הבית".</Muted>
      )}
      <Btn label="כבר הוספתי" variant="secondary" onPress={() => { remember(DONE_KEY); setDone(true); }} />
      {dismissible && <Btn label="לא עכשיו" variant="secondary" onPress={dismiss} />}
    </Card>
  );
}
