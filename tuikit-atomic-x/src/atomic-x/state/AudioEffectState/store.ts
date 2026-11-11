import type { AudioChangerTypeParam, AudioReverbTypeParam } from './types';

/**
 * 音效状态
 */
interface AudioEffectState {
  isEarMonitorOpened: boolean;
  earMonitorVolume: number;
  audioChangerType: AudioChangerTypeParam;
  audioReverbType: AudioReverbTypeParam;
}

type StateChangeListener = (state: AudioEffectState) => void;

class AudioEffectStore {
  private static instance: AudioEffectStore;

  private state: AudioEffectState = {
    isEarMonitorOpened: false,
    earMonitorVolume: 0,
    audioChangerType: 'NONE',
    audioReverbType: 'NONE',
  };

  private listeners: Set<StateChangeListener> = new Set();

  private constructor() {}

  static getInstance(): AudioEffectStore {
    if (!AudioEffectStore.instance) {
      AudioEffectStore.instance = new AudioEffectStore();
    }
    return AudioEffectStore.instance;
  }

  /**
   * 获取当前音效状态快照
   */
  getState(): AudioEffectState {
    return this.state;
  }

  /**
   * 局部更新状态，并通知所有订阅者
   */
  setState(updates: Partial<AudioEffectState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };
    this.notifyListeners();
  }

  /**
   * 订阅状态变化
   * 订阅时立刻推送一次当前快照，保证后挂载组件能拿到已有数据
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[AudioEffectStore] Listener error:', error);
      }
    });
  }
}

export const audioEffectStore = AudioEffectStore.getInstance();
