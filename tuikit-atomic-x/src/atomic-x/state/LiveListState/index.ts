/**
 * @module LiveListState
 * @module_description
 * Live List State Management Module
 * Core Features: Manages the complete lifecycle of live rooms, including creation, joining, leaving, and ending processes.
 * Technical Features: Supports pagination loading, real-time state synchronization, and dynamic live information updates with reactive data management to ensure UI and data state synchronization.
 * Business Value: Provides core live room management capabilities for live streaming platforms, supporting large-scale concurrent live scenarios as the infrastructure for live business.
 * Use Cases: Live list display, live room creation, live status management, live data statistics, and other core business scenarios.
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { callNativeAPI, createStateError } from '../../utils';
import { addListener, callExperimentalAPI as callNativeExperimentalAPI, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  LiveInfoParam,
  FetchLiveListOptions,
  CreateLiveOptions,
  JoinLiveOptions,
  LeaveLiveOptions,
  EndLiveOptions,
  UpdateLiveInfoOptions,
  UpdateLiveMetaDataOptions,
  CallExperimentalAPIOptions,
  ILiveListener,
} from './types';
import { validateRequired } from '../../utils';
import { liveListStore } from './store';
import {
  startForegroundService,
  stopForegroundService,
} from '../../utils/foregroundService';

/**
 * Live list event name constants
 */
const LIVE_LIST_EVENTS = [
  'liveList',
  'liveListCursor',
  'currentLive',
];

// iOS AtomicXCore reads modifyFlagList as LiveInfo.ModifyFlag raw bitmask values; Android reads them as ordinals.
const IOS_MODIFY_FLAG_BITS: Record<number, number> = {
  1: 1 << 0,
  2: 1 << 1,
  3: 1 << 2,
  4: 1 << 5,
  5: 1 << 6,
  6: 1 << 7,
  7: 1 << 8,
  8: 1 << 9,
  9: 1 << 10,
  10: 1 << 11,
};

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
 * Handle live state change events (module-level, shared by all hook instances)
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
          if (LIVE_LIST_EVENTS.includes(key)) {
            const value = data[key];

            if (key === 'liveList') {
              let parsedData: LiveInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveInfoParam[]>(JSON.stringify(value), []);
              }
              const lastIndexMap = new Map<string, number>();
              parsedData.forEach((live, index) => {
                if (live.liveID) {
                  lastIndexMap.set(live.liveID, index);
                }
              });
              parsedData = parsedData.filter((live, index) => {
                return lastIndexMap.get(live.liveID) === index;
              });
              liveListStore.setState({ liveList: parsedData });
            } else if (key === 'liveListCursor') {
              let parsedData: string;
              if (typeof value === 'string') {
                parsedData = value;
              } else {
                parsedData = safeJsonParse<string>(JSON.stringify(value), '');
              }
              liveListStore.setState({ liveListCursor: parsedData });
            } else if (key === 'currentLive') {
              let parsedData: LiveInfoParam | null;
              if (value === null || value === undefined) {
                parsedData = null;
              } else if (typeof value === 'object') {
                parsedData = value as LiveInfoParam;
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveInfoParam | null>(value, null);
              } else {
                parsedData = safeJsonParse<LiveInfoParam | null>(JSON.stringify(value), null);
              }
              liveListStore.setState({ currentLive: parsedData });
            }
          }
        });
      }
    } catch (error) {
      console.error(`[LiveListStore] ${eventName} event parse error:`, error);
    }
  };
}

/**
 * Register Native event listeners at module load time (once, never removed)
 */
LIVE_LIST_EVENTS.forEach((eventName) => {
  const keyObject: HybridListenerKey = {
    type: 'state',
    store: 'LiveListStore',
    name: eventName,
    roomID: null,
    listenerID: null,
  };
  const key = JSON.stringify(keyObject);
  addListener(key, handleNativeEvent(eventName));
});

export function clearLiveListState(): void {
  liveListStore.setState({
    liveList: [],
    liveListCursor: '',
    currentLive: null,
  });
}

/**
 * LiveListState Hook
 * 
 * @example
 * ```tsx
 * import { useLiveListState } from '@/src/atomic-x/state/LiveListState';
 * 
 * function LiveListComponent() {
 *   const { liveList, liveListCursor, currentLive, fetchLiveList, createLive } = useLiveListState();
 * 
 *   useEffect(() => {
 *     fetchLiveList({ cursor: '', count: 20 });
 *   }, []);
 * 
 *   return (
 *     <View>
 *       {liveList.map((live) => (
 *         <Text key={live.liveID}>{live.title}</Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 */
export function useLiveListState() {
  // Get initial snapshot from global store, ensuring late-mounted components can access existing list and currentLive
  const initialState = liveListStore.getState();

  /**
   * @memberof module:LiveListState
   * @type {LiveInfoParam[]}
   * @example
   * ```tsx
   * const { liveList } = useLiveListState();
   * 
   * 
   * // Render list
   * liveList.forEach(live => {
   *   console.log('Live room:', live.liveID);
   * });
   * ```
   */
  const [liveList, setLiveList] = useState<LiveInfoParam[]>(initialState.liveList);

  /**
   * @memberof module:LiveListState
   * @type {string}
   * @example
   * ```tsx
   * const { liveListCursor, fetchLiveList } = useLiveListState();
   * 
   * // Load more lives
   * if (liveListCursor) {
   *   await fetchLiveList({ 
   *     cursor: liveListCursor,
   *     limit: 20 
   *   });
   * } else {
   *   console.log('No more lives');
   * }
   * ```
   */
  const [liveListCursor, setLiveListCursor] = useState<string>(initialState.liveListCursor);

  /**
   * @memberof module:LiveListState
   * @type {LiveInfoParam | null}
   * @example
   * ```tsx
   * const { currentLive, setCurrentLiveInfo } = useLiveListState();
   * 
   * // Enter live room
   * setCurrentLiveInfo({ liveID: '12345', ... });
   * 
   * // Check if in a live room
   * if (currentLive) {
   *   console.log('Current live room:', currentLive.liveID);
   *   console.log('Anchor:', currentLive.anchorInfo.nickname);
   * }
   * ```
   */
  const [currentLive, setCurrentLive] = useState<LiveInfoParam | null>(initialState.currentLive);

  /**
   * Subscribe to global liveListStore changes to drive local state
   * Ensures multiple pages share the same liveList / currentLive / cursor
   */
  useEffect(() => {
    const unsubscribe = liveListStore.subscribe((state) => {
      setLiveList(state.liveList);
      setLiveListCursor(state.liveListCursor);
      setCurrentLive(state.currentLive);
    });
    return unsubscribe;
  }, []);

  /**
   * Fetch live list
   *
   * @param params - Fetch parameters
   * @example
   * ```tsx
   * await fetchLiveList({ cursor: '', count: 20 });
   * ```
   */
  const fetchLiveList = useCallback(async (params: FetchLiveListOptions): Promise<void> => {
    // Extract callback functions
    const { onSuccess, onError, ...fetchParams } = params;

    try {
      const result = await callNativeAPI<{ list: LiveInfoParam[]; cursor?: string }>('fetchLiveList', fetchParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Fetch live list failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Create live room
   *
   * @param params - Creation parameters
   * @example
   * ```tsx
   * await createLive({ liveID: 'your_live_id',  title: 'my live', coverUrl: 'https://example.com/cover.jpg' });
   * ```
   */
  const createLive = useCallback(async (params: CreateLiveOptions): Promise<void> => {
    // Extract callback functions
    const { onSuccess, onError, ...createParams } = params;

    try {
      const result = await callNativeAPI<LiveInfoParam>('createLive', createParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
        startForegroundService();
      } else {
        const error = createStateError(result, 'Create live failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Join live room
   *
   * @param params - Join parameters
   * @example
   * ```tsx
   * await joinLive({ liveID: 'host_live_id' });
   * ```
   */
  const joinLive = useCallback(async (params: JoinLiveOptions): Promise<void> => {
    // Validate required parameters
    const validation = validateRequired(params, ['liveID']);
    if (!validation.valid) {
      const error = new Error(`Missing required parameters: ${validation.missing?.join(', ')}`);
      params.onError?.(error);
      return;
    }

    // Extract callback functions
    const { onSuccess, onError, ...joinParams } = params;

    try {
      const result = await callNativeAPI<LiveInfoParam>('joinLive', joinParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
        startForegroundService();
      } else {
        const error = createStateError(result, 'Join live failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Leave live room
   *
   * @param params - Leave parameters (optional)
   * @example
   * ```tsx
   * await leaveLive();
   * ```
   */
  const leaveLive = useCallback(async (params?: LeaveLiveOptions): Promise<void> => {
    const { onSuccess, onError, ...leaveParams } = params || {};

    // Clear synchronously before the request: a late native currentLive push would otherwise unbind the next room's subscriptions.
    liveListStore.setState({ currentLive: null });
    try {
      const result = await callNativeAPI<void>('leaveLive', leaveParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Leave live failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
    stopForegroundService();
  }, []);

  /**
   * End live
   *
   * @param params - End parameters (optional)
   * @example
   * ```tsx
   * await endLive();
   * ```
   */
  const endLive = useCallback(async (params?: EndLiveOptions): Promise<void> => {
    const { onSuccess, onError, ...endParams } = params || {};

    liveListStore.setState({ currentLive: null });
    try {
      const result = await callNativeAPI<void>('endLive', endParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'End live failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
    stopForegroundService();
  }, []);

  /**
   * Update live information
   *
   * @param params - Update parameters
   * @example
   * ```tsx
   * import { LiveInfoModifyFlag } from '@tencentcloud/react-native-tuikit-atomic-x';
   *
   * await updateLiveInfo({
   *   liveInfo: { liveID: 'your_live_id', liveName: 'new title', coverURL: 'https://xxx.jpg' },
   *   modifyFlagList: [LiveInfoModifyFlag.LIVE_NAME, LiveInfoModifyFlag.COVER_URL],
   *   onSuccess: () => console.log('Update success'),
   *   onError: (error) => console.error('Update failed:', error)
   * });
   * ```
   */
  const updateLiveInfo = useCallback(async (params: UpdateLiveInfoOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveInfo?.liveID) {
      const error = new Error('Missing required parameter: liveInfo.liveID');
      params.onError?.(error);
      return;
    }
    if (!params.modifyFlagList || params.modifyFlagList.length === 0) {
      const error = new Error('Missing required parameter: modifyFlagList');
      params.onError?.(error);
      return;
    }

    // Extract callback functions
    const { onSuccess, onError, ...updateParams } = params;
    if (Platform.OS === 'ios') {
      updateParams.modifyFlagList = updateParams.modifyFlagList.map(
        (flag) => IOS_MODIFY_FLAG_BITS[flag] ?? flag
      ) as UpdateLiveInfoOptions['modifyFlagList'];
    }

    try {
      const result = await callNativeAPI<LiveInfoParam>('updateLiveInfo', updateParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Update live info failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Update live meta data
   *
   * @param params - Update meta data parameters
   * @example
   * ```tsx
   * await updateLiveMetaData({
   *   liveID: 'your_live_id',
   *   metaData: { key1: 'value1', key2: 'value2' },
   *   onSuccess: () => console.log('Update meta data success'),
   *   onError: (error) => console.error('Update meta data failed:', error)
   * });
   * ```
   */
  const updateLiveMetaData = useCallback(async (params: UpdateLiveMetaDataOptions): Promise<void> => {
    if (!params.metaData) {
      const error = new Error('Missing required parameter: metaData');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...updateParams } = params;

    try {
      const result = await callNativeAPI<void>('updateLiveMetaData', updateParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = createStateError(result, 'Update live meta data failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Call experimental API
   *
   * @param params - Experimental API parameters
   * @example
   * ```tsx
   * callExperimentalAPI({
   *   api: 'experimentalMethod',
   *   params: { key: 'value' },
   *   onResponse: (res) => console.log('Response:', res)
   * });
   * ```
   */
  const callExperimentalAPI = useCallback(async (params: CallExperimentalAPIOptions): Promise<void> => {
    const defaultCallback = {
      onResponse: (res?: string) => {
        console.log('onExperimentalAPIResponse: ', res);
      },
    };

    const finalParams = {
      ...params,
      onResponse: params.onResponse || defaultCallback.onResponse,
    };

    console.log('callExperimentalAPI', finalParams);

    try {
      const { onResponse, ...request } = finalParams;
      const responseStr = await callNativeExperimentalAPI(JSON.stringify(request));
      onResponse?.(responseStr || undefined);
    } catch (error: any) {
      console.error('callExperimentalAPI error:', error);
    }
  }, []);

  /**
   * Add live list event listener
   *
   * @param eventName - Event name, options: 'onLiveEnded' (live ended)<br>'onKickedOutOfLive' (kicked out of live room)
   * @param listener - Event callback function
   * @example
   * ```tsx
   * addLiveListListener('onLiveEnded', {
   *   callback: (params) => {
   *     console.log('result:', params);
   *   }
   * });
   * ```
   */
  const addLiveListListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject = {
      type: 'state',
      store: 'LiveListStore',
      name: eventName,
      roomID: null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, []);

  /**
   * Remove live list event listener
   *
   * @param eventName - Event name, options: 'onLiveEnded' (live ended)<br>'onKickedOutOfLive' (kicked out of live room)
   * @param listener - Event callback function
   * @example
   * ```tsx
   * removeLiveListListener('onLiveEnded', liveEndedListener);
   * ```
   */
  const removeLiveListListener = useCallback((eventName: string, _listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject = {
      type: 'state',
      store: 'LiveListStore',
      name: eventName,
      roomID: null,
      listenerID: listenerID ?? null,
    };

    removeListener(JSON.stringify(createListenerKeyObject));

  }, []);

  return {
    liveList,               // Live list data
    liveListCursor,         // Live list pagination cursor
    currentLive,            // Current live information

    fetchLiveList,          // Fetch live list
    createLive,             // Create live
    joinLive,               // Join live
    leaveLive,              // Leave live
    endLive,                // End live
    updateLiveInfo,         // Update live information
    updateLiveMetaData,     // Update live meta data
    callExperimentalAPI,    // Call experimental API

    addLiveListListener,    // Add event listener
    removeLiveListListener, // Remove event listener
  };
}

export default useLiveListState;
