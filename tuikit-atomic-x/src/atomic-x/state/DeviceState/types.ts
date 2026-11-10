/**
 * Device State 类型定义
 */

/**
 * 设备状态码
 */
export const DeviceStatusCode = {
  OFF: 0,
  ON: 1,
} as const;

export type DeviceStatusCodeType =
  (typeof DeviceStatusCode)[keyof typeof DeviceStatusCode];

/**
 * 设备状态
 */
export const DeviceStatus = {
  OFF: "OFF",
  ON: "ON",
} as const;

export type DeviceStatusType = (typeof DeviceStatus)[keyof typeof DeviceStatus];

/**
 * 设备错误码
 */
export const DeviceErrorCode = {
  NO_ERROR: 0,
  NO_DEVICE_DETECTED: 1,
  NO_SYSTEM_PERMISSION: 2,
  NOT_SUPPORT_CAPTURE: 3,
  OCCUPIED_ERROR: 4,
  UNKNOWN_ERROR: 5,
} as const;

export type DeviceErrorCodeType =
  (typeof DeviceErrorCode)[keyof typeof DeviceErrorCode];

/**
 * 设备错误枚举
 */
export const DeviceErrorEnum = {
  NO_ERROR: "NO_ERROR",
  NO_DEVICE_DETECTED: "NO_DEVICE_DETECTED",
  NO_SYSTEM_PERMISSION: "NO_SYSTEM_PERMISSION",
  NOT_SUPPORT_CAPTURE: "NOT_SUPPORT_CAPTURE",
  OCCUPIED_ERROR: "OCCUPIED_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type DeviceErrorType = (typeof DeviceErrorEnum)[keyof typeof DeviceErrorEnum];

/**
 * 音频输出路由
 */
export const AudioOutput = {
  SPEAKERPHONE: "SPEAKERPHONE",
  EARPIECE: "EARPIECE",
} as const;

export type AudioOutputType = (typeof AudioOutput)[keyof typeof AudioOutput];

/**
 * 镜像类型枚举
 */
export enum MirrorType {
  /** 自动模式 */
  AUTO = 0,
  /** 前后摄像头都镜像 */
  ENABLE = 1,
  /** 前后摄像头都不镜像 */
  DISABLE = 2,
}

/**
 * 打开本地麦克风选项
 */
export interface OpenLocalMicrophoneOptions extends Record<string, unknown> {
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 设置音频路由选项
 */
export interface SetAudioRouteOptions extends Record<string, unknown> {
  audioRoute: AudioOutputType;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 打开本地摄像头选项
 */
export interface OpenLocalCameraOptions extends Record<string, unknown> {
  isFront?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

export interface StartCameraTestOptions extends Record<string, unknown> {
  cameraView: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 切换摄像头选项
 */
export interface SwitchCameraOptions extends Record<string, unknown> {
  isFront: boolean;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 更新视频质量选项
 */
export interface UpdateVideoQualityOptions extends Record<string, unknown> {
  quality: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 切换镜像选项
 */
export interface SwitchMirrorOptions extends Record<string, unknown> {
  mirrorType: MirrorType;
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

/**
 * 网络信息类型
 */
export interface NetworkInfo extends Record<string, unknown> {
  [key: string]: unknown;
}

/**
 * 本地视频质量类型
 */
export interface LocalVideoQuality extends Record<string, unknown> {
  [key: string]: unknown;
}

