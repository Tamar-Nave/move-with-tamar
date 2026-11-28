import { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';

import { Field } from '@/components/field';
import { HealthRow } from '@/components/health';
import { ImagePicker } from '@/components/image-picker';
import { ProfileSummary } from '@/components/profile-summary';
import { InstallPrompt } from '@/components/install-prompt';
import { MfaSettings } from '@/components/mfa-settings';
import { NotificationSettings } from '@/components/notification-settings';
import { Btn, C, Card, ErrorText, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { uploadAvatar } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setPhone(profile?.phone ?? '');
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile]);

  // Saves on its own, right away — a photo that only lives in local state until someone also
  // remembers to press "שמירה" is exactly how a picked photo can look set but never actually show up
  // anywhere else in the app (like the class roster), because the profiles row was never updated.
  async function pickAvatar(file: File) {
    if (!session) return;
    setUploading(true);
    setMsg(null);
    try {
      const url = await uploadAvatar(file, session.user.id);
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
      if (error) throw error;
      setAvatarUrl(url);
      await refreshProfile();
      setMsg({ ok: true, text: 'התמונה נשמרה.' });
    } catch {
      setMsg({ ok: false, text: 'לא הצלחנו לשמור את התמונה. נסי תמונה אחרת.' });
    }
    setUploading(false);
  }

  async function removeAvatar() {
    setAvatarUrl(null);
    if (!session) return;
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', session.user.id);
    await refreshProfile();
  }

  const changed = phone.trim() !== (profile?.phone ?? '');

  async function save() {
    if (!session) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('profiles').update({ phone: phone.trim() || null }).eq('id', session.user.id);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: 'לא הצלחנו לשמור. נסי שוב.' }); return; }
    await refreshProfile();
    setMsg({ ok: true, text: 'הפרטים נשמרו.' });
  }

  return (
    <Screen>
      <ProfileSummary />
      <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right', writingDirection: 'ltr' }}>{profile?.email}</Text>

      {profile && !profile.is_admin && <HealthRow />}

      <Card style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'right' }}>הפרטים שלי</Text>
        <ImagePicker compact imageUrl={avatarUrl} busy={uploading} onPick={pickAvatar} onRemove={removeAvatar} />
        <Field label="טלפון" ltr value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="050-1234567" />
        {msg && (msg.ok ? <Text style={{ color: C.success, textAlign: 'right' }}>{msg.text}</Text> : <ErrorText>{msg.text}</ErrorText>)}
        <Btn label="שמירה" busy={busy} disabled={!changed} onPress={save} />
      </Card>

      <InstallPrompt />

      <NotificationSettings />

      {profile?.is_admin && <MfaSettings />}

      {Platform.OS === 'web' && (
        <>
          <Btn label="רענון האפליקציה" variant="secondary" onPress={() => window.location.reload()} />
          <Muted>טוען מחדש את האפליקציה עם כל העדכונים האחרונים.</Muted>
        </>
      )}
      <Btn label="התנתקות" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
