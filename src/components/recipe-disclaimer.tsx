import { Text } from 'react-native';

import { C } from '@/components/ui';

/** Shown on every recipe screen: recipes and nutrition values are a recommendation only. */
export function RecipeDisclaimer() {
  return (
    <Text accessibilityRole="text" style={{ fontSize: 12, lineHeight: 18, color: C.textMuted, textAlign: 'right', marginTop: 8 }}>
      המתכונים והערכים התזונתיים מוצגים כהמלצה בלבד. הערכים הם הערכה שחושבה לפי טבלאות תזונה כלליות,
      והם עשויים להשתנות לפי המוצרים, המותגים והכמויות בפועל. ייתכנו טעויות בחישוב. המידע אינו מהווה ייעוץ
      תזונתי או רפואי. במקרה של אלרגיה, רגישות, הריון או מצב רפואי כלשהו, יש להתייעץ עם איש מקצוע לפני השימוש.
    </Text>
  );
}
