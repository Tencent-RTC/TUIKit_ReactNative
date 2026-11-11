/**
 * State 模块通用类型定义
 */

/**
 * API 响应基础类型
 */
export interface BaseResponse<T = unknown> {
    code: number;
    message?: string;
    data?: T;
}

/**
 * State 操作结果
 */
export interface StateResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    code?: number;
}

/**
 * State 配置选项
 */
export interface StateOptions {
    timeout?: number;
    retry?: number;
    retryDelay?: number;
}

/**
 * API 请求参数基础接口
 */
export interface BaseRequestParams {
    [key: string]: unknown;
}


export interface StateError extends Error {
    code?: number;
}
