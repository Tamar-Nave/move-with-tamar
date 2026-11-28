// Visual tokens of the design (pastel on glass, terracotta accents). Colours shared with non-visual
// code live in brand.ts; everything about gradients, shadows and glass lives here.
import { Platform, type ViewStyle } from 'react-native';

import { BRAND } from '@/lib/brand';

/** Style properties only the web understands (gradients, shadows, blur). Native falls back to the flat colour. */
export const webOnly = (style: Record<string, string>): ViewStyle => (Platform.OS === 'web' ? (style as ViewStyle) : {});

const edge = 'rgba(255,255,255,0.95)';

export const GLASS = {
  edge,
  /** Soft wash with three gentle spots of colour behind every screen. */
  screen: {
    backgroundColor: BRAND.colors.background,
    ...webOnly({
      backgroundImage: [
        'radial-gradient(circle 250px at calc(50% + min(260px, 50%) - 55px) 55px, rgba(238,225,196,1) 0%, rgba(238,225,196,0.9) 35%, rgba(238,225,196,0) 100%)',
        'radial-gradient(circle 250px at calc(50% - min(260px, 50%) + 20px) calc(100% - 170px), rgba(230,217,196,0.95) 0%, rgba(230,217,196,0.8) 35%, rgba(230,217,196,0) 100%)',
        'radial-gradient(circle 210px at calc(50% - min(260px, 50%) + 45px) calc(40% + 105px), rgba(240,229,209,0.95) 0%, rgba(240,229,209,0.75) 35%, rgba(240,229,209,0) 100%)',
        'linear-gradient(168deg, #F8F4EA 0%, #FCFAF6 30%, #F9F6EF 68%, #F5F0E4 100%)',
      ].join(', '),
    }),
  } as ViewStyle,
  // No backdrop blur on cards on purpose: they sit on a smooth background, so it would cost speed and show nothing.
  card: {
    backgroundColor: Platform.OS === 'web' ? 'transparent' : '#FFFDFB',
    borderWidth: 1, borderColor: edge, borderRadius: 28,
    ...webOnly({
      backgroundImage: 'linear-gradient(160deg, rgba(255,253,251,0.74), rgba(255,253,251,0.48))',
      boxShadow: 'inset 0 1px 0 #fff, 0 12px 30px rgba(92,74,66,0.10)',
    }),
  } as ViewStyle,
  /** The main action: terracotta gradient. */
  primary: {
    backgroundColor: BRAND.colors.primary, borderColor: 'transparent',
    ...webOnly({
      backgroundImage: `linear-gradient(135deg, ${BRAND.colors.primary} 0%, #B2624A 60%, ${BRAND.colors.primaryLight} 100%)`,
      boxShadow: '0 10px 20px rgba(166,78,55,0.28)',
    }),
  } as ViewStyle,
  health: {
    backgroundColor: '#5F7D57', borderColor: 'transparent',
    ...webOnly({ backgroundImage: 'linear-gradient(135deg, #5F7D57 0%, #7E9C72 100%)', boxShadow: '0 10px 20px rgba(95,125,87,0.32)' }),
  } as ViewStyle,
  /** Secondary buttons, chips, round buttons. */
  soft: {
    backgroundColor: 'rgba(255,255,255,0.66)', borderColor: edge,
    ...webOnly({ boxShadow: 'inset 0 1px 0 #fff, 0 4px 12px rgba(92,74,66,0.08)' }),
  } as ViewStyle,
  input: {
    backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: edge, borderRadius: 16,
    ...webOnly({ boxShadow: 'inset 0 1px 3px rgba(92,74,66,0.12)' }),
  } as ViewStyle,
  /** Content scrolls underneath the tab bar, so this is the one place that blurs. */
  bar: {
    backgroundColor: 'rgba(255,253,251,0.82)', borderColor: edge,
    ...webOnly({
      backdropFilter: 'blur(22px) saturate(1.5)', WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
      boxShadow: 'inset 0 1px 0 #fff, 0 12px 28px rgba(92,74,66,0.14)',
    }),
  } as ViewStyle,
};

/** Height the floating tab bar covers at the bottom of a screen (bar + its gap). */
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_GAP = 14;

/** The green of everything about the health declaration. */
export const SAGE = { main: '#5F7D57', light: '#7E9C72', soft: '#DFE8D6', pale: '#EEF3E7', deep: '#42593C' } as const;

export const BADGE_TONES = {
  green: { bg: '#E6EEDF', fg: '#42593C' },
  orange: { bg: '#F6DFD2', fg: '#8E4526' },
  red: { bg: '#F5E7CF', fg: '#85561A' }, // "needs action": amber, so it never looks like the brand colour
  brand: { bg: '#F1E0CF', fg: BRAND.colors.primaryDark },
  gray: { bg: '#EBE5DA', fg: '#6E6058' },
} as const;

/** A see-through version of a #RRGGBB colour (class colours are stored that way). */
export function tintOf(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return Number.isFinite(n) && hex.length === 7 ? `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})` : `rgba(166, 78, 55, ${alpha})`;
}
