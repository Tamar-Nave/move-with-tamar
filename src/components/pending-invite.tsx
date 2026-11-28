// An invitation that nobody has used yet. The admin can fix a typo (name or email) or cancel it.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Field } from '@/components/field';
import { LinkBtn } from '@/components/recipe-parts';
import { Badge, Btn, C, Card, ErrorText } from '@/components/ui';
import type { Invite } from '@/lib/members';
import { supabase } from '@/lib/supabase';

export function PendingInvite({ invite, onChanged }: { invite: Invite; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [first, setFirst] = useState(invite.first_name);
  const [last, setLast] = useState(invite.last_name ?? '');
  const [email, setEmail] = useState(invite.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const valid = first.trim().length > 0 && /^\S+@\S+\.\S+$/.test(cleanEmail);

  function open() {
    setFirst(invite.first_name); setLast(invite.last_name ?? ''); setEmail(invite.email);
    setError(null); setConfirming(false); setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    // only these three columns change, so the plan chosen in the invitation stays
    const { error: err } = await supabase.from('invites')
      .update({ email: cleanEmail, first_name: first.trim(), last_name: last.trim() || null })
      .eq('email', invite.email);
    setBusy(false);
    if (err) { setError(err.code === '23505' ? 'המייל הזה כבר הוזמן.' : 'לא הצלחנו לשמור. נסי שוב.'); return; }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('invites').delete().eq('email', invite.email);
    setBusy(false);
    if (err) { setError('לא הצלחנו לבטל את ההזמנה. נסי שוב.'); return; }
    onChanged();
  }

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, color: C.text, textAlign: 'right' }}>{invite.first_name} {invite.last_name ?? ''}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right', writingDirection: 'ltr' }}>{invite.email}</Text>
        </View>
        <Badge label="הוזמנה · עוד לא נכנסה" tone="gray" />
      </View>

      {editing ? (
        <>
          <Field label="שם פרטי" value={first} onChangeText={setFirst} />
          <Field label="שם משפחה (אופציונלי)" value={last} onChangeText={setLast} />
          <Field label="אימייל" ltr value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Btn label="שמירת ההזמנה" busy={busy} disabled={!valid} onPress={save} />
          <Btn label="סגירה" variant="secondary" onPress={() => setEditing(false)} />
        </>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <LinkBtn label="עריכה" onPress={open} />
          <LinkBtn label={confirming ? 'בטוחה? לחצי שוב לביטול' : 'ביטול ההזמנה'} danger disabled={busy} onPress={remove} />
        </View>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}
