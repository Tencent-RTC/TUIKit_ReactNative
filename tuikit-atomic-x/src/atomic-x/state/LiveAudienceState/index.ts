/**
 * @module LiveAudienceState
 * @module_description
 * Live Audience State Management Module
 * Core Features: Manages live room audience list, provides audience permission control, administrator settings, and other live room order maintenance functions.
 * Technical Features: Supports real-time audience list updates, hierarchical permission management, batch operations, and other advanced features to ensure live room order and user experience.
 * Business Value: Provides a complete audience management solution for live streaming platforms, supporting order maintenance in large-scale audience scenarios.
 * Use Cases: Audience management, permission control, live room order maintenance, audience interaction management, and other core business scenarios.
 */

import { useState, useEffect, useCallback } from 'react';
import { callNativeAPI, createStateError } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  LiveUserInfoParam,
  FetchAudienceListOptions,
  SetAdministratorOptions,
  RevokeAdministratorOptions,
  KickUserOutOfRoomOptions,
  DisableSendMessageOptions,
} from './types';
import { liveAudienceStore } from './store';
import { createCurrentLiveBinding } from '../internal/currentLiveWatcher';

/**
 * Audience listener function type
 */
type ILiveListener = (params?: unknown) => void;

const LIVE_AUDIENCE_EVENTS = [
  'audienceList',
  'audienceCount',
  'messageBannedUserList',
];

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

function parseUserList(value: unknown): LiveUserInfoParam[] {
  if (Array.isArray(value)) {
    return value as LiveUserInfoParam[];
  }
  if (typeof value === 'string') {
    return safeJsonParse<LiveUserInfoParam[]>(value, []);
  }
  return safeJsonParse<LiveUserInfoParam[]>(JSON.stringify(value), []);
}

function createNativeEventHandler(liveID: string, eventName: string) {
  return (event: Record<string, unknown>) => {
    try {
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          audienceList?: LiveUserInfoParam[];
          audienceCount?: number;
          messageBannedUserList?: LiveUserInfoParam[];
        } = {};

        Object.keys(data).forEach((key) => {
          if (!LIVE_AUDIENCE_EVENTS.includes(key)) {
            return;
          }
          const value = data[key];
          if (key === 'audienceList') {
            updates.audienceList = parseUserList(value);
          } else if (key === 'audienceCount') {
            updates.audienceCount = typeof value === 'number' ? value : (Number(value) || 0);
          } else if (key === 'messageBannedUserList') {
            updates.messageBannedUserList = parseUserList(value);
          }
        });

        if (Object.keys(updates).length > 0) {
          liveAudienceStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[LiveAudienceState] ${eventName} event parse error:`, error);
    }
  };
}

const currentLiveBinding = createCurrentLiveBinding({
  store: 'LiveAudienceStore',
  events: LIVE_AUDIENCE_EVENTS,
  createHandler: createNativeEventHandler,
  reset: (liveID) => liveAudienceStore.resetState(liveID),
});

/**
 * LiveAudienceState Hook
 * 
 * @example
 * ```tsx
 * import { useLiveAudienceState } from '@/src/atomic-x/state/LiveAudienceState';
 * 
 * function AudienceComponent() {
 *   const { 
 *     audienceList, 
 *     audienceCount, 
 *     fetchAudienceList,
 *     setAdministrator 
 *   } = useLiveAudienceState('your_live_id');
 * 
 *   useEffect(() => {
 *     fetchAudienceList();
 *   }, []);
 * 
 *   return (
 *     <View>
 *       <Text>Audience count: {audienceCount}</Text>
 *       {audienceList.map((audience) => (
 *         <Text key={audience.userID}>{audience.nickname}</Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 */
export function useLiveAudienceState(liveID: string) {
  // Get initial state from global store
  const initialState = liveAudienceStore.getState(liveID);

  /**
   * @memberof module:LiveAudienceState
   * @type {LiveUserInfoParam[]}
   * @example
   * ```tsx
   * const { audienceList } = useLiveAudienceState(liveID);
   * 
   * console.log('Current audience count:', audienceList.length);
   * audienceList.forEach(audience => {
   *   console.log('Audience:', audience.nickname, audience.userID);
   * });
   * ```
   */
  const [audienceList, setAudienceList] = useState<LiveUserInfoParam[]>(initialState.audienceList);

  /**
   * @memberof module:LiveAudienceState
   * @type {number}
   * @example
   * ```tsx
   * const { audienceCount } = useLiveAudienceState(liveID);
   * 
   * const displayText = audienceCount >= 100 
   *   ? '99+' 
   *   : audienceCount.toString();
   * console.log('Audience count:', displayText);
   * ```
   */
  const [audienceCount, setAudienceCount] = useState<number>(0);

  const [messageBannedUserList, setMessageBannedUserList] = useState<LiveUserInfoParam[]>(initialState.messageBannedUserList);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = liveAudienceStore.subscribe(liveID, (state) => {
      setAudienceList(state.audienceList);
      // SDK audienceCount is driven only by onRoomUserCountChanged, which some Android hosts deliver late or not at all;
      // the list follows enter/leave in real time, while a paged list of a large room is shorter than the SDK count.
      setAudienceCount(Math.max(Number(state.audienceCount) || 0, state.audienceList.length));
      setMessageBannedUserList(state.messageBannedUserList);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  useEffect(() => {
    currentLiveBinding.ensureWatchCurrentLive();
    currentLiveBinding.bindEvent(liveID);
  }, [liveID]);

  /**
   * Fetch live room audience list
   * 
   * @param params - Fetch audience list parameters (optional)
   * @example
   * ```tsx
   * await fetchAudienceList({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('Fetch audience list successfully'),
   *   onError: (error) => console.error('Fetch audience list failed:', error)
   * });
   * ```
   */
  const fetchAudienceList = useCallback(async (params?: FetchAudienceListOptions): Promise<void> => {
    const { onSuccess, onError, ...fetchParams } = params || {};

    try {
      const result = await callNativeAPI<LiveUserInfoParam[]>('fetchAudienceList', fetchParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Fetch audience list failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Set administrator
   * 
   * @param params - Set administrator parameters
   * @example
   * ```tsx
   * await setAdministrator({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('Set administrator successfully'),
   *   onError: (error) => console.error('Set administrator failed:', error)
   * });
   * ```
   */
  const setAdministrator = useCallback(async (params: SetAdministratorOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...adminParams } = params;

    try {
      const result = await callNativeAPI<void>('setAdministrator', adminParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Set administrator failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Revoke administrator permission
   * 
   * @param params - Revoke administrator parameters
   * @example
   * ```tsx
   * await revokeAdministrator({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('Revoke administrator successfully'),
   *   onError: (error) => console.error('Revoke administrator failed:', error)
   * });
   * ```
   */
  const revokeAdministrator = useCallback(async (params: RevokeAdministratorOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...revokeParams } = params;

    try {
      const result = await callNativeAPI<void>('revokeAdministrator', revokeParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Revoke administrator failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Kick user out of live room
   * 
   * @param params - Kick user parameters
   * @example
   * ```tsx
   * await kickUserOutOfRoom({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('Kick user successfully'),
   *   onError: (error) => console.error('Kick user failed:', error)
   * });
   * ```
   */
  const kickUserOutOfRoom = useCallback(async (params: KickUserOutOfRoomOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...kickParams } = params;

    try {
      const result = await callNativeAPI<void>('kickUserOutOfRoom', kickParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Kick user out of room failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Disable user from sending messages
   * 
   * @param params - Disable send message parameters
   * @example
   * ```tsx
   * await disableSendMessage({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   isDisable: true,
   *   onSuccess: () => console.log('Disable send message successfully'),
   *   onError: (error) => console.error('Disable send message failed:', error)
   * });
   * ```
   */
  const disableSendMessage = useCallback(async (params: DisableSendMessageOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID || params.isDisable === undefined) {
      const error = new Error('Missing required parameters: userID or isDisable');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...disableParams } = params;

    try {
      const result = await callNativeAPI<void>('disableSendMessage', disableParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Disable send message failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Add audience event listener
   * 
   * @param eventName - Event name, options: 'onAudienceJoined' (audience joined)<br>'onAudienceLeft' (audience left)
   * @param listener - Event callback function
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addAudienceListener('onAudienceJoined', (params) => {
   *   console.log('Audience joined:', params);
   * });
   * ```
   */
  const addAudienceListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'LiveAudienceStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * Remove audience event listener
   * 
   * @param eventName - Event name, options: 'onAudienceJoined' (audience joined)<br>'onAudienceLeft' (audience left)
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeAudienceListener('onAudienceJoined');
   * ```
   */
  const removeAudienceListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'LiveAudienceStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    audienceList,              // Live room audience list
    audienceCount,             // Live room audience count
    messageBannedUserList,
    fetchAudienceList,          // Fetch audience list
    setAdministrator,          // Set administrator
    revokeAdministrator,       // Revoke administrator permission
    kickUserOutOfRoom,         // Kick user out of live room
    disableSendMessage,         // Disable user from sending messages
    addAudienceListener,       // Add audience event listener
    removeAudienceListener,     // Remove audience event listener
  };
}

export default useLiveAudienceState;

