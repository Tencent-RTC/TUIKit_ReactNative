import { useCallback, useRef } from 'react';
import { Dimensions } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceStatus, DeviceStatusCode, i18n, type StateError } from '@tencentcloud/react-native-tuikit-atomic-x';

export const isEnglishUI = (): boolean => (i18n.language || '').toLowerCase().startsWith('en');

export const sdkLanguage = (): string => (isEnglishUI() ? 'en' : 'zh-Hans');

export const rpxToPx = (rpx: number): number => (rpx / 750) * Dimensions.get('window').width;

export const getTopBarOffsetPx = (safeAreaTop?: number): number => {
  const top = safeAreaTop ?? initialWindowMetrics?.insets.top;
  if (top == null) return rpxToPx(88);
  return top + rpxToPx(8);
};

export const useTopBarOffsetPx = (): number => getTopBarOffsetPx(useSafeAreaInsets().top);

export const normalizeAvatarURL = (url: unknown): string => {
  const s = (url == null ? '' : String(url)).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
};

export const errorCodeOf = (error: unknown): number => {
  const code = typeof error === 'object' && error !== null ? (error as StateError).code : undefined;
  return Number(code) || 0;
};

export const VideoQuality = {
  QUALITY_360P: 1,
  QUALITY_540P: 2,
  QUALITY_720P: 3,
  QUALITY_1080P: 4,
} as const;

const VIDEO_QUALITY_PARAM: Record<number, string> = {
  [VideoQuality.QUALITY_360P]: 'VIDEOQUALITY_360P',
  [VideoQuality.QUALITY_540P]: 'VIDEOQUALITY_540P',
  [VideoQuality.QUALITY_720P]: 'VIDEOQUALITY_720P',
  [VideoQuality.QUALITY_1080P]: 'VIDEOQUALITY_1080P',
};

export const toVideoQualityParam = (quality: number): string =>
  VIDEO_QUALITY_PARAM[quality] ?? VIDEO_QUALITY_PARAM[VideoQuality.QUALITY_720P]!;

// RN DeviceState types localVideoQuality as an object, but native sends the numeric enum.
export const toVideoQualityNumber = (value: unknown): number => Number(value) || 0;

export const NetworkQuality = {
  Unknown: 0,
  Excellent: 1,
  Good: 2,
  Poor: 3,
  Bad: 4,
  VeryBad: 5,
  Down: 6,
} as const;

export const DRAWER_BG = require('../static/assets/live/drawer-bg.png');

export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}

export const toMsTimestamp = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 1e12) return Math.floor(n);
  if (n > 1e9) return Math.floor(n * 1000);
  return 0;
};

export const isDeviceStatusOff = (status: unknown): boolean =>
  status === DeviceStatusCode.OFF || status === DeviceStatus.OFF;

export const isDeviceStatusOn = (status: unknown): boolean =>
  status === DeviceStatusCode.ON || status === DeviceStatus.ON;

export const parseMaybeJson = <T = Record<string, unknown>>(value: unknown): T | null => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return (value as T) ?? null;
};

export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

export const pusherSession = {
  paused: false,
  selfMuted: false,
  onPauseChanged: null as ((paused: boolean) => void) | null,
};

export const setPusherPaused = (paused: boolean): void => {
  pusherSession.paused = paused;
  pusherSession.onPauseChanged?.(paused);
};
