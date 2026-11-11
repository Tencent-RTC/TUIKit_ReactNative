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
import { callNativeAPI, createStateError } from '../../utils';
import type {
  BarrageParam,
  SendTextMessageOptions,
  SendCustomMessageOptions,
  AppendLocalTipOptions,
} from './types';
import { barrageStore } from './store';
import { createCurrentLiveBinding } from '../internal/currentLiveWatcher';

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

type WritableMap = Record<string, unknown>;

function createNativeEventHandler(liveID: string, eventName: string) {
  return (event: WritableMap) => {
    try {
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          messageList?: BarrageParam[];
          allowSendMessage?: boolean;
        } = {};

        Object.keys(data).forEach((key) => {
          if (BARRAGE_EVENTS.includes(key)) {
            const value = data[key];

            if (key === 'messageList') {
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

        if (Object.keys(updates).length > 0) {
          barrageStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[BarrageState] ${eventName} event parse error:`, error, event);
    }
  };
}

const currentLiveBinding = createCurrentLiveBinding({
  store: 'BarrageStore',
  events: BARRAGE_EVENTS,
  createHandler: createNativeEventHandler,
  reset: (liveID) => barrageStore.resetState(liveID),
});

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

  useEffect(() => {
    currentLiveBinding.ensureWatchCurrentLive();
    currentLiveBinding.bindEvent(liveID);
  }, [liveID]);

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
        const error = createStateError(result, 'Send text message failed');
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
        const error = createStateError(result, 'Send custom message failed');
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
        const error = createStateError(result, 'Append local tip failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  return {
    messageList,          // Current room's barrage message list
    allowSendMessage,     // Whether sending messages is allowed
    sendTextMessage,      // Send text message method
    sendCustomMessage,    // Send custom message method
    appendLocalTip,       // Add local tip message method
  };
}

export default useBarrageState;

