import { Dimensions } from 'react-native';

export interface ScreenSizeInfo {
  widthPx: number;
  heightPx: number;
  widthRpx: number;
  heightRpx: number;
}

export function getScreenSize(): ScreenSizeInfo {
  const { width, height } = Dimensions.get('window');
  const widthPx = width || 375;
  const heightPx = height || 812;
  return {
    widthPx,
    heightPx,
    widthRpx: 750,
    heightRpx: Math.round((heightPx * 750) / widthPx),
  };
}

export function heightPercentToRpx(percent: number): number {
  return Math.round(getScreenSize().heightRpx * percent);
}
