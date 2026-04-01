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
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  LiveInfoParam,
  FetchLiveListOptions,
  CreateLiveOptions,
  JoinLiveOptions,
  LeaveLiveOptions,
  EndLiveOptions,
  UpdateLiveInfoOptions,
  CallExperimentalAPIOptions,
  ILiveListener,
} from './types';
import { validateRequired } from '../../utils';
import { liveListStore } from './store';

/**
 * Live list event name constants
 */
const LIVE_LIST_EVENTS = [
  'liveList',
  'liveListCursor',
  'currentLive',
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

  // Event listener references

  // Live list event listener mapping
  type WritableMap = Record<string, unknown>;



  /**
   * Handle live state change events
   */
  const handleEvent = useCallback((eventName: string) => (event: WritableMap) => {
    try {
      // If event is already an object, use it directly; otherwise try to parse
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;

      console.log(`[LivePage] ${eventName} event received:`, JSON.stringify(data));

      // Check if data key matches any value in LIVE_LIST_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.keys(data).forEach((key) => {
          if (LIVE_LIST_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'liveList') {
              // liveList is an array type
              let parsedData: LiveInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveInfoParam[]>(JSON.stringify(value), []);
              }
              // Update global store, which drives all hook instances uniformly
              liveListStore.setState({ liveList: parsedData });
            } else if (key === 'liveListCursor') {
              // liveListCursor is a string type
              let parsedData: string;
              if (typeof value === 'string') {
                parsedData = value;
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<string>(value, '');
              } else {
                parsedData = safeJsonParse<string>(JSON.stringify(value), '');
              }
              liveListStore.setState({ liveListCursor: parsedData });
            } else if (key === 'currentLive') {
              // currentLive can be an object or null
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
      console.error(`[LivePage] ${eventName} event parse error:`, error);
      console.log(`[LivePage] ${eventName} event received (raw):`, event);
    }
  }, []);


  /**
   * Bind event listeners
   */
  useEffect(() => {
    const createListenerKeyObject = (eventName: string, listenerID?: string | null): HybridListenerKey => {
      return {
        type: 'state',
        store: 'LiveListStore',
        name: eventName,
        roomID: null,
        listenerID: listenerID ?? null,
      };
    };

    // Save references to listener cleanup functions
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    LIVE_LIST_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener will automatically register event listeners on both Native and JS layers
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[LivePage] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      LIVE_LIST_EVENTS.forEach((eventName) => {
        const keyObject = createListenerKeyObject(eventName);
        const key = JSON.stringify(keyObject);
        removeListener(key);
      });
      // Also clean up JS layer subscriptions
      cleanupFunctions.forEach((cleanup) => {
        cleanup.remove();
      });
    };
  }, [handleEvent]);

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
        const error = new Error(result.error || 'Fetch live list failed');
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
      } else {
        const error = new Error(result.error || 'Create live failed');
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
      } else {
        const error = new Error(result.error || 'Join live failed');
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

    try {
      const result = await callNativeAPI<void>('leaveLive', leaveParams);

      if (result.success) {
        // On success, trigger callback and clear global LiveListStore state
        liveListStore.clearState();
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Leave live failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
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

    try {
      const result = await callNativeAPI<void>('endLive', endParams);

      if (result.success) {
        // On success, trigger callback and clear global LiveListStore state
        liveListStore.clearState();
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'End live failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Update live information
   *
   * @param params - Update parameters
   * @example
   * ```tsx
   * await updateLiveInfo({ liveID: 'your_live_id', title: 'new title' });
   * ```
   */
  const updateLiveInfo = useCallback(async (params: UpdateLiveInfoOptions): Promise<void> => {
    // Validate required parameters
    const validation = validateRequired(params, ['liveID']);
    if (!validation.valid) {
      const error = new Error(`Missing required parameters: ${validation.missing?.join(', ')}`);
      params.onError?.(error);
      return;
    }

    // Extract callback functions
    const { onSuccess, onError, ...updateParams } = params;

    try {
      const result = await callNativeAPI<LiveInfoParam>('updateLiveInfo', updateParams);

      if (result.success) {
        // On success, only trigger callback; state update is handled by event listeners
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Update live info failed');
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
      const result = await callNativeAPI<unknown>('callExperimentalAPI', finalParams);
      if (result.success && finalParams.onResponse) {
        const responseStr = result.data ? JSON.stringify(result.data) : undefined;
        finalParams.onResponse(responseStr);
      }
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
  const removeLiveListListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
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
    callExperimentalAPI,    // Call experimental API

    addLiveListListener,    // Add event listener
    removeLiveListListener, // Remove event listener
  };
}

export default useLiveListState;
