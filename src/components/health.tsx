// What a member sees about her health declaration: a row on the profile, and a reminder when she opens the app.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { isStandalone } from '@/components/install-prompt';
import { Btn, C, Card } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fetchMyHealthApproved, preloadHealthForm, saveHealthForm } from '@/lib/health';
import { SAGE, webOnly } from '@/lib/theme';

const STEPS = ['לוחצים "שמירת הטופס"', 'ממלאים את הפרטים וחותמים', 'שולחים לתמר'];

/** What a member who hasn't been approved yet needs to do. */
function HealthSteps() {
  return (
    <View style={s.steps}>
      {STEPS.map((step, i) => (
        <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={s.stepNumber}><Text style={s.stepNumberText}>{i + 1}</Text></View>
          <Text style={s.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

export function HealthRowView({ approved, onSave, note }: { approved: boolean; onSave: () => void; note?: string | null }) {
  return (
    <Card style={{ paddingVertical: 14, paddingHorizontal: 14, borderRadius: 24, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={s.rowIcon}>
          <Icon name="file" color={SAGE.main} size={20} />
          <View style={[s.dot, { backgroundColor: approved ? SAGE.main : '#B07A2A' }]}>
            <Text style={s.dotText}>{approved ? '✓' : '!'}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.text, textAlign: 'right' }}>הצהרת בריאות</Text>
          <Text style={{ fontSize: 12.5, color: approved ? SAGE.deep : C.warning, textAlign: 'right' }}>{approved ? 'מולאה ונחתמה' : 'עוד לא אושרה'}</Text>
        </View>
      </View>
      {!approved && <HealthSteps />}
      <Btn label="שמירת הטופס" variant="health" onPress={onSave} />
      {note ? <Text accessibilityRole="alert" style={s.how}>{note}</Text> : null}
    </Card>
  );
}

/**
 * The share sheet is used only in the app on an iPhone/iPad home screen, where downloads don't work.
 * Everywhere else a download is better; some Android browsers refuse to share a file at all.
 */
const useShareSheet = () =>
  isStandalone() && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

/** The save button's handler and the message it may leave behind. */
function useSaveForm() {
  const [note, setNote] = useState<string | null>(null);
  const save = () => { setNote(null); saveHealthForm(useShareSheet()).then(setNote); };
  return { note, save };
}

export function HealthRow() {
  const { session } = useAuth();
  const [approved, setApproved] = useState<boolean | null>(null);
  const { note, save } = useSaveForm();
  useFocusEffect(useCallback(() => {
    preloadHealthForm();
    if (session) fetchMyHealthApproved(session.user.id).then(setApproved);
  }, [session]));
  return approved === null ? null : <HealthRowView approved={approved} onSave={save} note={note} />;
}

export function HealthDialog({ onSave, onLater, note }: { onSave: () => void; onLater: () => void; note?: string | null }) {
  return (
    <View style={s.backdrop}>
      <View style={s.dialog} accessibilityViewIsModal>
        <View style={s.bigIcon}><Icon name="file" color={SAGE.main} size={30} /></View>
        <Text accessibilityRole="header" style={s.title}>הצהרת בריאות</Text>
        <Text style={s.body}>כדי להתאמן צריך למלא הצהרת בריאות:</Text>
        <HealthSteps />
        <Text style={s.small}>ההודעה תופיע בכניסה עד שתמר תאשר.</Text>
        <Btn label="שמירת הטופס" variant="health" onPress={onSave} />
        {note ? <Text accessibilityRole="alert" style={s.body}>{note}</Text> : null}
        <Btn label="אחר כך" variant="secondary" onPress={onLater} />
      </View>
    </View>
  );
}

/** Shown each time the app is opened until the approval exists. The studio owner never sees it. */
export function HealthPopup() {
  const { session, profile } = useAuth();
  const [needed, setNeeded] = useState(false);
  const { note, save } = useSaveForm();
  const userId = session?.user.id;
  const isMember = !!profile && !profile.is_admin;

  useEffect(() => {
    if (!userId || !isMember) return;
    fetchMyHealthApproved(userId).then((approved) => {
      setNeeded(approved === false);
      if (approved === false) preloadHealthForm();
    });
  }, [userId, isMember]);

  if (!needed) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => setNeeded(false)}>
      <HealthDialog onSave={save} onLater={() => setNeeded(false)} note={note} />
    </Modal>
  );
}

const s = StyleSheet.create({
  rowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: SAGE.soft, ...webOnly({ backgroundImage: `linear-gradient(150deg, ${SAGE.soft}, #FBFBF6)` }) },
  dot: { position: 'absolute', bottom: -3, left: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#fff', fontSize: 9, fontWeight: '600', lineHeight: 12 },
  how: { fontSize: 12.5, lineHeight: 19, color: C.textMuted, textAlign: 'right' },
  steps: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: 'rgba(223,232,214,0.5)' },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: SAGE.main },
  stepNumberText: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: C.text, textAlign: 'right' },
  small: { fontSize: 12.5, lineHeight: 19, color: C.textMuted, textAlign: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(60,62,44,0.32)', ...webOnly({ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }) },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 30, borderWidth: 1, borderColor: '#fff', padding: 22, gap: 12, backgroundColor: '#FBFCF7', ...webOnly({ backgroundImage: `linear-gradient(168deg, #FFFEFB 0%, ${SAGE.pale} 100%)`, boxShadow: '0 0 0 6px rgba(223,232,214,0.55), 0 24px 60px rgba(50,60,40,0.28)' }) },
  bigIcon: { alignSelf: 'center', width: 70, height: 70, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: SAGE.soft, ...webOnly({ backgroundImage: `linear-gradient(150deg, ${SAGE.soft}, #fff)`, boxShadow: '0 8px 18px rgba(95,125,87,0.22)' }) },
  title: { fontSize: 20, fontWeight: '600', color: SAGE.deep, textAlign: 'center' },
  body: { fontSize: 14.5, lineHeight: 24, color: C.textMuted, textAlign: 'center' },
});
