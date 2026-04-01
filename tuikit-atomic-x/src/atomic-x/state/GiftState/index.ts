/**
 * @module GiftState
 * @module_description
 * Gift System Management Module
 * Core Features: Handles gift sending, receiving, and gift list management, supporting gift categorization, gift animations, gift statistics, and a complete gift economy system.
 * Technical Features: Supports gift animation rendering, gift effects processing, gift statistics, gift leaderboards, and other advanced features.
 * Business Value: Provides core monetization capabilities for live streaming platforms, supporting gift economy and virtual currency business models.
 * Use Cases: Gift rewards, virtual currency, gift effects, gift statistics, and other commercialization scenarios.
 */

import { useState, useEffect, useCallback } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  GiftCategoryParam,
  RefreshUsableGiftsOptions,
  SendGiftOptions,
  SetLanguageOptions,
} from './types';
import { giftStore } from './store';

/**
 * Gift listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Gift status event name constants
 */
const GIFT_EVENTS = [
  'usableGifts',
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
 * GiftState Hook
 * 
 * @example
 * ```tsx
 * import { useGiftState } from '@/src/atomic-x/state/GiftState';
 * 
 * function GiftComponent() {
 *   const { 
 *     usableGifts,
 *     refreshUsableGifts,
 *     sendGift,
 *     setLanguage 
 *   } = useGiftState('your_live_id');
 * 
 *   const handleSendGift = async () => {
 *     await sendGift({
 *       liveID: 'your_live_id',
 *       giftID: 'gift001',
 *       count: 1,
 *       onSuccess: () => console.log('Send successfully'),
 *       onError: (error) => console.error('Send failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       {usableGifts.map((category) => (
 *         <View key={category.categoryID}>
 *           <Text>{category.name}</Text>
 *           {category.giftList?.map((gift) => (
 *             <Text key={gift.giftID}>{gift.name}</Text>
 *           ))}
 *         </View>
 *       ))}
 *       <Button onPress={handleSendGift} title="Send Gift" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useGiftState(liveID: string) {
  // Get initial state from global store
  const initialState = giftStore.getState(liveID);

  /**
   * @memberof module:GiftState
   * @type {GiftCategoryParam[]}
   * @example
   * ```tsx
   * const { usableGifts } = useGiftState(liveID);
   * 
   * console.log('Usable gift categories count:', usableGifts.length);
   * usableGifts.forEach(category => {
   *   console.log('Category:', category.name);
   *   category.giftList?.forEach(gift => {
   *     console.log('Gift:', gift.name, 'Price:', gift.price);
   *   });
   * });
   * ```
   */
  const [usableGifts, setUsableGifts] = useState<GiftCategoryParam[]>(initialState.usableGifts);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = giftStore.subscribe(liveID, (state) => {
      setUsableGifts(state.usableGifts);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle gift status change events
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

      console.log(`[GiftState] ${eventName} event received:`, JSON.stringify(data));

      // Check if data's keys match any value in GIFT_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          usableGifts?: GiftCategoryParam[];
        } = {};

        Object.keys(data).forEach((key) => {
          if (GIFT_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'usableGifts') {
              // usableGifts is array type
              let parsedData: GiftCategoryParam[];
              if (Array.isArray(value)) {
                parsedData = value as GiftCategoryParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<GiftCategoryParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<GiftCategoryParam[]>(JSON.stringify(value), []);
              }
              updates.usableGifts = parsedData;
            }
          }
        });

        // Batch update global store (only update once to avoid multiple notifications)
        if (Object.keys(updates).length > 0) {
          giftStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[GiftState] ${eventName} event parse error:`, error);
      console.log(`[GiftState] ${eventName} event received (raw):`, event);
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
        store: 'GiftStore',
        name: eventName,
        roomID: liveID ?? null,
        listenerID: listenerID ?? null,
      };
    };

    // Save references to listener cleanup functions
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    GIFT_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener automatically registers event listeners for both Native side and JS layer
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[GiftState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      GIFT_EVENTS.forEach((eventName) => {
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
   * Refresh usable gifts list
   * 
   * @param params - Refresh gifts list parameters (optional)
   * @example
   * ```tsx
   * await refreshUsableGifts({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('Refresh successfully'),
   *   onError: (error) => console.error('Refresh failed:', error)
   * });
   * ```
   */
  const refreshUsableGifts = useCallback(async (params?: RefreshUsableGiftsOptions): Promise<void> => {
    const { onSuccess, onError, ...refreshParams } = params || {};

    try {
      const result = await callNativeAPI<GiftCategoryParam[]>('refreshUsableGifts', refreshParams);

      if (result.success) {
        // Only trigger callback on success, state update is handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Refresh usable gifts failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Send gift
   * 
   * @param params - Send gift parameters
   * @example
   * ```tsx
   * await sendGift({
   *   liveID: 'your_live_id',
   *   giftID: 'gift001',
   *   count: 1,
   *   receiverList: ['user1', 'user2'],
   *   onSuccess: () => console.log('Send successfully'),
   *   onError: (error) => console.error('Send failed:', error)
   * });
   * ```
   */
  const sendGift = useCallback(async (params: SendGiftOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.giftID || params.count === undefined) {
      const error = new Error('Missing required parameters: liveID, giftID or count');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...giftParams } = params;

    try {
      const result = await callNativeAPI<void>('sendGift', giftParams);

      if (result.success) {
        // Only trigger callback on success, state update is handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Send gift failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Set gift language
   * 
   * @param params - Set gift language parameters
   * @example
   * ```tsx
   * await setLanguage({
   *   liveID: 'your_live_id',
   *   language: 'zh-CN',
   *   onSuccess: () => console.log('Set successfully'),
   *   onError: (error) => console.error('Set failed:', error)
   * });
   * ```
   */
  const setLanguage = useCallback(async (params: SetLanguageOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.language) {
      const error = new Error('Missing required parameters: liveID or language');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...languageParams } = params;

    try {
      const result = await callNativeAPI<void>('setLanguage', languageParams);

      if (result.success) {
        // Only trigger callback on success, state update is handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Set language failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Add gift event listener
   * 
   * @param eventName - Event name, options: 'onReceiveGift'(received gift)
   * @param listener - Event listener function
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addGiftListener('onReceiveGift', (params) => {
   *   console.log('Received gift:', params);
   * });
   * ```
   */
  const addGiftListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'GiftStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * Remove gift event listener
   * 
   * @param eventName - Event name, options: 'onReceiveGift'(received gift)
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeGiftListener('onReceiveGift');
   * ```
   */
  const removeGiftListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'GiftStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    usableGifts,         // Usable gifts list
    refreshUsableGifts,  // Refresh usable gifts list
    sendGift,            // Send gift
    setLanguage,         // Set gift language
    addGiftListener,     // Add gift event listener
    removeGiftListener,  // Remove gift event listener
  };
}

export default useGiftState;

