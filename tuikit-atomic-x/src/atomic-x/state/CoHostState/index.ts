/**
 * @module CoHostState
 * @module_description
 * Co-host Management Module
 * Core Features: Implements connection functionality between streamers, supporting host invitations, connection requests, and connection status management.
 * Technical Features: Supports multi-host audio/video synchronization, picture-in-picture display, and audio/video quality optimization to ensure smooth connection experience.
 * Business Value: Provides core collaboration capabilities between streamers, supporting advanced scenarios like PK battles and collaborative streaming.
 * Use Cases: Host connections, collaborative streaming, cross-platform connections, and streamer interactions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import { coHostStore } from './store';
import type {
  LiveUserInfoParam,
  RequestHostConnectionOptions,
  CancelHostConnectionOptions,
  AcceptHostConnectionOptions,
  RejectHostConnectionOptions,
  ExitHostConnectionOptions,
} from './types';
import { CoHostStatus } from './types';

/**
 * Co-host listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Co-host status event name constants
 */
const CO_HOST_EVENTS = [
  'connected',
  'invitees',
  'applicant',
  'candidates',
  'coHostStatus',
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
 * CoHostState Hook
 * 
 * @example
 * ```tsx
 * import { useCoHostState } from '@/src/atomic-x/state/CoHostState';
 * 
 * function CoHostComponent() {
 *   const { 
 *     connected, 
 *     invitees, 
 *     applicant,
 *     requestHostConnection,
 *     acceptHostConnection 
 *   } = useCoHostState('your_live_id');
 * 
 *   const handleRequestConnection = async () => {
 *     await requestHostConnection({
 *       liveID: 'your_live_id',
 *       onSuccess: () => console.log('Request connection successfully'),
 *       onError: (error) => console.error('Request connection failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       <Text>Connected hosts: {connected.length}</Text>
 *       {applicant && <Text>Applicant host: {applicant.nickname}</Text>}
 *       <Button onPress={handleRequestConnection} title="Request Connection" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useCoHostState(liveID: string) {
  // Get initial state from global store
  const initialState = coHostStore.getState(liveID);

  /**
   * @memberof module:CoHostState
   * @type {LiveUserInfoParam[]}
   * @example
   * ```tsx
   * const { connected } = useCoHostState(liveID);
   * 
   * console.log('Connected hosts count:', connected.length);
   * connected.forEach(host => {
   *   console.log('Host:', host.nickname, host.userID);
   * });
   * ```
   */
  const [connected, setConnected] = useState<LiveUserInfoParam[]>(initialState.connected);

  /**
   * @memberof module:CoHostState
   * @type {LiveUserInfoParam[]}
   * @example
   * ```tsx
   * const { invitees } = useCoHostState(liveID);
   * 
   * console.log('Invited hosts count:', invitees.length);
   * invitees.forEach(host => {
   *   console.log('Invited host:', host.nickname, host.userID);
   * });
   * ```
   */
  const [invitees, setInvitees] = useState<LiveUserInfoParam[]>(initialState.invitees);

  /**
   * @memberof module:CoHostState
   * @type {LiveUserInfoParam | undefined}
   * @example
   * ```tsx
   * const { applicant } = useCoHostState(liveID);
   * 
   * if (applicant) {
   *   console.log('Applicant host:', applicant.nickname, applicant.userID);
   * }
   * ```
   */
  const [applicant, setApplicant] = useState<LiveUserInfoParam | undefined>(initialState.applicant);

  /**
   * @memberof module:CoHostState
   * @type {LiveUserInfoParam[]}
   * @example
   * ```tsx
   * const { candidates } = useCoHostState(liveID);
   * 
   * console.log('Candidate hosts count:', candidates.length);
   * candidates.forEach(host => {
   *   console.log('Candidate host:', host.nickname, host.userID);
   * });
   * ```
   */
  const [candidates, setCandidates] = useState<LiveUserInfoParam[]>(initialState.candidates);

  /**
   * @memberof module:CoHostState
   * @type {CoHostStatus}
   * @example
   * ```tsx
   * const { coHostStatus } = useCoHostState(liveID);
   * 
   * console.log('Current co-host status:', coHostStatus);
   * if (coHostStatus === CoHostStatus.CONNECTED) {
   *   console.log('Connected');
   * }
   * ```
   */
  const [coHostStatus, setCoHostStatus] = useState<CoHostStatus>(initialState.coHostStatus);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = coHostStore.subscribe(liveID, (state) => {
      setConnected(state.connected);
      setInvitees(state.invitees);
      setApplicant(state.applicant);
      setCandidates(state.candidates);
      setCoHostStatus(state.coHostStatus);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle co-host status change events
   * Updates global store, which automatically notifies all subscribers
   */
  const handleEvent = useCallback((eventName: string) => (event: WritableMap) => {
    try {
      // If event is already an object, use it directly; otherwise try to parse
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;

      console.log(`[CoHostState] ${eventName} event received:`, JSON.stringify(data));

      // Check if data's keys match any value in CO_HOST_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          connected?: LiveUserInfoParam[];
          invitees?: LiveUserInfoParam[];
          applicant?: LiveUserInfoParam | undefined;
          candidates?: LiveUserInfoParam[];
          coHostStatus?: CoHostStatus;
        } = {};

        Object.keys(data).forEach((key) => {
          if (CO_HOST_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'connected') {
              // connected is array type
              let parsedData: LiveUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.connected = parsedData;
            } else if (key === 'invitees') {
              // invitees is array type
              let parsedData: LiveUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.invitees = parsedData;
            } else if (key === 'applicant') {
              // applicant can be object or null
              let parsedData: LiveUserInfoParam | undefined;
              if (value === null || value === undefined) {
                parsedData = undefined;
              } else if (typeof value === 'object') {
                parsedData = value as LiveUserInfoParam;
              } else if (typeof value === 'string') {
                const parsed = safeJsonParse<LiveUserInfoParam | null>(value, null);
                parsedData = parsed || undefined;
              } else {
                const parsed = safeJsonParse<LiveUserInfoParam | null>(JSON.stringify(value), null);
                parsedData = parsed || undefined;
              }
              updates.applicant = parsedData;
            } else if (key === 'candidates') {
              // candidates is array type
              let parsedData: LiveUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.candidates = parsedData;
            } else if (key === 'coHostStatus') {
              // coHostStatus is enum type
              const numValue = typeof value === 'number' ? value : (Number(value) || CoHostStatus.DISCONNECTED);
              const parsedData = isNaN(numValue) ? CoHostStatus.DISCONNECTED : (numValue as CoHostStatus);
              updates.coHostStatus = parsedData;
            }
          }
        });

        // Batch update global store (only update once to avoid multiple notifications)
        if (Object.keys(updates).length > 0) {
          coHostStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[CoHostState] ${eventName} event parse error:`, error);
      console.log(`[CoHostState] ${eventName} event received (raw):`, event);
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
        store: 'CoHostStore',
        name: eventName,
        roomID: liveID ?? null,
        listenerID: listenerID ?? null,
      };
    };

    // Save references to listener cleanup functions
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    CO_HOST_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener automatically registers event listeners for both Native side and JS layer
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[CoHostState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      CO_HOST_EVENTS.forEach((eventName) => {
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
   * Request host connection
   * 
   * @param params - Request host connection parameters
   * @example
   * ```tsx
   * await requestHostConnection({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('Request connection successfully'),
   *   onError: (error) => console.error('Request connection failed:', error)
   * });
   * ```
   */
  const requestHostConnection = useCallback(async (params: RequestHostConnectionOptions): Promise<void> => {
    const { onSuccess, onError, ...requestParams } = params;

    try {
      const result = await callNativeAPI<void>('requestHostConnection', requestParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Request host connection failed');
        (error as any).code = result.code;
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Cancel host connection request
   * 
   * @param params - Cancel host connection request parameters
   * @example
   * ```tsx
   * await cancelHostConnection({
   *   liveID: 'your_live_id',
   *   toHostLiveID: 'target_live_id',
   *   onSuccess: () => console.log('Cancel connection request successfully'),
   *   onError: (error) => console.error('Cancel connection request failed:', error)
   * });
   * ```
   */
  const cancelHostConnection = useCallback(async (params: CancelHostConnectionOptions): Promise<void> => {
    const { onSuccess, onError, ...cancelParams } = params;

    try {
      const result = await callNativeAPI<void>('cancelHostConnection', cancelParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Cancel host connection failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Accept host connection request
   * 
   * @param params - Accept host connection request parameters
   * @example
   * ```tsx
   * await acceptHostConnection({
   *   liveID: 'your_live_id',
   *   fromHostLiveID: 'from_live_id',
   *   onSuccess: () => console.log('Accept connection request successfully'),
   *   onError: (error) => console.error('Accept connection request failed:', error)
   * });
   * ```
   */
  const acceptHostConnection = useCallback(async (params: AcceptHostConnectionOptions): Promise<void> => {
    // Validate required parameters
    if (!params.fromHostLiveID) {
      const error = new Error('Missing required parameter: fromHostLiveID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...acceptParams } = params;

    try {
      const result = await callNativeAPI<void>('acceptHostConnection', acceptParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Accept host connection failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Reject host connection request
   * 
   * @param params - Reject host connection request parameters
   * @example
   * ```tsx
   * await rejectHostConnection({
   *   liveID: 'your_live_id',
   *   fromHostLiveID: 'from_live_id',
   *   onSuccess: () => console.log('Reject connection request successfully'),
   *   onError: (error) => console.error('Reject connection request failed:', error)
   * });
   * ```
   */
  const rejectHostConnection = useCallback(async (params: RejectHostConnectionOptions): Promise<void> => {
    // Validate required parameters
    if (!params.fromHostLiveID) {
      const error = new Error('Missing required parameter: fromHostLiveID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...rejectParams } = params;

    try {
      const result = await callNativeAPI<void>('rejectHostConnection', rejectParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Reject host connection failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Exit host connection
   * 
   * @param params - Exit host connection parameters (optional)
   * @example
   * ```tsx
   * await exitHostConnection({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('Exit connection successfully'),
   *   onError: (error) => console.error('Exit connection failed:', error)
   * });
   * ```
   */
  const exitHostConnection = useCallback(async (params?: ExitHostConnectionOptions): Promise<void> => {
    const { onSuccess, onError, ...exitParams } = params || {};

    try {
      const result = await callNativeAPI<void>('exitHostConnection', exitParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Exit host connection failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Add co-host event listener
   * 
   * @param eventName - Event name, options: 'onCoHostRequestReceived'(received connection request)<br>'onCoHostRequestCancelled'(connection request cancelled)<br>'onCoHostRequestAccepted'(connection request accepted)<br>'onCoHostRequestRejected'(connection request rejected)<br>'onCoHostRequestTimeout'(connection request timeout)<br>'onCoHostUserJoined'(co-host user joined)<br>'onCoHostUserLeft'(co-host user left)
   * @param listener - Event callback function
   * @param liveID - Live room ID (optional, uses the passed value if provided, otherwise uses the liveID from the hook)
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addCoHostListener('onCoHostRequestReceived', (params) => {
   *   console.log('Received connection request:', params);
   * });
   * ```
   */
  const addCoHostListener = useCallback((eventName: string, listener: ILiveListener, liveIDParam?: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'CoHostStore',
      name: eventName,
      roomID: liveIDParam ?? liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * Remove co-host event listener
   * 
   * @param eventName - Event name, options: 'onCoHostRequestReceived'(received connection request)<br>'onCoHostRequestCancelled'(connection request cancelled)<br>'onCoHostRequestAccepted'(connection request accepted)<br>'onCoHostRequestRejected'(connection request rejected)<br>'onCoHostRequestTimeout'(connection request timeout)<br>'onCoHostUserJoined'(co-host user joined)<br>'onCoHostUserLeft'(co-host user left)
   * @param liveID - Live room ID (optional, uses the passed value if provided, otherwise uses the liveID from the hook)
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeCoHostListener('onCoHostRequestReceived');
   * ```
   */
  const removeCoHostListener = useCallback((eventName: string, liveIDParam?: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'CoHostStore',
      name: eventName,
      roomID: liveIDParam ?? liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    coHostStatus,            // Current co-host status
    connected,               // List of connected co-hosts
    invitees,                // List of invited co-hosts
    applicant,               // Current applicant co-host info
    candidates,              // List of candidate co-hosts available for invitation
    requestHostConnection,   // Request host connection
    cancelHostConnection,    // Cancel host connection request
    acceptHostConnection,    // Accept host connection request
    rejectHostConnection,    // Reject host connection request
    exitHostConnection,      // Exit host connection
    addCoHostListener,       // Add co-host event listener
    removeCoHostListener,    // Remove co-host event listener
  };
}

export default useCoHostState;


