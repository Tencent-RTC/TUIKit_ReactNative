/**
 * CoHost State 类型定义
 */

/**
 * 跨房间连线状态枚举
 */
export enum CoHostStatus {
  /** 已连接其他主播 */
  CONNECTED = 0,
  /** 未连接其他主播 */
  DISCONNECTED = 1,
}

/**
 * 连线布局模板枚举
 */
export enum CoHostLayoutTemplate {
  /** 语聊房 6v6 布局 */
  HOST_STATIC_VOICE_6V6 = 1,
  /** 主播动态网格布局 */
  HOST_DYNAMIC_GRID = 600,
  /** 主播动态 1v6 布局 */
  HOST_DYNAMIC_1V6 = 601,
}

export enum ConnectionCode {
  UNKNOWN = -1,
  SUCCESS = 0,
  CONNECTING_OTHER_ROOM = 3,
}

/**
 * 直播用户信息参数
 */
export interface LiveUserInfoParam {
  userID: string;
  userName?: string;
  avatarURL?: string;
  liveID?: string;
  level?: number;
  [key: string]: unknown;
}

/**
 * 请求连线选项
 */
export interface RequestHostConnectionOptions extends Record<string, unknown> {
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 取消连线请求选项
 */
export interface CancelHostConnectionOptions extends Record<string, unknown> {
  toHostLiveID?: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 接受连线请求选项
 */
export interface AcceptHostConnectionOptions extends Record<string, unknown> {
  fromHostLiveID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 拒绝连线请求选项
 */
export interface RejectHostConnectionOptions extends Record<string, unknown> {
  fromHostLiveID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 退出连线选项
 */
export interface ExitHostConnectionOptions extends Record<string, unknown> {
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


