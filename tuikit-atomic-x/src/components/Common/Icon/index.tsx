import {
  StyleSheet,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ICONS, type IconName } from './icons';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}

export function Icon({ name, size, color = '#FFFFFF', style }: IconProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const width = flat.width ?? size;
  const height = flat.height ?? size;
  return (
    <SvgXml
      xml={ICONS[name]}
      width={width as number}
      height={height as number}
      color={color}
      style={flat}
    />
  );
}
