/**
 * LiveAudience State 类型定义
 */

/**
 * 直播用户信息参数
 */
export interface LiveUserInfoParam {
  userID: string;
  userName?: string;
  avatarURL?: string;
  level?: number;
  [key: string]: unknown;
}

/**
 * 获取观众列表选项
 */
export interface FetchAudienceListOptions extends Record<string, unknown> {
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 设置管理员选项
 */
export interface SetAdministratorOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 撤销管理员选项
 */
export interface RevokeAdministratorOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 踢出用户选项
 */
export interface KickUserOutOfRoomOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 禁用发送消息选项
 */
export interface DisableSendMessageOptions extends Record<string, unknown> {
  userID: string;
  isDisable: boolean;
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


