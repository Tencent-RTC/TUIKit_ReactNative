/**
 * Battle State 类型定义
 */

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
 * PK 信息参数
 */
export interface BattleInfoParam {
  battleID?: string;
  liveID?: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  [key: string]: unknown;
}

/**
 * PK 配置参数
 */
export interface BattleConfigParam {
  duration?: number;
  needResponse?: boolean;
  extensionInfo?: string;
  [key: string]: unknown;
}

/**
 * 请求 PK 选项
 */
export interface RequestBattleOptions extends Record<string, unknown> {
  liveID: string;
  userIDList: string[];
  timeout?: number;
  config?: BattleConfigParam;
  onSuccess?: (battleInfo?: BattleInfoParam, result?: unknown) => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 取消 PK 请求选项
 */
export interface CancelBattleRequestOptions extends Record<string, unknown> {
  liveID: string;
  battleID: string;
  userIDList: string[];
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 接受 PK 选项
 */
export interface AcceptBattleOptions extends Record<string, unknown> {
  liveID: string;
  battleID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 拒绝 PK 选项
 */
export interface RejectBattleOptions extends Record<string, unknown> {
  liveID: string;
  battleID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 退出 PK 选项
 */
export interface ExitBattleOptions extends Record<string, unknown> {
  liveID: string;
  battleID: string;
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

