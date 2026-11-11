import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
// HybridBridge keeps one subscription per key and removeListener also removes the native listener,
// so native state listeners are bound per liveID at module level and never removed on hook unmount.
import '../LiveListState';
import { liveListStore } from '../LiveListState/store';

export type NativeStateEventHandler = (event: any) => void;

export interface CurrentLiveBindingConfig {
  store: string;
  events: readonly string[];
  createHandler: (liveID: string, eventName: string) => NativeStateEventHandler;
  reset: (liveID: string) => void;
}

export interface CurrentLiveBinding {
  ensureWatchCurrentLive: () => void;
  bindEvent: (liveID: string) => void;
  getBoundLiveID: () => string | null;
}

export function createCurrentLiveBinding(
  config: CurrentLiveBindingConfig
): CurrentLiveBinding {
  const { store, events, createHandler, reset } = config;
  let boundLiveID: string | null = null;
  let stopWatchingCurrentLive: (() => void) | null = null;

  const createKey = (liveID: string, eventName: string): string => {
    const keyObject: HybridListenerKey = {
      type: 'state',
      store,
      name: eventName,
      roomID: liveID,
      listenerID: null,
    };
    return JSON.stringify(keyObject);
  };

  const getCurrentLiveID = (): string =>
    liveListStore.getState().currentLive?.liveID ?? '';

  function unbindEvent(liveID: string): void {
    events.forEach((eventName) => {
      removeListener(createKey(liveID, eventName));
    });
    if (boundLiveID === liveID) {
      boundLiveID = null;
    }
  }

  function bindEvent(liveID: string): void {
    if (!liveID || getCurrentLiveID() !== liveID) {
      return;
    }
    if (boundLiveID === liveID) {
      return;
    }
    if (boundLiveID) {
      const previousLiveID = boundLiveID;
      unbindEvent(previousLiveID);
      reset(previousLiveID);
    }
    boundLiveID = liveID;
    events.forEach((eventName) => {
      addListener(
        createKey(liveID, eventName),
        createHandler(liveID, eventName)
      );
    });
  }

  function ensureWatchCurrentLive(): void {
    if (stopWatchingCurrentLive) {
      return;
    }
    stopWatchingCurrentLive = liveListStore.subscribe((state) => {
      const newLiveID = state.currentLive?.liveID ?? '';
      if (newLiveID === '') {
        if (boundLiveID) {
          const previousLiveID = boundLiveID;
          unbindEvent(previousLiveID);
          reset(previousLiveID);
        }
      } else if (newLiveID !== boundLiveID) {
        if (boundLiveID) {
          const previousLiveID = boundLiveID;
          unbindEvent(previousLiveID);
          reset(previousLiveID);
        }
        reset(newLiveID);
        bindEvent(newLiveID);
      }
    });
  }

  return {
    ensureWatchCurrentLive,
    bindEvent,
    getBoundLiveID: () => boundLiveID,
  };
}
