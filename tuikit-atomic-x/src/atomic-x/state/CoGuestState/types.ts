/**
 * CoGuest State 类型定义
 */

/**
 * 连麦申请无响应原因枚举
 */
export enum GuestApplicationNoResponseReason {
  TIMEOUT = 0,
}

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
 * 申请连麦座位选项
 */
export interface ApplyForSeatOptions extends Record<string, unknown> {
  seatIndex?: number;
  timeout?: number;
  extraInfo?: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 取消申请选项
 */
export interface CancelApplicationOptions extends Record<string, unknown> {
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 接受申请选项
 */
export interface AcceptApplicationOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 拒绝申请选项
 */
export interface RejectApplicationOptions extends Record<string, unknown> {
  userID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 邀请上麦选项
 */
export interface InviteToSeatOptions extends Record<string, unknown> {
  inviteeID: string;
  seatIndex?: number;
  timeout?: number;
  extraInfo?: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 取消邀请选项
 */
export interface CancelInvitationOptions extends Record<string, unknown> {
  inviteeID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 接受邀请选项
 */
export interface AcceptInvitationOptions extends Record<string, unknown> {
  inviterID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 拒绝邀请选项
 */
export interface RejectInvitationOptions extends Record<string, unknown> {
  inviterID: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 断开连接选项
 */
export interface DisconnectOptions extends Record<string, unknown> {
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

export enum CuestErrorCode {
  NOT_SUPPORT = 100006,
}
