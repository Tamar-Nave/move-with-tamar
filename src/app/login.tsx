import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/field';
import { Monogram } from '@/components/monogram';
import { Btn, C, Card, ErrorText, Muted, Title } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { supabase } from '@/lib/supabase';
import { GLASS } from '@/lib/theme';

type Mode = 'code' | 'password';

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('database error') || m.includes('not_invited') || m.includes('signups not allowed'))
    return 'המייל הזה לא ברשימת המוזמנות. כדאי לפנות לתמר.';
  if (m.includes('invalid login')) return 'המייל או הסיסמה לא נכונים.';
  if (m.includes('rate limit') || m.includes('security purposes'))
    return 'נשלחו יותר מדי בקשות. נסי שוב בעוד כמה דקות.';
  if (m.includes('token') && (m.includes('expired') || m.includes('invalid')))
    return 'הקוד לא נכון או שפג תוקפו. אפשר לבקש קוד חדש.';
  return 'משהו השתבש. נסי שוב.';
}

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('code');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const emailValid = /^\S+@\S+\.\S+$/.test(cleanEmail);

  async function run(action: () => Promise<{ error: { message: string } | null }>, onOk?: () => void) {
    setBusy(true);
    setError(null);
    const { error: err } = await action();
    setBusy(false);
    if (err) setError(friendlyError(err.message));
    else onOk?.();
  }

  const sendCode = () =>
    run(
      () => supabase.auth.signInWithOtp({ email: cleanEmail, options: { shouldCreateUser: true } }),
      () => setCodeSent(true),
    );
  const verifyCode = () =>
    run(() => supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'email' }));
  const signInWithPassword = () => run(() => supabase.auth.signInWithPassword({ email: cleanEmail, password }));

  const primaryAction =
    mode === 'password' ? signInWithPassword : codeSent ? verifyCode : sendCode;
  const primaryLabel =
    mode === 'password' ? 'כניסה' : codeSent ? 'אישור קוד' : 'שלחי לי קוד';
  const primaryDisabled =
    busy || !emailValid || (mode === 'password' && password.length < 6) || (codeSent && mode === 'code' && code.trim().length < 6);

  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, GLASS.screen]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.brand} accessible accessibilityLabel={BRAND.name}>
            <Monogram height={104} color={C.primary} />
            <Text style={styles.brandName}>{BRAND.name.toUpperCase()}</Text>
          </View>

          <Card>
            <Title>כניסה</Title>
            <Muted>
              {mode === 'code' && codeSent
                ? `שלחנו קוד למייל ${cleanEmail}`
                : 'הכניסה לאפליקציה היא בהזמנה.'}
            </Muted>

            <Field
              label="אימייל" ltr
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!(mode === 'code' && codeSent)}
            />

            {mode === 'password' && (
              <Field label="סיסמה" ltr value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
            )}

            {mode === 'code' && codeSent && (
              <Field
                label="קוד מהמייל" ltr
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={8}
                style={styles.codeInput}
              />
            )}

            {error && <ErrorText>{error}</ErrorText>}

            <Btn label={primaryLabel} busy={busy} disabled={primaryDisabled} onPress={primaryAction} />

            {mode === 'code' && codeSent && (
              <Pressable accessibilityRole="button" onPress={() => { setCodeSent(false); setCode(''); setError(null); }} style={styles.linkButton}>
                <Text style={styles.link}>שליחת קוד חדש או החלפת מייל</Text>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => { setMode(mode === 'code' ? 'password' : 'code'); setError(null); setCodeSent(false); }}
              style={styles.linkButton}>
              <Text style={styles.link}>{mode === 'code' ? 'כניסה עם סיסמה' : 'כניסה עם קוד במייל'}</Text>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  column: { width: '100%', maxWidth: 400, gap: 22 },
  brand: { alignItems: 'center', gap: 16 },
  brandName: { fontSize: 19, letterSpacing: 5, color: C.primary, writingDirection: 'ltr', textAlign: 'center' },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: C.primary, fontSize: 15 },
});
