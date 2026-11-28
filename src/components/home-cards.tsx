// The cards of the home screen. They only display what they are given.
import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Ring, RingCaption, RingCard } from '@/components/ring-card';
import { Badge, Btn, C, Card, Muted } from '@/components/ui';
import { classColor, classLabel, type ClassRow } from '@/lib/classes';
import { dayLong, shortDate, timeLabel, ymdOf } from '@/lib/dates';
import { PLAN_LABEL } from '@/lib/members';
import { GLASS, tintOf, webOnly } from '@/lib/theme';

export type HomePlan = { plan: keyof typeof PLAN_LABEL; ends_on: string };

/**
 * `used` = entries taken this month (every registration, future ones included).
 * `left` = what remains on an 8-entry card, or null for an unlimited plan.
 */
export function SubscriptionCard({ plan, used, left }: { plan: HomePlan | null; used: number; left: number | null }) {
  if (!plan) return <RingCard title="המנוי שלי"><Badge label="אין מנוי פעיל" tone="gray" /></RingCard>;
  const unlimited = plan.plan === 'unlimited';
  const total = used + Math.max(0, left ?? 0);
  return (
    <RingCard
      title="המנוי שלי"
      tile={unlimited ? (
        <>
          <RingCaption>נוצלו</RingCaption>
          <Ring fraction={1} value={used} halo label={`נוצלו ${used} אימונים החודש`} />
          <RingCaption>אימונים</RingCaption>
        </>
      ) : (
        <>
          <Ring fraction={total ? used / total : 0} value={used} label={`נוצלו ${used} כניסות מתוך ${total}`} />
          <RingCaption>כניסות שנוצלו</RingCaption>
        </>
      )}>
      <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right' }}>{PLAN_LABEL[plan.plan]}</Text>
      <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'right' }}>פעיל עד {shortDate(plan.ends_on)}</Text>
    </RingCard>
  );
}

export function NextClassCard({ next, onOpen, onSchedule }: { next: ClassRow | null; onOpen: () => void; onSchedule: () => void }) {
  const color = next ? classColor(next) : null;
  const day = next ? ymdOf(new Date(next.starts_at)) : '';
  return (
    <Card style={{ padding: 10, ...(color ? { borderRightWidth: 5, borderRightColor: color } : {}) }}>
      <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'right', paddingTop: 6, paddingHorizontal: 8 }}>האימון הבא שלך</Text>
      {next ? (
        <>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20,
            backgroundColor: tintOf(color ?? C.primary, 0.14),
            ...webOnly({ backgroundImage: `linear-gradient(150deg, ${tintOf(color ?? C.primary, 0.3)}, ${tintOf(color ?? C.primary, 0.1)})` }),
          }}>
            <View style={{ width: 58, height: 62, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', ...webOnly({ boxShadow: '0 4px 12px rgba(92,74,66,0.10)' }) }}>
              <Text style={{ fontSize: 12, color: C.textMuted }}>{dayLong(day)}</Text>
              <Text style={{ fontSize: 21, fontWeight: '600', color: '#5C4A42' }}>{Number(day.slice(8))}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: '600', color: C.text, textAlign: 'right' }}>{classLabel(next)}</Text>
              <Text style={{ fontSize: 15, color: C.textMuted, textAlign: 'right' }}>{timeLabel(next.starts_at)}</Text>
            </View>
          </View>
          <Btn label="לפרטי האימון" onPress={onOpen} />
        </>
      ) : (
        <View style={{ gap: 10, padding: 8 }}>
          <Muted>את לא רשומה לאימון קרוב.</Muted>
          <Btn label="לצפייה בלו״ז" onPress={onSchedule} />
        </View>
      )}
    </Card>
  );
}

export function MessageCard({ title, date, body, onAll }: { title: string; date: string; body: string; onAll: () => void }) {
  return (
    <Card style={{
      borderColor: 'rgba(166,78,55,0.32)', backgroundColor: '#FCF3EA',
      ...webOnly({ backgroundImage: 'linear-gradient(160deg, #FFF9F3 0%, #F9EBDD 100%)', boxShadow: '0 12px 28px rgba(166,78,55,0.14)' }),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[{ width: 36, height: 36, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, GLASS.primary]}>
          <Icon name="megaphone" color="#fff" size={19} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15.5, fontWeight: '600', color: C.text, textAlign: 'right' }}>{title}</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'right' }}>{date}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 14, color: C.text, textAlign: 'right', lineHeight: 22 }}>{body}</Text>
      <Btn label="לכל ההודעות" variant="secondary" onPress={onAll} />
    </Card>
  );
}
