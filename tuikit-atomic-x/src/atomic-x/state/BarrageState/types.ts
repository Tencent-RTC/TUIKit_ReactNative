import type { LiveUserInfoParam } from '../LiveAudienceState/types';

/**
 * Barrage State 类型定义
 */

/**
 * 弹幕参数
 */
export interface BarrageParam {
  liveID: string;
  sender: LiveUserInfoParam;
  sequence: number;
  timestampInSecond: number;
  messageType: number | string;
  textContent?: string;
  extensionInfo?: Record<string, string>;
  businessID?: string;
  data?: string;
  [key: string]: unknown;
}

/**
 * 发送文本消息选项
 */
export interface SendTextMessageOptions extends Record<string, unknown> {
  liveID: string;
  text: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 发送自定义消息选项
 */
export interface SendCustomMessageOptions extends Record<string, unknown> {
  liveID: string;
  businessID: string;
  data: string;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

/**
 * 添加本地提示消息选项
 */
export interface AppendLocalTipOptions extends Record<string, unknown> {
  liveID: string;
  message: BarrageParam;
  onSuccess?: () => void;
  onError?: (error: Error | string) => void;
  [key: string]: unknown;
}

