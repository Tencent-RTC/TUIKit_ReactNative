/**
 * @module BaseBeautyState
 * @module_description
 * Basic Beauty Management Module
 * Core Features: Provides basic beauty effect adjustments including smoothing, whitening, and ruddiness, supporting real-time beauty parameter tuning.
 * Technical Highlights: Supports real-time beauty processing, smooth parameter adjustment, performance optimization, and other advanced technologies.
 * Business Value: Provides basic beauty capabilities for live streaming platforms, improving user image and live quality.
 * Application Scenarios: Beauty live streaming, image enhancement, beauty adjustment, live beautification, and other scenarios requiring beauty functions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  SetSmoothLevelOptions,
  SetWhitenessLevelOptions,
  SetRuddyLevelOptions,
  RealUiValues,
  BeautyType,
} from './types';
import { baseBeautyStore } from './store';

/**
 * Beauty listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Beauty state event name constants
 */
const BEAUTY_EVENTS = [
  'smoothLevel',
  'whitenessLevel',
  'ruddyLevel',
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
 * BaseBeautyState Hook
 * 
 * @example
 * ```tsx
 * import { useBaseBeautyState } from '@/src/atomic-x/state/BaseBeautyState';
 * 
 * function BeautyComponent() {
 *   const { 
 *     smoothLevel,
 *     whitenessLevel,
 *     ruddyLevel,
 *     setSmoothLevel,
 *     setWhitenessLevel 
 *   } = useBaseBeautyState('your_live_id');
 * 
 *   const handleSetSmooth = async () => {
 *     await setSmoothLevel({
 *       smoothLevel: 5,
 *       onSuccess: () => console.log('Set successfully'),
 *       onError: (error) => console.error('Set failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       <Text>Smoothing Level: {smoothLevel}</Text>
 *       <Text>Whitening Level: {whitenessLevel}</Text>
 *       <Text>Ruddiness Level: {ruddyLevel}</Text>
 *       <Button onPress={handleSetSmooth} title="Set Smoothing" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useBaseBeautyState(liveID: string) {
  // Get initial state from global store
  const initialState = baseBeautyStore.getState(liveID);

  /**
   * Smoothing level
   * @type {number}
   * @description Value range [0,9]: 0 means off, 9 means most obvious effect
   * @default Get initial value from global store
   */
  const [smoothLevel, setSmoothLevelState] = useState<number>(initialState.smoothLevel);

  /**
   * Whitening level
   * @type {number}
   * @description Value range [0,9]: 0 means off, 9 means most obvious effect
   * @default Get initial value from global store
   */
  const [whitenessLevel, setWhitenessLevelState] = useState<number>(initialState.whitenessLevel);

  /**
   * Ruddiness level
   * @type {number}
   * @description Value range [0,9]: 0 means off, 9 means most obvious effect
   * @default Get initial value from global store
   */
  const [ruddyLevel, setRuddyLevelState] = useState<number>(initialState.ruddyLevel);

  const [realUiValues, setRealUiValues] = useState<RealUiValues>(initialState.realUiValues);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = baseBeautyStore.subscribe(liveID, (state) => {
      setSmoothLevelState(state.smoothLevel);
      setWhitenessLevelState(state.whitenessLevel);
      setRuddyLevelState(state.ruddyLevel);
      // Sync realUiValues from global store
      setRealUiValues(state.realUiValues);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle beauty state change events
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

      console.log(`[BaseBeautyState] ${eventName} event received:`, JSON.stringify(data));

      // Check if data's keys match any values in BEAUTY_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          smoothLevel?: number;
          whitenessLevel?: number;
          ruddyLevel?: number;
        } = {};

        Object.keys(data).forEach((key) => {
          if (BEAUTY_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'smoothLevel') {
              // smoothLevel is number type
              const parsedData = typeof value === 'number' ? value : (Number(value) || 0);
              updates.smoothLevel = parsedData;
            } else if (key === 'whitenessLevel') {
              // whitenessLevel is number type
              const parsedData = typeof value === 'number' ? value : (Number(value) || 0);
              updates.whitenessLevel = parsedData;
            } else if (key === 'ruddyLevel') {
              // ruddyLevel is number type
              const parsedData = typeof value === 'number' ? value : (Number(value) || 0);
              updates.ruddyLevel = parsedData;
            }
          }
        });

        // Batch update global store (only update once to avoid multiple notifications)
        if (Object.keys(updates).length > 0) {
          baseBeautyStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[BaseBeautyState] ${eventName} event parse error:`, error);
      console.log(`[BaseBeautyState] ${eventName} event received (raw):`, event);
    }
  }, [liveID]);

  /**
   * Bind event listeners
   */
  useEffect(() => {
    const createListenerKeyObject = (eventName: string, listenerID?: string | null): HybridListenerKey => {
      return {
        type: 'state',
        store: 'BaseBeautyStore',
        name: eventName,
        roomID: null,
        listenerID: listenerID ?? null,
      };
    };

    // Save listener cleanup function references
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    BEAUTY_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener will automatically register Native and JS layer event listeners
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[BaseBeautyState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      BEAUTY_EVENTS.forEach((eventName) => {
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
   * Set smoothing level
   * 
   * @param params - Smoothing parameters, value range [0,9]: 0 means off, 9 means most obvious effect
   * @example
   * ```tsx
   * await setSmoothLevel({
   *   smoothLevel: 5,
   *   onSuccess: () => console.log('Set successfully'),
   *   onError: (error) => console.error('Set failed:', error)
   * });
   * ```
   */
  const setSmoothLevel = useCallback(async (params: SetSmoothLevelOptions): Promise<void> => {
    // Validate required parameters
    if (params.smoothLevel === undefined || params.smoothLevel === null) {
      const error = new Error('Missing required parameter: smoothLevel');
      params.onError?.(error);
      return;
    }

    // Validate value range
    if (params.smoothLevel < 0 || params.smoothLevel > 9) {
      const error = new Error('smoothLevel must be between 0 and 9');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...smoothParams } = params;

    try {
      const result = await callNativeAPI<void>('setSmoothLevel', smoothParams);

      if (result.success) {
        // Only trigger callback on success, state update handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Set smooth level failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Set whitening level
   * 
   * @param params - Whitening parameters, value range [0,9]: 0 means off, 9 means most obvious effect
   * @example
   * ```tsx
   * await setWhitenessLevel({
   *   whitenessLevel: 6,
   *   onSuccess: () => console.log('Set successfully'),
   *   onError: (error) => console.error('Set failed:', error)
   * });
   * ```
   */
  const setWhitenessLevel = useCallback(async (params: SetWhitenessLevelOptions): Promise<void> => {
    // Validate required parameters
    if (params.whitenessLevel === undefined) {
      const error = new Error('Missing required parameter: whitenessLevel');
      params.onError?.(error);
      return;
    }

    // Validate value range
    if (params.whitenessLevel < 0 || params.whitenessLevel > 9) {
      const error = new Error('whitenessLevel must be between 0 and 9');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...whitenessParams } = params;

    try {
      const result = await callNativeAPI<void>('setWhitenessLevel', whitenessParams);

      if (result.success) {
        // Only trigger callback on success, state update handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Set whiteness level failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Set ruddiness level
   * 
   * @param params - Ruddiness parameters, value range [0,9]: 0 means off, 9 means most obvious effect
   * @example
   * ```tsx
   * await setRuddyLevel({
   *   ruddyLevel: 4,
   *   onSuccess: () => console.log('Set successfully'),
   *   onError: (error) => console.error('Set failed:', error)
   * });
   * ```
   */
  const setRuddyLevel = useCallback(async (params: SetRuddyLevelOptions): Promise<void> => {
    // Validate required parameters
    if (params.ruddyLevel === undefined) {
      const error = new Error('Missing required parameter: ruddyLevel');
      params.onError?.(error);
      return;
    }

    // Validate value range
    if (params.ruddyLevel < 0 || params.ruddyLevel > 9) {
      const error = new Error('ruddyLevel must be between 0 and 9');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...ruddyParams } = params;

    try {
      const result = await callNativeAPI<void>('setRuddyLevel', ruddyParams);

      if (result.success) {
        // Only trigger callback on success, state update handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Set ruddy level failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Set real UI value
   * Update both component local state and global store to ensure persistence
   * 
   * @param type - Beauty type
   * @param value - Value
   * @example
   * ```tsx
   * setRealUiValue('smooth', 5);
   * ```
   */
  const setRealUiValue = useCallback((type: BeautyType, value: number): void => {
    setRealUiValues((prev) => {
      const newValues = {
        ...prev,
        [type]: value,
      };
      // Sync update to global store to ensure persistence
      baseBeautyStore.setState(liveID, { realUiValues: newValues });
      return newValues;
    });
  }, [liveID]);

  /**
   * Get real UI value
   * 
   * @param type - Beauty type
   * @returns Real UI value
   * @example
   * ```tsx
   * const value = getRealUiValue('smooth');
   * ```
   */
  const getRealUiValue = useCallback((type: BeautyType): number => {
    return realUiValues[type];
  }, [realUiValues]);

  /**
   * Reset real UI values
   * Reset both component local state and global store
   * 
   * @example
   * ```tsx
   * resetRealUiValues();
   * ```
   */
  const resetRealUiValues = useCallback((): void => {
    const resetValues = {
      whiteness: 0,
      smooth: 0,
      ruddy: 0,
    };
    setRealUiValues(resetValues);
    // Sync reset to global store
    baseBeautyStore.setState(liveID, { realUiValues: resetValues });
  }, [liveID]);

  /**
   * Add beauty event listener
   *
   * @param eventName - Event name
   * @param listener - Event callback function
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addBeautyListener('onBeautyLevelChanged', (params) => {
   *   console.log('Beauty level changed:', params);
   * });
   * ```
   */
  const addBeautyListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'BaseBeautyStore',
      name: eventName,
      roomID: null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, []);

  /**
   * Remove beauty event listener
   *
   * @param eventName - Event name
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeBeautyListener('onBeautyLevelChanged');
   * ```
   */
  const removeBeautyListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'BaseBeautyStore',
      name: eventName,
      roomID: null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, []);

  return {
    smoothLevel,         // Smoothing level state
    whitenessLevel,      // Whitening level state
    ruddyLevel,          // Ruddiness level state
    setSmoothLevel,      // Set smoothing level method
    setWhitenessLevel,   // Set whitening level method
    setRuddyLevel,       // Set ruddiness level method
    realUiValues,        // Real UI values
    setRealUiValue,      // Set real UI value method
    getRealUiValue,      // Get real UI value method
    resetRealUiValues,   // Reset real UI values method
    addBeautyListener,   // Add beauty event listener
    removeBeautyListener, // Remove beauty event listener
  };
}

export default useBaseBeautyState;

