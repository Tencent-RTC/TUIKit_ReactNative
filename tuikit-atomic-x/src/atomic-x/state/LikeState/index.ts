/**
 * @module LikeState
 * @module_description
 * Like Interaction Management Module
 * Core Features: Handles like functionality in live rooms, supporting like sending, like statistics, like event listening, and other interactive features.
 * Technical Features: Supports high-concurrency like processing, real-time like statistics, like animation effects, like leaderboards, and other advanced features.
 * Business Value: Provides basic interaction capabilities for live streaming platforms, enhancing user engagement and live atmosphere.
 * Use Cases: Like interactions, popularity statistics, interactive effects, user participation, and other basic interaction scenarios.
 */

import { useState, useEffect, useCallback } from 'react';
import { callNativeAPI, createStateError } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
    SendLikeOptions,
} from './types';
import { likeStore } from './store';
import { createCurrentLiveBinding } from '../internal/currentLiveWatcher';

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
                    totalLikeCount?: number;
                } = {};

                Object.keys(data).forEach((key) => {
                    if (LIKE_EVENTS.includes(key)) {
                        const value = data[key];

                        if (key === 'totalLikeCount') {
                            const parsedData = typeof value === 'number' ? value : (Number(value) || 0);
                            updates.totalLikeCount = parsedData;
                        }
                    }
                });

                if (Object.keys(updates).length > 0) {
                    likeStore.setState(liveID, updates);
                }
            }
        } catch (error) {
            console.error(`[LikeState] ${eventName} event parse error:`, error, event);
        }
    };
}

const currentLiveBinding = createCurrentLiveBinding({
    store: 'LikeStore',
    events: LIKE_EVENTS,
    createHandler: createNativeEventHandler,
    reset: (liveID) => likeStore.resetState(liveID),
});

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

    useEffect(() => {
        currentLiveBinding.ensureWatchCurrentLive();
        currentLiveBinding.bindEvent(liveID);
    }, [liveID]);

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
                const error = createStateError(result, 'Send like failed');
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

