/**
 * AudioEffect State 类型定义
 */

/**
 * 变声器类型
 */
export const AudioChangerType = {
  NONE: 0,
  CHILD: 1,
  LITTLE_GIRL: 2,
  MAN: 3,
  HEAVY_METAL: 4,
  COLD: 5,
  FOREIGNER: 6,
  TRAPPED_BEAST: 7,
  FATSO: 8,
  STRONG_CURRENT: 9,
  HEAVY_MACHINERY: 10,
  ETHEREAL: 11,
} as const;

export type AudioChangerTypeParam = keyof typeof AudioChangerType;

/**
 * 混响类型
 */
export const AudioReverbType = {
  NONE: 0,
  KTV: 1,
  SMALL_ROOM: 2,
  AUDITORIUM: 3,
  DEEP: 4,
  LOUD: 5,
  METALLIC: 6,
  MAGNETIC: 7,
} as const;

export type AudioReverbTypeParam = keyof typeof AudioReverbType;

/**
 * 设置变声效果选项
 */
export interface SetAudioChangerTypeOptions extends Record<string, unknown> {
  changerType: AudioChangerTypeParam;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 设置混响效果选项
 */
export interface SetAudioReverbTypeOptions extends Record<string, unknown> {
  reverbType: AudioReverbTypeParam;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 设置耳返开关选项
 */
export interface SetVoiceEarMonitorEnableOptions extends Record<string, unknown> {
  enable: boolean;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 音量选项
 */
export interface VolumeOptions extends Record<string, unknown> {
  volume: number;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

