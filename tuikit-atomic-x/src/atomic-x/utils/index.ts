/**
 * State 工具函数
 */

import { callAPI } from '../bridge/HybridBridge';
import type { HybridRequest, HybridResponse } from '../bridge/HybridBridge';
import type { BaseResponse, StateResult, StateOptions, StateError } from '../types';

export { startForegroundService, stopForegroundService } from './foregroundService';

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<StateOptions> = {
    timeout: 30000,
    retry: 0,
    retryDelay: 1000,
};

/**
 * 创建超时 Promise
 */
function createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
    });
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 调用 Native API 的通用方法
 * @param api API 名称
 * @param params 请求参数
 * @param options 配置选项
 * @returns Promise<StateResult<T>>
 */
export async function callNativeAPI<T = unknown>(
    api: string,
    params?: Record<string, unknown>,
    options?: StateOptions
): Promise<StateResult<T>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const request: HybridRequest = {
        api,
        params,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.retry; attempt++) {
        try {
            // 创建超时和 API 调用的竞态
            const response = await Promise.race([
                callAPI(request),
                createTimeoutPromise(opts.timeout),
            ]) as HybridResponse;

            // 解析响应
            const result: BaseResponse<T> = {
                code: response.code,
                message: response.message,
                data: response.data as T,
            };

            if (result.code === 0) {
                return {
                    success: true,
                    data: result.data,
                    code: result.code,
                };
            } else {
                return {
                    success: false,
                    error: result.message || 'Unknown error',
                    code: result.code,
                };
            }
        } catch (error: any) {
            lastError = error;

            // 如果不是最后一次尝试，等待后重试
            if (attempt < opts.retry) {
                await delay(opts.retryDelay);
                continue;
            }
        }
    }

    // 所有重试都失败
    return {
        success: false,
        error: lastError?.message || 'Request failed',
    };
}

/**
 * 验证必填参数
 */
export function validateRequired(
    params: Record<string, unknown>,
    required: string[]
): { valid: boolean; missing?: string[] } {
    const missing = required.filter((key) => {
        const value = params[key];
        return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
        return { valid: false, missing };
    }

    return { valid: true };
}

export function createStateError(result: StateResult<unknown>, fallback: string): StateError {
    const error: StateError = new Error(result.error || fallback);
    error.code = result.code;
    return error;
}
