/**
 * Login State 类型定义
 */

/**
 * 用户信息参数
 * @interface UserProfileParam
 * @description 用户基本信息结构，包含用户ID、昵称和头像等信息
 * @param {string} userID - 用户唯一标识（必填）
 * @param {string} nickname - 用户昵称（可选）
 * @param {string} avatarURL - 用户头像URL（可选）
 */
export interface UserProfileParam {
    userID: string;
    nickname?: string;
    avatarURL?: string;
    level?: number;
    [key: string]: unknown;
}

/**
 * 登录选项
 * @interface LoginOptions
 * @description 登录接口的参数配置
 * @param {number} sdkAppID - 腾讯云应用ID（必填）
 * @param {string} userID - 用户ID（必填）
 * @param {string} userSig - 用户签名（必填）
 * @param {Function} onSuccess - 登录成功回调（可选）
 * @param {Function} onError - 登录失败回调（可选）
 */
export interface LoginOptions extends Record<string, unknown> {
    sdkAppID: number;
    userID: string;
    userSig: string;
    onSuccess?: () => void;
    onError?: (error: Error | string) => void;
}

/**
 * 登出选项
 * @interface LogoutOptions
 * @description 登出接口的参数配置
 * @param {Function} onSuccess - 登出成功回调（可选）
 * @param {Function} onError - 登出失败回调（可选）
 */
export interface LogoutOptions extends Record<string, unknown> {
    onSuccess?: () => void;
    onError?: (error: Error | string) => void;
}

/**
 * 设置用户信息选项
 * @interface SetSelfInfoOptions
 * @description 设置当前用户信息的参数配置
 * @param {Object} userProfile - 用户信息对象（必填）
 * @param {Function} onSuccess - 设置成功回调（可选）
 * @param {Function} onError - 设置失败回调（可选）
 */
export interface SetSelfInfoOptions extends Record<string, unknown> {
    userProfile: {
        userID: string;
        nickname?: string;
        avatarURL?: string;
        [key: string]: unknown;
    };
    onSuccess?: () => void;
    onError?: (error: Error | string) => void;
    [key: string]: unknown;
}

/**
 * 登录状态类型
 * @remarks
 * 可用值：
 * - `LOGINED`: 已登录
 * - `LOGOUT`: 已登出
 * - `UNLOGIN`: 未登录
 */
export type LoginStatus = 'LOGINED' | 'LOGOUT' | 'UNLOGIN';
