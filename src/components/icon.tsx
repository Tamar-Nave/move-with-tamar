// Thin line icons of the design (1.5px strokes on a 24px grid).
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const SHAPES = {
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  calendar: <><Rect x={3} y={4} width={18} height={18} rx={3} /><Path d="M8 2v4M16 2v4M3 10h18" /></>,
  book: <Path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />,
  user: <><Circle cx={12} cy={8} r={5} /><Path d="M20 21a8 8 0 0 0-16 0" /></>,
  settings: <><Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  calendarCheck: <><Rect x={3} y={4} width={18} height={18} rx={3} /><Path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4" /></>,
  trophy: <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0z" />,
  flame: <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  star: <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" fill="currentColor" />,
  chevronRight: <Path d="m9 5 7 7-7 7" />,
  chevronLeft: <Path d="m15 5-7 7 7 7" />,
  search: <><Circle cx={11} cy={11} r={7} /><Path d="m21 21-4.3-4.3" /></>,
  heart: <Path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />,
  heartFilled: <Path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" fill="currentColor" />,
  users: <><Circle cx={9} cy={8} r={4} /><Path d="M2 21a7 7 0 0 1 14 0M16 4.5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3" /></>,
  plus: <><Circle cx={12} cy={12} r={9} /><Path d="M12 8v8M8 12h8" /></>,
  megaphone: <Path d="m3 11 16-6v14L3 13zM7 14v4a2 2 0 0 0 4 0v-2.5M22 10v4" />,
  food: <Path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M18 21V3c-2.5 1.5-4 4.5-4 8h4" />,
  palette: <><Path d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1.2 1.3-2.2-.8-1.2 0-2.8 1.7-2.8h2a4 4 0 0 0 4-4c0-5-4-9-9-9z" /><Circle cx={7.5} cy={11.5} r={1} /><Circle cx={10.5} cy={7.5} r={1} /><Circle cx={15} cy={7.5} r={1} /></>,
  file: <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />,
};

export type IconName = keyof typeof SHAPES;

export function Icon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" color={color} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden>
      {SHAPES[name]}
    </Svg>
  );
}
