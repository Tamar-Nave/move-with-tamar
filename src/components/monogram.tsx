import Svg, { Circle, Polygon } from 'react-native-svg';

// The TN monogram from the Tamar Nave logo, as a transparent vector. Color it with `color`.
export function Monogram({ height = 32, color = '#A64E37' }: { height?: number; color?: string }) {
  return (
    <Svg width={(height * 540) / 790} height={height} viewBox="700 430 540 790" accessibilityElementsHidden>
      <Circle cx={907} cy={475} r={40} fill={color} />
      <Polygon points="710,567 1104,567 1082,595 732,595" fill={color} />
      <Polygon points="894,648 921,670 921,1108 1194,740 1194,955 1221,976 1221,648 894,1200" fill={color} />
    </Svg>
  );
}
