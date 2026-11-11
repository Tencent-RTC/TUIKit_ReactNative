/**
 * @module BaseBeautyState
 * @module_description
 * Basic Beauty Management Module
 * Core Features: Provides basic beauty effect adjustments including smoothing, whitening, and ruddiness, supporting real-time beauty parameter tuning.
 * Technical Highlights: Supports real-time beauty processing, smooth parameter adjustment, performance optimization, and other advanced technologies.
 * Business Value: Provides basic beauty capabilities for live streaming platforms, improving user image and live quality.
 * Application Scenarios: Beauty live streaming, image enhancement, beauty adjustment, live beautification, and other scenarios requiring beauty functions.
 */

import { useState, useEffect, useCallback } from 'react';
import { callNativeAPI, createStateError } from '../../utils';
import { addListener } from '../../bridge/HybridBridge';
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
 * Beauty state event name constants
 */
const BEAUTY_EVENTS = [
  'smoothLevel',
  'whitenessLevel',
  'ruddyLevel',
];


/**
 * Handle beauty state change events (module-level, shared by all hook instances)
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
        const updates: {
          smoothLevel?: number;
          whitenessLevel?: number;
          ruddyLevel?: number;
        } = {};

        Object.keys(data).forEach((key) => {
          if (BEAUTY_EVENTS.includes(key)) {
            const value = data[key];
            if (key === 'smoothLevel') {
              updates.smoothLevel = typeof value === 'number' ? value : (Number(value) || 0);
            } else if (key === 'whitenessLevel') {
              updates.whitenessLevel = typeof value === 'number' ? value : (Number(value) || 0);
            } else if (key === 'ruddyLevel') {
              updates.ruddyLevel = typeof value === 'number' ? value : (Number(value) || 0);
            }
          }
        });

        if (Object.keys(updates).length > 0) {
          baseBeautyStore.setState(updates);
        }
      }
    } catch (error) {
      console.error(`[BaseBeautyState] ${eventName} event parse error:`, error);
    }
  };
}

/**
 * Register Native event listeners at module load time (once, never removed)
 */
BEAUTY_EVENTS.forEach((eventName) => {
  const keyObject: HybridListenerKey = {
    type: 'state',
    store: 'BaseBeautyStore',
    name: eventName,
    roomID: null,
    listenerID: null,
  };
  const key = JSON.stringify(keyObject);
  addListener(key, handleNativeEvent(eventName));
});

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
 *   } = useBaseBeautyState();
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
function useBaseBeauty(listen: boolean) {
  // Get initial state from global store
  const initialState = baseBeautyStore.getState();

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
    if (!listen) return undefined;
    // Subscribe to state changes
    const unsubscribe = baseBeautyStore.subscribe((state) => {
      setSmoothLevelState(state.smoothLevel);
      setWhitenessLevelState(state.whitenessLevel);
      setRuddyLevelState(state.ruddyLevel);
      // Sync realUiValues from global store
      setRealUiValues(state.realUiValues);
    });

    return unsubscribe;
  }, [listen]);

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
        const error = createStateError(result, 'Set smooth level failed');
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
        const error = createStateError(result, 'Set whiteness level failed');
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
        const error = createStateError(result, 'Set ruddy level failed');
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
      baseBeautyStore.setState({ realUiValues: newValues });
      return newValues;
    });
  }, []);

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
    baseBeautyStore.setState({ realUiValues: resetValues });
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
  };
}

export function useBaseBeautyState() {
  return useBaseBeauty(true);
}

export function useBaseBeautyActions() {
  const { setSmoothLevel, setWhitenessLevel, setRuddyLevel } = useBaseBeauty(false);
  return { setSmoothLevel, setWhitenessLevel, setRuddyLevel };
}

export function getBaseBeautyState() {
  const state = baseBeautyStore.getState();
  return {
    smoothLevel: state.smoothLevel,
    whitenessLevel: state.whitenessLevel,
    ruddyLevel: state.ruddyLevel,
  };
}

export default useBaseBeautyState;

