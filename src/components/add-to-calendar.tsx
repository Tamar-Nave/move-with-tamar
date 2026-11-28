// "Add this class to my calendar". She picks a calendar once; the choice stays on this device.
import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';

import { LinkBtn } from '@/components/recipe-parts';
import { Btn, C, Card, Muted } from '@/components/ui';
import { downloadCalendarFile, googleCalendarUrl, isIosDevice, openAppleCalendar } from '@/lib/calendar';
import type { ClassRow } from '@/lib/classes';

type Choice = 'apple' | 'google' | 'file';
const KEY = 'calendar-choice';
const NAMES: Record<Choice, string> = { apple: 'היומן של אייפון', google: 'יומן Google', file: 'יומן סמסונג או אחר' };

/** The calendars that make sense on this device. */
const choices = (): Choice[] => (isIosDevice() ? ['apple', 'google'] : ['google', 'file']);

function readChoice(): Choice | null {
  try {
    const saved = localStorage.getItem(KEY) as Choice | null;
    return saved && choices().includes(saved) ? saved : null;
  } catch { return null; } // private browsing, etc.
}

export function AddToCalendar({ cls }: { cls: ClassRow }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [changing, setChanging] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => { setChoice(readChoice()); }, []);

  function add(which: Choice) {
    if (which === 'apple') openAppleCalendar(cls);
    else if (which === 'google') Linking.openURL(googleCalendarUrl(cls));
    else downloadCalendarFile(cls);
    setDownloaded(which === 'file');
  }

  function pick(which: Choice) {
    try { localStorage.setItem(KEY, which); } catch { /* the choice just won't be remembered */ }
    setChoice(which);
    setChanging(false);
    add(which);
  }

  const picking = !choice || changing;
  return (
    <Card>
      <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, textAlign: 'right' }}>להוסיף את האימון ליומן?</Text>
      {picking ? (
        <>
          <Muted>בוחרים יומן פעם אחת:</Muted>
          {choices().map((which) => <Btn key={which} label={NAMES[which]} variant="secondary" onPress={() => pick(which)} />)}
        </>
      ) : (
        <>
          <Btn label="הוספה ליומן" variant="secondary" onPress={() => add(choice)} />
          <LinkBtn label={`החלפת יומן (עכשיו: ${NAMES[choice]})`} onPress={() => setChanging(true)} />
        </>
      )}
      {downloaded && <Muted>אם הטלפון שואל, לוחצים "הורדה" ואז "פתיחה", ובוחרים את היומן.</Muted>}
      <Muted>האימון נכנס ליומן כאירוע רגיל. אם תבטלי הרשמה או שהאימון ישתנה, צריך למחוק או לעדכן אותו ביומן בעצמך.</Muted>
    </Card>
  );
}
