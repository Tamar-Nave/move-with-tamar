import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Monogram } from '@/components/monogram';
import { BRAND } from '@/lib/brand';
import { GLASS } from '@/lib/theme';

/** Shown while the app checks the session, between opening it and the home screen appearing. */
export function SplashLogo() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [opacity, scale]);

  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, GLASS.screen]}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Monogram height={136} color={BRAND.colors.primary} />
      </Animated.View>
    </View>
  );
}
