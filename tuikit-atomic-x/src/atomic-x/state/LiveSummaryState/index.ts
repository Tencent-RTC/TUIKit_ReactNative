/**
 * @module LiveSummaryState
 * @module_description
 * Statistics Information State Management Module
 * Core Features: Collects and displays key data during live streaming, including viewer count, like count, gift count, and other real-time statistics.
 * Technical Features: Supports real-time data collection, data aggregation, statistical analysis, and provides a complete live data view.
 * Business Value: Provides data analysis capabilities for live streaming platforms, supporting live streaming effect evaluation and optimization.
 * Use Cases: Live data display, anchor analysis, traffic statistics, business data reports, and other data analysis scenarios.
 */

import { useState, useEffect } from 'react';
import type { SummaryData } from './types';
import { liveSummaryStore } from './store';
import { createCurrentLiveBinding } from '../internal/currentLiveWatcher';

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

type WritableMap = Record<string, unknown>;

function createNativeEventHandler(liveID: string, eventName: string) {
  return (event: WritableMap) => {
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
      console.error(`[LiveSummaryState] ${eventName} event parse error:`, error, event);
    }
  };
}

const currentLiveBinding = createCurrentLiveBinding({
  store: 'LiveSummaryStore',
  events: LIVE_SUMMARY_EVENTS,
  createHandler: createNativeEventHandler,
  reset: (liveID) => liveSummaryStore.resetState(liveID),
});

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
  const initialState = liveSummaryStore.getState(liveID);

  const [summaryData, setSummaryData] = useState<SummaryData | undefined>(initialState.summaryData);

  useEffect(() => {
    if (!liveID) {
      return;
    }

    const unsubscribe = liveSummaryStore.subscribe(liveID, (state) => {
      setSummaryData(state.summaryData);
    });

    return unsubscribe;
  }, [liveID]);

  useEffect(() => {
    currentLiveBinding.ensureWatchCurrentLive();
    currentLiveBinding.bindEvent(liveID);
  }, [liveID]);

  return {
    summaryData,     // Live room statistics information
  };
}

export default useLiveSummaryState;

