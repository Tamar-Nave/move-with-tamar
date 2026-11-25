import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { I18nManager, Platform } from 'react-native';

import { InstallIntroScreen } from '@/components/install-intro-screen';
import { isStandalone } from '@/components/install-prompt';
import { SplashLogo } from '@/components/splash-logo';
import { AuthProvider, useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { setupWebDocument } from '@/lib/web-setup';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
setupWebDocument();

// The session check usually finishes in well under a second — too fast to actually see the splash
// animation play. Keeping it up for at least this long lets it be felt rather than just flicker by.
const MIN_SPLASH_MS = 2200;
const INTRO_SEEN_KEY = 'install-intro-seen';

function Routes() {
  const { session, loading, mfaPending } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [introChecked, setIntroChecked] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // A brand-new visitor (not yet signed in) sees the "add to home screen" step before login, once
  // ever per device — not for an already-installed app, and not again once they've continued past it.
  useEffect(() => {
    if (Platform.OS !== 'web') { setIntroChecked(true); return; }
    let seen = true;
    try { seen = localStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch { seen = true; }
    setShowIntro(!seen && !isStandalone());
    setIntroChecked(true);
  }, []);

  if (loading || !minTimeElapsed || !introChecked) return <SplashLogo />;

  if (!session && showIntro) {
    return (
      <InstallIntroScreen
        onContinue={() => {
          try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* private browsing, etc. */ }
          setShowIntro(false);
        }}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BRAND.colors.background } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && mfaPending}>
        <Stack.Screen name="mfa-challenge" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !mfaPending}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
