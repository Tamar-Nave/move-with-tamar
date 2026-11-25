import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';

import { Btn, C, ErrorText, Muted, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { challengeAndVerify, getTotpFactor } from '@/lib/mfa';

/** Shown after a password/code sign-in, only for an account that has TOTP turned on — one more
 * code before the session is trusted. Routed to from the root layout, between login and (app). */
export default function MfaChallengeScreen() {
  const { refreshMfaStatus, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const factor = await getTotpFactor();
      if (!factor) throw new Error('no_factor');
      await challengeAndVerify(factor.id, code);
      await refreshMfaStatus();
    } catch {
      setError('הקוד לא נכון או שפג תוקפו. נסי את הקוד הנוכחי באפליקציית האימות.');
    }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 400, gap: 14 }}>
          <Title>אימות דו-שלבי</Title>
          <Muted>הזיני את הקוד בן 6 הספרות מאפליקציית האימות שלך.</Muted>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            style={{
              minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
              textAlign: 'center', fontSize: 26, letterSpacing: 10, color: C.text,
            }}
          />
          {error && <ErrorText>{error}</ErrorText>}
          <Btn label="אישור" busy={busy} disabled={code.trim().length < 6} onPress={verify} />
          <Btn label="התנתקות" variant="secondary" onPress={signOut} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
