import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BRAND } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

const C = BRAND.colors;
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <Image source={require('../../assets/brand/logo-cream.png')} style={styles.logo} resizeMode="contain" accessibilityLabel={BRAND.name} />

          <Text style={styles.title}>כניסה</Text>
          <Text style={styles.subtitle}>
            {mode === 'code' && codeSent
              ? `שלחנו קוד למייל ${cleanEmail}`
              : 'הכניסה לאפליקציה היא בהזמנה.'}
          </Text>

          <Text style={styles.label} nativeID="emailLabel">אימייל</Text>
          <TextInput
            accessibilityLabelledBy="emailLabel"
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor="#8A857E"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!(mode === 'code' && codeSent)}
            style={[styles.input, { textAlign: 'left', writingDirection: 'ltr' }]}
          />

          {mode === 'password' && (
            <>
              <Text style={styles.label} nativeID="pwLabel">סיסמה</Text>
              <TextInput
                accessibilityLabelledBy="pwLabel"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                style={[styles.input, { textAlign: 'left', writingDirection: 'ltr' }]}
              />
            </>
          )}

          {mode === 'code' && codeSent && (
            <>
              <Text style={styles.label} nativeID="codeLabel">קוד מהמייל</Text>
              <TextInput
                accessibilityLabelledBy="codeLabel"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={8}
                style={[styles.input, styles.codeInput]}
              />
            </>
          )}

          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={primaryAction}
            disabled={primaryDisabled}
            style={({ pressed }) => [styles.button, primaryDisabled && styles.buttonDisabled, pressed && { opacity: 0.85 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{primaryLabel}</Text>}
          </Pressable>

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  column: { width: '100%', maxWidth: 400 },
  logo: { width: '100%', height: 220, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, textAlign: 'right' },
  subtitle: { fontSize: 15, color: C.textMuted, marginTop: 4, marginBottom: 20, textAlign: 'right', lineHeight: 22 },
  label: { fontSize: 14, color: C.text, marginBottom: 6, marginTop: 12, textAlign: 'right' },
  input: {
    minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#CFCBC3', backgroundColor: C.card,
    paddingHorizontal: 14, fontSize: 16, color: C.text,
  },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  error: { color: '#9A2B12', fontSize: 14, marginTop: 12, textAlign: 'right' },
  button: {
    minHeight: 52, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  buttonDisabled: { backgroundColor: '#C9B2A6' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  link: { color: C.primaryDark, fontSize: 15, textDecorationLine: 'underline' },
});
