import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { GoalCard, ProfileHeader, StatTiles } from '@/components/profile-parts';
import { useAuth } from '@/lib/auth';
import { shortDate } from '@/lib/dates';
import { fetchMyProgress, isExcellent, type GoalPlan, type Progress } from '@/lib/progress';

const PLAN_TITLE = { unlimited: 'מנוי ללא הגבלה', monthly_8: 'מנוי חודשי' } as const;

/** Top of the member's profile: who she is, her badge, her numbers and her monthly goal. */
export function ProfileSummary() {
  const { profile, session } = useAuth();
  const [data, setData] = useState<{ progress: Progress; plan: (GoalPlan & { ends_on: string }) | null } | null>(null);

  useFocusEffect(useCallback(() => {
    if (session) fetchMyProgress(session.user.id).then(setData);
  }, [session]));

  const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`;
  const plan = data?.plan ?? null;
  const progress = data?.progress;
  const subtitle = plan ? `${PLAN_TITLE[plan.plan]} • פעיל עד ${shortDate(plan.ends_on)}`
    : data ? (profile?.is_admin ? 'מנהלת הסטודיו' : 'אין מנוי פעיל') : ' ';

  return (
    <View style={{ gap: 14 }}>
      <ProfileHeader name={name} initials={initials} avatarUrl={profile?.avatar_url} subtitle={subtitle}
        excellent={progress ? isExcellent(progress, plan) : false} />
      {progress && (
        <>
          <StatTiles month={progress.month} total={progress.total} streakWeeks={progress.streakWeeks} />
          {plan && <GoalCard plan={plan} attended={progress.month} />}
        </>
      )}
    </View>
  );
}
