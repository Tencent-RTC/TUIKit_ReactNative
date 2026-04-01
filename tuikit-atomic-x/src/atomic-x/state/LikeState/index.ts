/**
 * @module LikeState
 * @module_description
 * Like Interaction Management Module
 * Core Features: Handles like functionality in live rooms, supporting like sending, like statistics, like event listening, and other interactive features.
 * Technical Features: Supports high-concurrency like processing, real-time like statistics, like animation effects, like leaderboards, and other advanced features.
 * Business Value: Provides basic interaction capabilities for live streaming platforms, enhancing user engagement and live atmosphere.
 * Use Cases: Like interactions, popularity statistics, interactive effects, user participation, and other basic interaction scenarios.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
    SendLikeOptions,
} from './types';
import { likeStore } from './store';

/**
 * Like listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Like status event name constants
 */
const LIKE_EVENTS = [
    'totalLikeCount',
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
 * LikeState Hook
 * 
 * @example
 * ```tsx
 * import { useLikeState } from '@/src/atomic-x/state/LikeState';
 * 
 * function LikeComponent() {
 *   const { 
 *     totalLikeCount,
 *     sendLike,
 *     addLikeListener 
 *   } = useLikeState('your_live_id');
 * 
 *   const handleSendLike = async () => {
 *     await sendLike({
 *       liveID: 'your_live_id',
 *       count: 1,
 *       onSuccess: () => console.log('Like sent successfully'),
 *       onError: (error) => console.error('Send like failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       <Text>Total likes: {totalLikeCount}</Text>
 *       <Button onPress={handleSendLike} title="Like" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useLikeState(liveID: string) {
    // Get initial state from global store
    const initialState = likeStore.getState(liveID);

    /**
     * @memberof module:LikeState
     * @type {number}
     * @example
     * ```tsx
     * const { totalLikeCount } = useLikeState(liveID);
     * 
     * console.log('Total like count:', totalLikeCount);
     * ```
     */
    const [totalLikeCount, setTotalLikeCount] = useState<number>(initialState.totalLikeCount);

    // Subscribe to global store state changes
    useEffect(() => {
        if (!liveID) {
            return;
        }

        // Subscribe to state changes
        const unsubscribe = likeStore.subscribe(liveID, (state) => {
            setTotalLikeCount(state.totalLikeCount);
        });

        // Clean up subscription
        return unsubscribe;
    }, [liveID]);

    // Event listener references
    type WritableMap = Record<string, unknown>;

    /**
     * Handle like status change events
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

            console.log(`[LikeState] ${eventName} event received:`, JSON.stringify(data));

            // Check if data's keys match any value in LIKE_EVENTS
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const updates: {
                    totalLikeCount?: number;
                } = {};

                Object.keys(data).forEach((key) => {
                    if (LIKE_EVENTS.includes(key)) {
                        const value = data[key];

                        // Update corresponding reactive data based on different keys
                        if (key === 'totalLikeCount') {
                            // totalLikeCount is number type
                            const parsedData = typeof value === 'number' ? value : (Number(value) || 0);
                            updates.totalLikeCount = parsedData;
                        }
                    }
                });

                // Batch update global store (only update once to avoid multiple notifications)
                if (Object.keys(updates).length > 0) {
                    likeStore.setState(liveID, updates);
                }
            }
        } catch (error) {
            console.error(`[LikeState] ${eventName} event parse error:`, error);
            console.log(`[LikeState] ${eventName} event received (raw):`, event);
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
                store: 'LikeStore',
                name: eventName,
                roomID: liveID ?? null,
                listenerID: listenerID ?? null,
            };
        };

        // Save references to listener cleanup functions
        const cleanupFunctions: Array<{ remove: () => void }> = [];

        LIKE_EVENTS.forEach((eventName) => {
            const keyObject = createListenerKeyObject(eventName);
            const key = JSON.stringify(keyObject);
            console.log(key);
            // addListener automatically registers event listeners for both Native side and JS layer
            const subscription = addListener(key, handleEvent(eventName));
            if (subscription) {
                cleanupFunctions.push(subscription);
            }

            console.log(`[LikeState] Added listener for: ${eventName}, eventName=${key}`);
        });
        return () => {
            LIKE_EVENTS.forEach((eventName) => {
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
     * Send like
     * 
     * @param params - Like parameters
   * @example
   * ```tsx
   * await sendLike({
   *   liveID: 'your_live_id',
   *   count: 1,
   *   onSuccess: () => console.log('Like sent successfully'),
   *   onError: (error) => console.error('Send like failed:', error)
   * });
   * ```
     */
    const sendLike = useCallback(async (params: SendLikeOptions): Promise<void> => {
        const { onSuccess, onError, ...likeParams } = params;

        try {
            const result = await callNativeAPI<void>('sendLike', likeParams);

            if (result.success) {
                // Only trigger callback on success, state update is handled by event listener
                onSuccess?.();
            } else {
                const error = new Error(result.error || 'Send like failed');
                onError?.(error);
            }
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            onError?.(err);
        }
    }, []);

    /**
     * Add like event listener
     * 
     * @param eventName - Event name, options: 'onReceiveLikesMessage'(received like message)
     * @param listener - Event callback function
     * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addLikeListener('onReceiveLikesMessage', (params) => {
   *   console.log('Received like message:', params);
   * });
   * ```
     */
    const addLikeListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
        const createListenerKeyObject: HybridListenerKey = {
            type: 'state',
            store: 'LikeStore',
            name: eventName,
            roomID: liveID ?? null,
            listenerID: listenerID ?? null,
        };
        addListener(JSON.stringify(createListenerKeyObject), listener);
    }, [liveID]);

    /**
     * Remove like event listener
     * 
     * @param eventName - Event name, options: 'onReceiveLikesMessage'(received like message)
     * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeLikeListener('onReceiveLikesMessage');
   * ```
     */
    const removeLikeListener = useCallback((eventName: string, listenerID?: string): void => {
        const createListenerKeyObject: HybridListenerKey = {
            type: 'state',
            store: 'LikeStore',
            name: eventName,
            roomID: liveID ?? null,
            listenerID: listenerID ?? null,
        };
        removeListener(JSON.stringify(createListenerKeyObject));
    }, [liveID]);

    return {
        totalLikeCount,       // Total like count
        sendLike,             // Send like
        addLikeListener,      // Add like event listener
        removeLikeListener,   // Remove like event listener
    };
}

export default useLikeState;

