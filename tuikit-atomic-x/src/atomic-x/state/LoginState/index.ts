/**
 * @module LoginState
 * @module_description
 * User Authentication and Login Management Module
 * Core Features: Responsible for user identity verification, login state management, user information maintenance, and other basic authentication services.
 * Technical Features: Supports multiple authentication methods, session management, permission verification, and other advanced features to ensure user identity security and validity.
 * Business Value: Provides basic user authentication capabilities for live streaming platforms, serving as a prerequisite for all other business modules.
 * Use Cases: User login, identity verification, session management, permission control, and other basic authentication scenarios.
 */

import { useState, useEffect, useCallback } from 'react';
import { callNativeAPI, createStateError } from '../../utils';
import { addListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  UserProfileParam,
  LoginOptions,
  LogoutOptions,
  SetSelfInfoOptions,
  LoginStatus,
} from './types';
import { validateRequired } from '../../utils';
import { loginStore } from './store';

/**
 * Login state event name constants
 */
const LOGIN_EVENTS = [
  'loginUserInfo',
  'loginStatus',
];

/**
 * Safely parse JSON
 */
function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    if (!json || typeof json !== 'string') {
      return defaultValue;
    }
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('safeJsonParse error:', error);
    return defaultValue;
  }
}

/**
 * Handle login state change events (module-level, shared by all hook instances)
 */
function handleNativeEvent(eventName: string) {
  return (event: Record<string, unknown>) => {
    try {
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.keys(data).forEach((key) => {
          if (LOGIN_EVENTS.includes(key)) {
            const value = data[key];

            if (key === 'loginUserInfo') {
              let parsedData: UserProfileParam;
              if (value && typeof value === 'object' && !Array.isArray(value)) {
                parsedData = value as UserProfileParam;
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<UserProfileParam>(value, {} as UserProfileParam);
              } else {
                parsedData = safeJsonParse<UserProfileParam>(JSON.stringify(value), {} as UserProfileParam);
              }
              if (parsedData?.userID) {
                loginStore.setState({
                  loginUserInfo: parsedData,
                  loginStatus: 'LOGINED',
                });
              }
            } else if (key === 'loginStatus') {
              let parsedData: LoginStatus;
              if (typeof value === 'string') {
                parsedData = value as LoginStatus;
              } else {
                parsedData = safeJsonParse<LoginStatus>(JSON.stringify(value), 'UNLOGIN');
              }
              loginStore.setState({
                loginStatus: parsedData,
              });
            }
          }
        });
      }
    } catch (error) {
      console.error(`[LoginState] ${eventName} event parse error:`, error);
    }
  };
}

/**
 * Register Native event listeners at module load time (once, never removed)
 */
LOGIN_EVENTS.forEach((eventName) => {
  const keyObject: HybridListenerKey = {
    type: 'state',
    store: 'LoginStore',
    name: eventName,
    roomID: null,
    listenerID: null,
  };
  const key = JSON.stringify(keyObject);
  addListener(key, handleNativeEvent(eventName));
});

/**
 * LoginState Hook
 * 
 * @example
 * ```tsx
 * import { useLoginState } from '@/src/atomic-x/state/LoginState';
 * 
 * function LoginComponent() {
 *   const { loginUserInfo, loginStatus, login, logout, setSelfInfo } = useLoginState();
 * 
 *   const handleLogin = async () => {
 *     await login({
 *       sdkAppID: 1400000000,
 *       userID: 'user123',
 *       userSig: 'eJx1kF1PwzAMhv9KlG...',
 *       onSuccess: () => console.log('Login successfully'),
 *       onError: (error) => console.error('Login failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       {loginUserInfo && <Text>Current user: {loginUserInfo.nickname}</Text>}
 *       <Button onPress={handleLogin} title="Login" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useLoginState() {
  // Get initial state from global store, ensuring late-mounted components can access existing login state
  const initialState = loginStore.getState();

  /**
   * @memberof module:LoginState
   * @type {UserProfileParam | undefined}
   * @example
   * ```tsx
   * const { loginUserInfo } = useLoginState();
   * 
   * if (loginUserInfo) {
   *   console.log('Current user:', loginUserInfo.nickname);
   *   console.log('User ID:', loginUserInfo.userID);
   * } else {
   *   console.log('User not logged in');
   * }
   * ```
   */
  const [loginUserInfo, setLoginUserInfo] = useState<UserProfileParam | undefined>(
    initialState.loginUserInfo,
  );

  /**
   * @memberof module:LoginState
   * @type {LoginStatus}
   * @example
   * ```tsx
   * const { loginStatus } = useLoginState();
   * 
   * switch (loginStatus) {
   *   case 'LOGINED':
   *     console.log('User logged in');
   *     break;
   *   case 'LOGOUT':
   *     console.log('User logged out');
   *     break;
   *   case 'UNLOGIN':
   *     console.log('User not logged in');
   *     break;
   * }
   * ```
   */
  const [loginStatus, setLoginStatus] = useState<LoginStatus>(initialState.loginStatus);

  /**
   * Subscribe to global loginStore changes to drive local state
   * Ensures multiple components share the same login state
   */
  useEffect(() => {
    const unsubscribe = loginStore.subscribe((state) => {
      setLoginUserInfo(state.loginUserInfo);
      setLoginStatus(state.loginStatus);
    });
    return unsubscribe;
  }, []);

  /**
   * Login method
   * 
   * @memberof module:LoginState
   * @param {LoginOptions} params - Login parameters
   * @example
   * ```tsx
   * await login({
   *   sdkAppID: 1400000000,
   *   userID: 'user123',
   *   userSig: 'eJx1kF1PwzAMhv9KlG...',
   *   onSuccess: () => console.log('Login successfully'),
   *   onError: (error) => console.error('Login failed:', error)
   * });
   * ```
   */
  const login = useCallback(async (params: LoginOptions): Promise<void> => {
    // Validate required parameters
    const validation = validateRequired(params, ['userID', 'sdkAppID', 'userSig']);
    if (!validation.valid) {
      const error = new Error(`Missing required parameters: ${validation.missing?.join(', ')}`);
      params.onError?.(error);
      return;
    }

    // Extract callback functions
    const { onSuccess, onError, ...loginParams } = params;

    try {
      const result = await callNativeAPI<UserProfileParam>('login', loginParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Login failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Logout method
   * 
   * @memberof module:LoginState
   * @param {LogoutOptions} params - Logout parameters (optional)
   * @example
   * ```tsx
   * await logout({
   *   onSuccess: () => console.log('Logout successfully'),
   *   onError: (error) => console.error('Logout failed:', error)
   * });
   * ```
   */
  const logout = useCallback(async (params?: LogoutOptions): Promise<void> => {
    const { onSuccess, onError, ...logoutParams } = params || {};

    try {
      const result = await callNativeAPI<void>('logout', logoutParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Logout failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Set user information
   * 
   * @memberof module:LoginState
   * @param {SetSelfInfoOptions} userInfo - User information
   * @example
   * ```tsx
   * await setSelfInfo({
   *   userProfile: {
   *     userID: 'user123',
   *     nickname: 'Zhang San',
   *     avatarURL: 'https://example.com/avatar.jpg',
   *   },
   *   onSuccess: () => console.log('Set user info successfully'),
   *   onError: (error) => console.error('Set user info failed:', error)
   * });
   * ```
   */
  const setSelfInfo = useCallback(async (userInfo: SetSelfInfoOptions): Promise<void> => {
    // Validate required parameters
    if (!userInfo.userProfile || !userInfo.userProfile.userID) {
      const error = new Error('Missing required parameter: userProfile.userID');
      userInfo.onError?.(error);
      return;
    }

    // Extract callback functions
    const { onSuccess, onError, ...infoParams } = userInfo;

    try {
      const result = await callNativeAPI<UserProfileParam>('setSelfInfo', infoParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Set self info failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Get login user information
   * 
   * @memberof module:LoginState
   * @returns {UserProfileParam | undefined} Current login user information, returns undefined if not logged in
   * @example
   * ```tsx
   * const userInfo = getLoginUserInfo();
   * if (userInfo) {
   *   console.log('Current user:', userInfo.nickname);
   * }
   * ```
   */
  const getLoginUserInfo = useCallback((): UserProfileParam | undefined => {
    return loginUserInfo;
  }, [loginUserInfo]);

  return {
    loginUserInfo,      // Current login user information
    loginStatus,        // Current login status
    login,              // Login method
    logout,             // Logout method
    setSelfInfo,        // Set user information
    getLoginUserInfo,   // Get login user information
  };
}

export default useLoginState;
