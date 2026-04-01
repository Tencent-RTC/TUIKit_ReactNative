/**
 * @module LiveSummaryState
 * @module_description
 * Statistics Information State Management Module
 * Core Features: Collects and displays key data during live streaming, including viewer count, like count, gift count, and other real-time statistics.
 * Technical Features: Supports real-time data collection, data aggregation, statistical analysis, and provides a complete live data view.
 * Business Value: Provides data analysis capabilities for live streaming platforms, supporting live streaming effect evaluation and optimization.
 * Use Cases: Live data display, anchor analysis, traffic statistics, business data reports, and other data analysis scenarios.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type { SummaryData } from './types';
import { liveSummaryStore } from './store';

/**
 * Statistics listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Statistics state event name constants
 */
const LIVE_SUMMARY_EVENTS = [
  'summaryData',
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
 * LiveSummaryState Hook
 * 
 * @example
 * ```tsx
 * import { useLiveSummaryState } from '@/src/atomic-x/state/LiveSummaryState';
 * 
 * function SummaryComponent() {
 *   const { summaryData } = useLiveSummaryState('your_live_id');
 * 
 *   return (
 *     <View>
 *       {summaryData && (
 *         <>
 *           <Text>Viewer count: {summaryData.viewerCount}</Text>
 *           <Text>Like count: {summaryData.likeCount}</Text>
 *           <Text>Gift count: {summaryData.giftCount}</Text>
 *         </>
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useLiveSummaryState(liveID: string) {
  // Get initial state from global store
  const initialState = liveSummaryStore.getState(liveID);

  // Live room statistics information - using initial value from global store
  const [summaryData, setSummaryData] = useState<SummaryData | undefined>(initialState.summaryData);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = liveSummaryStore.subscribe(liveID, (state) => {
      setSummaryData(state.summaryData);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle statistics state change events
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


      // Check if data key matches any value in LIVE_SUMMARY_EVENTS
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          summaryData?: SummaryData;
        } = {};

        Object.keys(data).forEach((key) => {
          if (LIVE_SUMMARY_EVENTS.includes(key)) {
            const value = data[key];

            // Update corresponding reactive data based on different keys
            if (key === 'summaryData') {
              // summaryData is an object type
              let parsedData: SummaryData;
              if (value && typeof value === 'object' && !Array.isArray(value)) {
                parsedData = value as SummaryData;
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<SummaryData>(value, {} as SummaryData);
              } else {
                parsedData = safeJsonParse<SummaryData>(JSON.stringify(value), {} as SummaryData);
              }
              updates.summaryData = parsedData;
            }
          }
        });

        // Batch update global store (only update once to avoid multiple notifications)
        if (Object.keys(updates).length > 0) {
          liveSummaryStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[LiveSummaryState] ${eventName} event parse error:`, error);
      console.log(`[LiveSummaryState] ${eventName} event received (raw):`, event);
    }
  }, [liveID]);

  /**
   * Bind event listeners
   */
  useEffect(() => {
    const createListenerKeyObject = (eventName: string, listenerID?: string | null): HybridListenerKey => {
      return {
        type: 'state',
        store: 'LiveSummaryStore',
        name: eventName,
        roomID: liveID ?? null,
        listenerID: listenerID ?? null,
      };
    };
    // Save references to listener cleanup functions
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    LIVE_SUMMARY_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener will automatically register event listeners on both Native and JS layers
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[LiveSummaryState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      LIVE_SUMMARY_EVENTS.forEach((eventName) => {
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
   * Add statistics event listener
   *
   * @param eventName - Event name
   * @param listener - Event callback function
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * addLiveSummaryListener('onSummaryDataChanged', (params) => {
   *   console.log('Statistics data changed:', params);
   * });
   * ```
   */
  const addLiveSummaryListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'LiveSummaryStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * Remove statistics event listener
   *
   * @param eventName - Event name
   * @param listenerID - Listener ID (optional)
   * @example
   * ```tsx
   * removeLiveSummaryListener('onSummaryDataChanged');
   * ```
   */
  const removeLiveSummaryListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'LiveSummaryStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    summaryData,     // Live room statistics information
    addLiveSummaryListener,   // Add statistics event listener
    removeLiveSummaryListener, // Remove statistics event listener
  };
}

export default useLiveSummaryState;

