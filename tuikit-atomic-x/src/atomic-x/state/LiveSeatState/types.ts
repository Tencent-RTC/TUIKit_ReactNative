/**
 * LiveSeat State 类型定义
 */

/**
 * 区域信息参数类型定义
 */
export interface RegionInfoParams {
  x: number;
  y: number;
  w: number;
  h: number;
  zorder: number;
}

/**
 * 直播画布参数类型定义
 */
export interface LiveCanvasParams {
  w: number;
  h: number;
  background?: string;
}

/**
 * 座位用户信息参数
 */
export interface SeatUserInfoParam {
  userID: string;
  userName?: string;
  avatarURL?: string;
  role?: number | string;
  liveID?: string;
  microphoneStatus?: number | string;
  allowOpenMicrophone?: boolean;
  cameraStatus?: number | string;
  allowOpenCamera?: boolean;
  [key: string]: unknown;
}

/**
 * 座位信息类型定义
 */
export interface SeatInfo {
  index: number;
  isLocked: boolean;
  userInfo: SeatUserInfoParam | null;
  region: RegionInfoParams;
}

/**
 * 上麦选项
 */
export interface TakeSeatOptions extends Record<string, unknown> {
  seatIndex: number;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 下麦选项
 */
export interface LeaveSeatOptions extends Record<string, unknown> {
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 静音麦克风选项
 */
export interface MuteMicrophoneOptions extends Record<string, unknown> {
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 取消静音麦克风选项
 */
export interface UnmuteMicrophoneOptions extends Record<string, unknown> {
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 踢出座位选项
 */
export interface KickUserOutOfSeatOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 移动用户到座位选项
 */
export interface MoveUserToSeatOptions extends Record<string, unknown> {
  userID: string;
  targetIndex: number;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 锁定座位选项
 */
export interface LockSeatOptions extends Record<string, unknown> {
  seatIndex: number;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 解锁座位选项
 */
export interface UnlockSeatOptions extends Record<string, unknown> {
  seatIndex: number;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 开启远程摄像头选项
 */
export interface OpenRemoteCameraOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 关闭远程摄像头选项
 */
export interface CloseRemoteCameraOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 开启远程麦克风选项
 */
export interface OpenRemoteMicrophoneOptions extends Record<string, unknown> {
  userID: string;
  policy: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 关闭远程麦克风选项
 */
export interface CloseRemoteMicrophoneOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 直播监听器接口
 */
export interface ILiveListener {
  callback: (params?: unknown) => void;
}


