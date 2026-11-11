import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

export const rpxToPx = (rpx: number): number => (rpx * SCREEN_WIDTH) / 750;

export const pxToRpx = (px: number): number => (px * 750) / SCREEN_WIDTH;
