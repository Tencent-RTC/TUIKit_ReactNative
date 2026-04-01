/**
 * @module BattleState
 * @module_description
 * Live Battle Management Module
 * Core Features: Handles battle process between streamers, including battle requests, acceptance, rejection, exit, and complete battle management functions.
 * Technical Highlights: Supports real-time battle state synchronization, score statistics, battle duration control, result calculation, and other advanced features.
 * Business Value: Provides rich interactive gameplay for live streaming platforms, increasing streamer revenue and user engagement.
 * Application Scenarios: Streamer battle, battle live streaming, score statistics, interactive games, and other entertainment interaction scenarios.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  BattleInfoParam,
  SeatUserInfoParam,
  RequestBattleOptions,
  CancelBattleRequestOptions,
  AcceptBattleOptions,
  RejectBattleOptions,
  ExitBattleOptions,
} from './types';
import { battleStore } from './store';

/**
 * Battle listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Battle state event name constants
 */
const BATTLE_EVENTS = [
  'currentBattleInfo',
  'battleUsers',
  'battleScore',
];

/**
 * Safe JSON parse
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
 * Parse Map type (convert from JSON object or array to Map)
 */
function parseMapFromJson(json: string): Map<string, number> | null {
  try {
    if (!json || typeof json !== 'string') {
      return null;
    }
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    // If array format [["key", value], ...]
    if (Array.isArray(parsed)) {
      const map = new Map<string, number>();
      parsed.forEach(([key, value]: [string, number]) => {
        if (typeof key === 'string' && typeof value === 'number') {
          map.set(key, value);
        }
      });
      return map;
    }
    // If object format { "key": value, ... }
    const map = new Map<string, number>();
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === 'number') {
        map.set(key, value);
      }
    });
    return map;
  } catch (error) {
    console.error('parseMapFromJson error:', error);
    return null;
  }
}

/**
 * BattleState Hook
 * 
 * @example
 * ```tsx
 * import { useBattleState } from '@/src/atomic-x/state/BattleState';
 * 
 * function BattleComponent() {
 *   const { 
 *     currentBattleInfo,
 *     battleUsers,
 *     battleScore,
 *     requestBattle,
 *     acceptBattle 
 *   } = useBattleState('your_live_id');
 * 
 *   const handleRequestBattle = async () => {
 *     await requestBattle({
 *       liveID: 'your_live_id',
 *       userIDList: ['target_user_id'],
 *       timeout: 10,
 *       onSuccess: (battleInfo) => console.log('Battle request successful:', battleInfo),
 *       onError: (error) => console.error('Battle request failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       {currentBattleInfo && <Text>Battle ID: {currentBattleInfo.battleID}</Text>}
 *       <Text>Battle User Count: {battleUsers.length}</Text>
 *       <Button onPress={handleRequestBattle} title="Request Battle" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useBattleState(liveID: string) {
  // Get initial state from global store
  const initialState = battleStore.getState(liveID);

  /**
   * Current battle information
   * @type {BattleInfoParam | null}
   * @description Stores detailed information of current battle, including battle ID, state, duration, etc. null means no ongoing battle
   * @default Get initial value from global store
   */
  const [currentBattleInfo, setCurrentBattleInfo] = useState<BattleInfoParam | null>(initialState.currentBattleInfo);

  /**
   * Battle user list
   * @type {SeatUserInfoParam[]}
   * @description List of all users participating in current battle, including user basic information and battle state
   * @default Get initial value from global store
   */
  const [battleUsers, setBattleUsers] = useState<SeatUserInfoParam[]>(initialState.battleUsers);

  /**
   * Battle score mapping
   * @type {Map<string, number> | null}
   * @description Stores scores of users in battle, key is user ID, value is score, null means no score data
   * @default Get initial value from global store
   */
  const [battleScore, setBattleScore] = useState<Map<string, number> | null>(initialState.battleScore);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = battleStore.subscribe(liveID, (state) => {
      setCurrentBattleInfo(state.currentBattleInfo);
      setBattleUsers(state.battleUsers);
      setBattleScore(state.battleScore);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle battle state change events
   * Update global store, store will automatically notify all subscribers
   */
  const handleEvent = useCallback((eventName: string) => (event: WritableMap) => {
    try {
      // If event is already an object, use it directly; otherwise try to parse
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;

      console.log(`[BattleState] ${eventName} event received:`, JSON.stringify(data));

      // Check if data's keys match any values in BATTLE_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          currentBattleInfo?: BattleInfoParam | null;
          battleUsers?: SeatUserInfoParam[];
          battleScore?: Map<string, number> | null;
        } = {};

        Object.keys(data).forEach((key) => {
          if (BATTLE_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'currentBattleInfo') {
              // currentBattleInfo can be object or null
              let parsedData: BattleInfoParam | null;
              if (value === null || value === undefined) {
                parsedData = null;
              } else if (typeof value === 'object') {
                parsedData = value as BattleInfoParam;
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<BattleInfoParam | null>(value, null);
              } else {
                parsedData = safeJsonParse<BattleInfoParam | null>(JSON.stringify(value), null);
              }
              updates.currentBattleInfo = parsedData;
            } else if (key === 'battleUsers') {
              // battleUsers is array type
              let parsedData: SeatUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as SeatUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<SeatUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<SeatUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.battleUsers = parsedData;
            } else if (key === 'battleScore') {
              // battleScore needs special parsing to Map
              let parsedData: Map<string, number> | null;
              if (value === null || value === undefined) {
                parsedData = null;
              } else if (value instanceof Map) {
                parsedData = value;
              } else if (typeof value === 'string') {
                parsedData = parseMapFromJson(value);
              } else {
                parsedData = parseMapFromJson(JSON.stringify(value));
              }
              updates.battleScore = parsedData;
            }
          }
        });

        // Batch update global store (only update once to avoid multiple notifications)
        if (Object.keys(updates).length > 0) {
          battleStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[BattleState] ${eventName} event parse error:`, error);
      console.log(`[BattleState] ${eventName} event received (raw):`, event);
    }
  }, [liveID]);

  /**
   * Bind event listeners
   */
  useEffect(() => {
    if (!liveID) {
      return;
    }

    const createListenerKeyObject = (eventName: string, listenerID?: string | null): HybridListenerKey => {
      return {
        type: 'state',
        store: 'BattleStore',
        name: eventName,
        roomID: liveID ?? null,
        listenerID: listenerID ?? null,
      };
    };

    // Save listener cleanup function references
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    BATTLE_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener will automatically register Native and JS layer event listeners
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[BattleState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      BATTLE_EVENTS.forEach((eventName) => {
        const keyObject = createListenerKeyObject(eventName);
        const key = JSON.stringify(keyObject);
        removeListener(key);
      });
      // Also clean up JS layer subscriptions
      cleanupFunctions.forEach((cleanup) => {
        cleanup.remove();
      });
    };
  }, [handleEvent, liveID]);

  /**
   * Request battle
   * 
   * @param params - Request battle parameters
   * @example
   * ```tsx
   * await requestBattle({
   *   liveID: 'your_live_id',
   *   userIDList: ['target_user_id'],
   *   timeout: 10,
   *   config: {
   *     duration: 300,
   *     needResponse: true,
   *   },
   *   onSuccess: (battleInfo) => console.log('Battle request successful:', battleInfo),
   *   onError: (error) => console.error('Battle request failed:', error)
   * });
   * ```
   */
  const requestBattle = useCallback(async (params: RequestBattleOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.userIDList || params.userIDList.length === 0) {
      const error = new Error('Missing required parameters: liveID or userIDList');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...battleParams } = params;

    try {
      const result = await callNativeAPI<BattleInfoParam>('requestBattle', battleParams);

      if (result.success) {
        // Trigger callback on success, state update handled by event listener
        onSuccess?.(result.data, result.data);
      } else {
        const error = new Error(result.error || 'Request battle failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Cancel battle request
   * 
   * @param params - Cancel battle request parameters
   * @example
   * ```tsx
   * await cancelBattleRequest({
   *   liveID: 'your_live_id',
   *   battleID: 'battle_id',
   *   userIDList: ['target_user_id'],
   *   onSuccess: () => console.log('Battle request cancelled successfully'),
   *   onError: (error) => console.error('Cancel battle request failed:', error)
   * });
   * ```
   */
  const cancelBattleRequest = useCallback(async (params: CancelBattleRequestOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.battleID || !params.userIDList || params.userIDList.length === 0) {
      const error = new Error('Missing required parameters: liveID, battleID or userIDList');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...cancelParams } = params;

    try {
      const result = await callNativeAPI<void>('cancelBattleRequest', cancelParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Cancel battle request failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Accept battle
   * 
   * @param params - Accept battle parameters
   * @example
   * ```tsx
   * await acceptBattle({
   *   liveID: 'your_live_id',
   *   battleID: 'battle_id',
   *   onSuccess: () => console.log('Battle accepted successfully'),
   *   onError: (error) => console.error('Accept battle failed:', error)
   * });
   * ```
   */
  const acceptBattle = useCallback(async (params: AcceptBattleOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.battleID) {
      const error = new Error('Missing required parameters: liveID or battleID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...acceptParams } = params;

    try {
      const result = await callNativeAPI<void>('acceptBattle', acceptParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Accept battle failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Reject battle
   * 
   * @param params - Reject battle parameters
   * @example
   * ```tsx
   * await rejectBattle({
   *   liveID: 'your_live_id',
   *   battleID: 'battle_id',
   *   onSuccess: () => console.log('Battle rejected successfully'),
   *   onError: (error) => console.error('Reject battle failed:', error)
   * });
   * ```
   */
  const rejectBattle = useCallback(async (params: RejectBattleOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.battleID) {
      const error = new Error('Missing required parameters: liveID or battleID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...rejectParams } = params;

    try {
      const result = await callNativeAPI<void>('rejectBattle', rejectParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Reject battle failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Exit battle
   * 
   * @param params - Exit battle parameters
   * @example
   * ```tsx
   * await exitBattle({
   *   liveID: 'your_live_id',
   *   battleID: 'battle_id',
   *   onSuccess: () => console.log('Exited battle successfully'),
   *   onError: (error) => console.error('Exit battle failed:', error)
   * });
   * ```
   */
  const exitBattle = useCallback(async (params: ExitBattleOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.battleID) {
      const error = new Error('Missing required parameters: liveID or battleID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...exitParams } = params;

    try {
      const result = await callNativeAPI<void>('exitBattle', exitParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Exit battle failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Add battle event listener
   * 
   * @param eventName - Event name, optional values: 'onBattleStarted'(Battle started)<br>'onBattleEnded'(Battle ended)<br>'onUserJoinBattle'(User joined battle)<br>'onUserExitBattle'(User exited battle)<br>'onBattleRequestReceived'(Battle request received)<br>'onBattleRequestCancelled'(Battle request cancelled)<br>'onBattleRequestTimeout'(Battle request timeout)<br>'onBattleRequestAccept'(Battle request accepted)<br>'onBattleRequestReject'(Battle request rejected)
   * @param listener - Event handler function
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addBattleListener('onBattleStarted', (params) => {
   *   console.log('Battle started:', params);
   * });
   * ```
   */
  const addBattleListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'BattleStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * Remove battle event listener
   * 
   * @param eventName - Event name, optional values: 'onBattleStarted'(Battle started)<br>'onBattleEnded'(Battle ended)<br>'onUserJoinBattle'(User joined battle)<br>'onUserExitBattle'(User exited battle)<br>'onBattleRequestReceived'(Battle request received)<br>'onBattleRequestCancelled'(Battle request cancelled)<br>'onBattleRequestTimeout'(Battle request timeout)<br>'onBattleRequestAccept'(Battle request accepted)<br>'onBattleRequestReject'(Battle request rejected)
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeBattleListener('onBattleStarted');
   * ```
   */
  const removeBattleListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'BattleStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    currentBattleInfo,      // Current battle information
    battleUsers,            // Battle user list
    battleScore,            // Battle score mapping
    requestBattle,          // Request battle
    cancelBattleRequest,    // Cancel battle request
    acceptBattle,           // Accept battle
    rejectBattle,           // Reject battle
    exitBattle,             // Exit battle
    addBattleListener,      // Add battle event listener
    removeBattleListener,   // Remove battle event listener
  };
}

export default useBattleState;

