/**
 * @module BarrageState
 * @module_description
 * Barrage Management Module
 * Core Features: Handles text messages, custom messages, and other barrage functionalities in live rooms, supporting barrage sending and message state synchronization.
 * Technical Highlights: Supports high-concurrency message processing, real-time message synchronization, message filtering, emoji support, and other advanced features.
 * Business Value: Provides core interactive capabilities for live streaming platforms, enhancing user engagement and live atmosphere.
 * Application Scenarios: Barrage interaction, message management, emoji, chatroom, and other social interaction scenarios.
 */

import { useState, useEffect, useCallback } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  BarrageParam,
  SendTextMessageOptions,
  SendCustomMessageOptions,
  AppendLocalTipOptions,
} from './types';
import { barrageStore } from './store';

/**
 * Barrage listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Barrage state event name constants
 */
const BARRAGE_EVENTS = [
  'messageList',
  'allowSendMessage',
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
 * BarrageState Hook
 * 
 * @example
 * ```tsx
 * import { useBarrageState } from '@/src/atomic-x/state/BarrageState';
 * 
 * function BarrageComponent() {
 *   const { 
 *     messageList, 
 *     allowSendMessage,
 *     sendTextMessage,
 *     appendLocalTip 
 *   } = useBarrageState('your_live_id');
 * 
 *   const handleSendMessage = async () => {
 *     await sendTextMessage({
 *       liveID: 'your_live_id',
 *       text: 'Hello World',
 *       onSuccess: () => console.log('Sent successfully'),
 *       onError: (error) => console.error('Send failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       {messageList.map((msg, index) => (
 *         <Text key={index}>{msg.text}</Text>
 *       ))}
 *       <Button 
 *         onPress={handleSendMessage} 
 *         title="Send Message" 
 *         disabled={!allowSendMessage}
 *       />
 *     </View>
 *   );
 * }
 * ```
 */
export function useBarrageState(liveID: string) {
  // Get initial state from global store
  const initialState = barrageStore.getState(liveID);

  /**
   * Current room's barrage message list
   * @type {BarrageParam[]}
   * @description Stores all barrage messages in the live room, including text messages, custom messages, and other barrage data types
   * @default Get initial value from global store
   */
  const [messageList, setMessageList] = useState<BarrageParam[]>(initialState.messageList);

  /**
   * Whether sending messages is allowed
   * @type {boolean}
   * @description Controls whether the user has permission to send barrage messages, true for allowed, false for prohibited
   * @default Get initial value from global store
   */
  const [allowSendMessage, setAllowSendMessage] = useState<boolean>(initialState.allowSendMessage);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = barrageStore.subscribe(liveID, (state) => {
      setMessageList(state.messageList);
      setAllowSendMessage(state.allowSendMessage);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle barrage state change events
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

      console.log(`[BarrageState] ${eventName} event received:`, JSON.stringify(data));

      // Check if data's keys match any values in BARRAGE_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          messageList?: BarrageParam[];
          allowSendMessage?: boolean;
        } = {};

        Object.keys(data).forEach((key) => {
          if (BARRAGE_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'messageList') {
              // messageList is array type
              let parsedData: BarrageParam[];
              if (Array.isArray(value)) {
                parsedData = value as BarrageParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<BarrageParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<BarrageParam[]>(JSON.stringify(value), []);
              }
              updates.messageList = parsedData;
            } else if (key === 'allowSendMessage') {
              const parsedData = typeof value === 'boolean' ? value : Boolean(value);
              updates.allowSendMessage = parsedData;
            }
          }
        });

        // Batch update global store (only update once to avoid multiple notifications)
        if (Object.keys(updates).length > 0) {
          barrageStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[BarrageState] ${eventName} event parse error:`, error);
      console.log(`[BarrageState] ${eventName} event received (raw):`, event);
    }
  }, [liveID]);

  /**
   * Bind event listeners
   */
  useEffect(() => {
    const createListenerKeyObject = (eventName: string, listenerID?: string | null): HybridListenerKey => {
      return {
        type: 'state',
        store: 'BarrageStore',
        name: eventName,
        roomID: liveID ?? null,
        listenerID: listenerID ?? null,
      };
    };
    // Save listener cleanup function references
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    BARRAGE_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener will automatically register Native and JS layer event listeners
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[BarrageState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      BARRAGE_EVENTS.forEach((eventName) => {
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
   * Send text type barrage
   * 
   * @param params - Send text barrage parameters
   * @example
   * ```tsx
   * await sendTextMessage({
   *   liveID: 'your_live_id',
   *   text: 'Hello World',
   *   onSuccess: () => console.log('Sent successfully'),
   *   onError: (error) => console.error('Send failed:', error)
   * });
   * ```
   */
  const sendTextMessage = useCallback(async (params: SendTextMessageOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.text) {
      const error = new Error('Missing required parameters: liveID or text');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...messageParams } = params;

    try {
      const result = await callNativeAPI<void>('sendTextMessage', messageParams);

      if (result.success) {
        // Only trigger callback on success, state update handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Send text message failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Send custom type barrage
   * 
   * @param params - Send custom type barrage parameters
   * @example
   * ```tsx
   * await sendCustomMessage({
   *   liveID: 'your_live_id',
   *   businessID: 'livekit',
   *   data: JSON.stringify('my custom message'),
   *   onSuccess: () => console.log('Sent successfully'),
   *   onError: (error) => console.error('Send failed:', error)
   * });
   * ```
   */
  const sendCustomMessage = useCallback(async (params: SendCustomMessageOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.businessID || !params.data) {
      const error = new Error('Missing required parameters: liveID, businessID or data');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...customParams } = params;

    try {
      const result = await callNativeAPI<void>('sendCustomMessage', customParams);

      if (result.success) {
        // Only trigger callback on success, state update handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Send custom message failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Add local tip message
   * 
   * @param params - Add local tip message parameters
   * @example
   * ```tsx
   * await appendLocalTip({
   *   liveID: 'your_live_id',
   *   message: { text: 'Hello World' },
   *   onSuccess: () => console.log('Added successfully'),
   *   onError: (error) => console.error('Add failed:', error)
   * });
   * ```
   */
  const appendLocalTip = useCallback(async (params: AppendLocalTipOptions): Promise<void> => {
    // Validate required parameters
    if (!params.liveID || !params.message) {
      const error = new Error('Missing required parameters: liveID or message');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...tipParams } = params;

    try {
      // Call appendLocalTip through Native API
      const result = await callNativeAPI<void>('appendLocalTip', tipParams);

      if (result.success) {
        // Only trigger callback on success, state update handled by event listener
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Append local tip failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * Add barrage event listener
   *
   * @param eventName - Event name
   * @param listener - Event callback function
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addBarrageListener('onMessageReceived', (params) => {
   *   console.log('Message received:', params);
   * });
   * ```
   */
  const addBarrageListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'BarrageStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * Remove barrage event listener
   *
   * @param eventName - Event name
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeBarrageListener('onMessageReceived');
   * ```
   */
  const removeBarrageListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'BarrageStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    messageList,          // Current room's barrage message list
    allowSendMessage,     // Whether sending messages is allowed
    sendTextMessage,      // Send text message method
    sendCustomMessage,    // Send custom message method
    appendLocalTip,       // Add local tip message method
    addBarrageListener,   // Add barrage event listener
    removeBarrageListener, // Remove barrage event listener
  };
}

export default useBarrageState;

