/**
 * LiveListState Store
 * 全局直播列表与当前直播信息的单例存储
 * 解决多个组件分别调用 useLiveListState 时状态不共享的问题
 */

import type { LiveInfoParam } from './types';

interface LiveListState {
    liveList: LiveInfoParam[];
    liveListCursor: string;
    currentLive: LiveInfoParam | null;
}

type StateChangeListener = (state: LiveListState) => void;

class LiveListStore {
    private static instance: LiveListStore;

    private state: LiveListState = {
        liveList: [],
        liveListCursor: '',
        currentLive: null,
    };

    private listeners: Set<StateChangeListener> = new Set();

    private constructor() { }

    static getInstance(): LiveListStore {
        if (!LiveListStore.instance) {
            LiveListStore.instance = new LiveListStore();
        }
        return LiveListStore.instance;
    }

    /**
     * 获取当前直播列表状态快照
     */
    getState(): LiveListState {
        return this.state;
    }

    /**
     * 局部更新状态，并通知所有订阅者
     */
    setState(updates: Partial<LiveListState>): void {
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
                console.error('[LiveListStore] Listener error:', error);
            }
        });
    }
}

export const liveListStore = LiveListStore.getInstance();


