/**
 * @module LiveSeatState
 * @module_description
 * Live Seat Management Module
 * Core Features: Implements seat control in multi-person co-host scenarios, supporting complex seat state management and audio/video device control.
 * Technical Features: Based on audio/video technology, supports multi-stream audio/video management, providing advanced features such as seat locking, device control, and permission management.
 * Business Value: Provides core technical support for multi-person interactive live streaming, supporting rich interactive scenarios such as PK, co-hosting, multi-player games, etc.
 * Use Cases: Multi-person co-hosting, anchor PK, interactive games, online education, conference live streaming, and other scenarios requiring multi-person audio/video interaction.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  SeatInfo,
  LiveCanvasParams,
  TakeSeatOptions,
  LeaveSeatOptions,
  MuteMicrophoneOptions,
  UnmuteMicrophoneOptions,
  KickUserOutOfSeatOptions,
  MoveUserToSeatOptions,
  LockSeatOptions,
  UnlockSeatOptions,
  OpenRemoteCameraOptions,
  CloseRemoteCameraOptions,
  OpenRemoteMicrophoneOptions,
  CloseRemoteMicrophoneOptions,
} from './types';
import { liveSeatStore } from './store';

/**
 * Seat listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Seat state event name constants
 */
const LIVE_SEAT_EVENTS = [
  'seatList',
  'canvas',
  'speakingUsers',
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

const DEVICE_CONTROL_POLICY_STRING_MAP: Record<string, number> = {
    'UNLOCK_ONLY': 1,
};

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
 * LiveSeatState Hook
 * 
 * @example
 * ```tsx
 * import { useLiveSeatState } from '@/src/atomic-x/state/LiveSeatState';
 * 
 * function SeatComponent() {
 *   const { 
 *     seatList, 
 *     canvas, 
 *     speakingUsers,
 *     takeSeat,
 *     leaveSeat 
 *   } = useLiveSeatState('your_live_id');
 * 
 *   const handleTakeSeat = async () => {
 *     await takeSeat({
 *       liveID: 'your_live_id',
 *       seatIndex: 1,
 *       onSuccess: () => console.log('Take seat successfully'),
 *       onError: (error) => console.error('Take seat failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       {seatList.map((seat) => (
 *         <View key={seat.index}>
 *           <Text>Seat {seat.index}</Text>
 *           {seat.userInfo && <Text>User: {seat.userInfo.nickname}</Text>}
 *         </View>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 */
export function useLiveSeatState(liveID: string) {
  // Get initial state from global store
  const initialState = liveSeatStore.getState(liveID);

  /**
   * @memberof module:LiveSeatState
   * @type {SeatInfo[]}
   * @example
   * ```tsx
   * const { seatList } = useLiveSeatState(liveID);
   * 
   * // Display all seat information
   * seatList.forEach(seat => {
   *   if (seat.userId) {
   *     console.log(`Seat ${seat.seatIndex}: ${seat.userName}`);
   *     console.log('Microphone:', seat.isAudioMuted ? 'Closed' : 'Open');
   *   } else {
   *     console.log(`Seat ${seat.seatIndex}: Available`);
   *   }
   * });
   * ```
   */
  const [seatList, setSeatList] = useState<SeatInfo[]>(initialState.seatList);

  /**
   * @memberof module:LiveSeatState
   * @type {LiveCanvasParams | null}
   * @example
   * ```tsx
   * const { canvas } = useLiveSeatState(liveID);
   * 
   * if (canvas) {
   *   console.log('Canvas mode:', canvas.mode);
   *   console.log('Background image:', canvas.backgroundUrl);
   *   console.log('Video stream count:', canvas.videoStreamList?.length);
   * }
   * ```
   */
  const [canvas, setCanvas] = useState<LiveCanvasParams | null>(initialState.canvas);

  /**
   * @memberof module:LiveSeatState
   * @type {Map<string, number> | null}
   * @example
   * ```tsx
   * const { speakingUsers } = useLiveSeatState(liveID);
   * 
   * // Check if user is speaking
   * if (speakingUsers?.has(userID)) {
   *   const volume = speakingUsers.get(userID);
   *   console.log(`User ${userID} is speaking, volume: ${volume}`);
   * }
   * 
   * // Display all speaking users
   * speakingUsers?.forEach((volume, userID) => {
   *   console.log(`${userID}: ${volume}`);
   * });
   * ```
   */
  const [speakingUsers, setSpeakingUsers] = useState<Map<string, number> | null>(initialState.speakingUsers);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = liveSeatStore.subscribe(liveID, (state) => {
      setSeatList(state.seatList);
      setCanvas(state.canvas);
      setSpeakingUsers(state.speakingUsers);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle seat state change events
   * Update global store, which will automatically notify all subscribers
   */
  const handleEvent = useCallback((eventName: string) => (event: WritableMap) => {
    try {
      // If event is already an object, use it directly; otherwise try to parse
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;


      // Check if data key matches any value in LIVE_SEAT_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          seatList?: SeatInfo[];
          canvas?: LiveCanvasParams | null;
          speakingUsers?: Map<string, number> | null;
        } = {};

        Object.keys(data).forEach((key) => {
          if (LIVE_SEAT_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'seatList') {
              // seatList is an array type
              let parsedData: SeatInfo[];
              if (Array.isArray(value)) {
                parsedData = value as SeatInfo[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<SeatInfo[]>(value, []);
              } else {
                parsedData = safeJsonParse<SeatInfo[]>(JSON.stringify(value), []);
              }
              updates.seatList = parsedData;
            } else if (key === 'canvas') {
              // canvas can be an object or null
              let parsedData: LiveCanvasParams | null;
              if (value === null || value === undefined) {
                parsedData = null;
              } else if (typeof value === 'object') {
                parsedData = value as LiveCanvasParams;
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveCanvasParams | null>(value, null);
              } else {
                parsedData = safeJsonParse<LiveCanvasParams | null>(JSON.stringify(value), null);
              }
              updates.canvas = parsedData;
            } else if (key === 'speakingUsers') {
              // speakingUsers requires special parsing to Map
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
              updates.speakingUsers = parsedData;
            }
          }
        });

        // Batch update global store (only update once to avoid multiple notifications)
        if (Object.keys(updates).length > 0) {
          liveSeatStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[LiveSeatState] ${eventName} event parse error:`, error);
      console.log(`[LiveSeatState] ${eventName} event received (raw):`, event);
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
        store: 'LiveSeatStore',
        name: eventName,
        roomID: liveID ?? null,
        listenerID: listenerID ?? null,
      };
    };

    // Save references to listener cleanup functions
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    LIVE_SEAT_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener will automatically register event listeners on both Native and JS layers
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[LiveSeatState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      LIVE_SEAT_EVENTS.forEach((eventName) => {
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
   * User takes seat
   * 
   * @param params - Take seat parameters
   * @example
   * ```tsx
   * await takeSeat({
   *   liveID: 'your_live_id',
   *   seatIndex: 1,
   *   onSuccess: () => console.log('Take seat successfully'),
   *   onError: (error) => console.error('Take seat failed:', error)
   * });
   * ```
   */
  const takeSeat = useCallback(async (params: TakeSeatOptions): Promise<void> => {
    // Validate required parameters
    if (params.seatIndex === undefined) {
      const error = new Error('Missing required parameter: seatIndex');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...seatParams } = params;

    try {
      const result = await callNativeAPI<void>('takeSeat', seatParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Take seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * User leaves seat
   * 
   * @param params - Leave seat parameters
   * @example
   * ```tsx
   * await leaveSeat({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('Leave seat successfully'),
   *   onError: (error) => console.error('Leave seat failed:', error)
   * });
   * ```
   */
  const leaveSeat = useCallback(async (params: LeaveSeatOptions): Promise<void> => {
    const { onSuccess, onError, ...leaveParams } = params;

    try {
      const result = await callNativeAPI<void>('leaveSeat', leaveParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Leave seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Mute microphone
   * 
   * @param params - Mute parameters
   * @example
   * ```tsx
   * await muteMicrophone({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('Mute microphone successfully'),
   *   onError: (error) => console.error('Mute microphone failed:', error)
   * });
   * ```
   */
  const muteMicrophone = useCallback(async (params: MuteMicrophoneOptions): Promise<void> => {
    const { onSuccess, onError, ...muteParams } = params;

    try {
      const result = await callNativeAPI<void>('muteMicrophone', muteParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Mute microphone failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Unmute microphone
   * 
   * @param params - Unmute parameters
   * @example
   * ```tsx
   * await unmuteMicrophone({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('Unmute microphone successfully'),
   *   onError: (error) => console.error('Unmute microphone failed:', error)
   * });
   * ```
   */
  const unmuteMicrophone = useCallback(async (params: UnmuteMicrophoneOptions): Promise<void> => {
    const { onSuccess, onError, ...unmuteParams } = params;

    try {
      const result = await callNativeAPI<void>('unmuteMicrophone', unmuteParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Unmute microphone failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Kick user out of seat
   * 
   * @param params - Kick parameters
   * @example
   * ```tsx
   * await kickUserOutOfSeat({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('Kick user successfully'),
   *   onError: (error) => console.error('Kick user failed:', error)
   * });
   * ```
   */
  const kickUserOutOfSeat = useCallback(async (params: KickUserOutOfSeatOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...kickParams } = params;

    try {
      const result = await callNativeAPI<void>('kickUserOutOfSeat', kickParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Kick user out of seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Move user to specified seat
   * 
   * @param params - Move parameters
   * @example
   * ```tsx
   * await moveUserToSeat({
   *   liveID: 'your_live_id',
   *   fromSeatIndex: 1,
   *   toSeatIndex: 3,
   *   onSuccess: () => console.log('Move user successfully'),
   *   onError: (error) => console.error('Move user failed:', error)
   * });
   * ```
   */
  const moveUserToSeat = useCallback(async (params: MoveUserToSeatOptions): Promise<void> => {
    // Validate required parameters
    if (params.fromSeatIndex === undefined || params.toSeatIndex === undefined) {
      const error = new Error('Missing required parameters: fromSeatIndex or toSeatIndex');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...moveParams } = params;

    try {
      const result = await callNativeAPI<void>('moveUserToSeat', moveParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Move user to seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Lock seat
   * 
   * @param params - Lock parameters
   * @example
   * ```tsx
   * await lockSeat({
   *   liveID: 'your_live_id',
   *   seatIndex: 2,
   *   onSuccess: () => console.log('Lock seat successfully'),
   *   onError: (error) => console.error('Lock seat failed:', error)
   * });
   * ```
   */
  const lockSeat = useCallback(async (params: LockSeatOptions): Promise<void> => {
    // Validate required parameters
    if (params.seatIndex === undefined) {
      const error = new Error('Missing required parameter: seatIndex');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...lockParams } = params;

    try {
      const result = await callNativeAPI<void>('lockSeat', lockParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Lock seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Unlock seat
   * 
   * @param params - Unlock parameters
   * @example
   * ```tsx
   * await unlockSeat({
   *   liveID: 'your_live_id',
   *   seatIndex: 2,
   *   onSuccess: () => console.log('Unlock seat successfully'),
   *   onError: (error) => console.error('Unlock seat failed:', error)
   * });
   * ```
   */
  const unlockSeat = useCallback(async (params: UnlockSeatOptions): Promise<void> => {
    // Validate required parameters
    if (params.seatIndex === undefined) {
      const error = new Error('Missing required parameter: seatIndex');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...unlockParams } = params;

    try {
      const result = await callNativeAPI<void>('unlockSeat', unlockParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Unlock seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Open remote camera
   * 
   * @param params - Open camera parameters
   * @example
   * ```tsx
   * await openRemoteCamera({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('Open remote camera successfully'),
   *   onError: (error) => console.error('Open remote camera failed:', error)
   * });
   * ```
   */
  const openRemoteCamera = useCallback(async (params: OpenRemoteCameraOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, policy, ...restParams } = params;
    const cameraParams: Record<string, unknown> = {
      ...restParams,
      ...(policy && typeof policy === 'string' && { policy: DEVICE_CONTROL_POLICY_STRING_MAP[policy] ?? 1 }),
    };

    try {
      const result = await callNativeAPI<void>('openRemoteCamera', cameraParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Open remote camera failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Close remote camera
   * 
   * @param params - Close camera parameters
   * @example
   * ```tsx
   * await closeRemoteCamera({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('Close remote camera successfully'),
   *   onError: (error) => console.error('Close remote camera failed:', error)
   * });
   * ```
   */
  const closeRemoteCamera = useCallback(async (params: CloseRemoteCameraOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...cameraParams } = params;

    try {
      const result = await callNativeAPI<void>('closeRemoteCamera', cameraParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Close remote camera failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Open remote microphone
   * 
   * @param params - Open microphone parameters
   * @example
   * ```tsx
   * await openRemoteMicrophone({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   policy: 'UNLOCK_ONLY',
   *   onSuccess: () => console.log('Open remote microphone successfully'),
   *   onError: (error) => console.error('Open remote microphone failed:', error)
   * });
   * ```
   */
  const openRemoteMicrophone = useCallback(async (params: OpenRemoteMicrophoneOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, policy, ...restParams } = params;
    const micParams: Record<string, unknown> = {
      ...restParams,
      ...(policy && { policy: DEVICE_CONTROL_POLICY_STRING_MAP[policy] ?? 1 }),
    };

    try {
      const result = await callNativeAPI<void>('openRemoteMicrophone', micParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Open remote microphone failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Close remote microphone
   * 
   * @param params - Close microphone parameters
   * @example
   * ```tsx
   * await closeRemoteMicrophone({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('Close remote microphone successfully'),
   *   onError: (error) => console.error('Close remote microphone failed:', error)
   * });
   * ```
   */
  const closeRemoteMicrophone = useCallback(async (params: CloseRemoteMicrophoneOptions): Promise<void> => {
    // Validate required parameters
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...micParams } = params;

    try {
      const result = await callNativeAPI<void>('closeRemoteMicrophone', micParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Close remote microphone failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Add seat event listener
   * 
   * @param eventName - Event name, options: 'onLocalCameraOpenedByAdmin' (local camera opened by admin)<br>'onLocalCameraClosedByAdmin' (local camera closed by admin)<br>'onLocalMicrophoneOpenedByAdmin' (local microphone opened by admin)<br>'onLocalMicrophoneClosedByAdmin' (local microphone closed by admin)
   * @param listener - Event handler function
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addLiveSeatEventListener('onLocalCameraOpenedByAdmin', (params) => {
   *   console.log('Local camera opened by admin:', params);
   * });
   * ```
   */
  const addLiveSeatEventListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'LiveSeatStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * Remove seat event listener
   * 
   * @param eventName - Event name, options: 'onLocalCameraOpenedByAdmin' (local camera opened by admin)<br>'onLocalCameraClosedByAdmin' (local camera closed by admin)<br>'onLocalMicrophoneOpenedByAdmin' (local microphone opened by admin)<br>'onLocalMicrophoneClosedByAdmin' (local microphone closed by admin)
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeLiveSeatEventListener('onLocalCameraOpenedByAdmin');
   * ```
   */
  const removeLiveSeatEventListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'LiveSeatStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    seatList,                    // Seat list
    canvas,                      // Canvas information
    speakingUsers,               // Speaking users list
    takeSeat,                    // User takes seat
    leaveSeat,                   // User leaves seat
    muteMicrophone,              // Mute microphone
    unmuteMicrophone,            // Unmute microphone
    kickUserOutOfSeat,           // Kick user out of seat
    moveUserToSeat,              // Move user to specified seat
    lockSeat,                    // Lock seat
    unlockSeat,                  // Unlock seat
    openRemoteCamera,            // Open remote camera
    closeRemoteCamera,           // Close remote camera
    openRemoteMicrophone,        // Open remote microphone
    closeRemoteMicrophone,       // Close remote microphone
    addLiveSeatEventListener,    // Add seat event listener
    removeLiveSeatEventListener,  // Remove seat event listener
  };
}

export default useLiveSeatState;


