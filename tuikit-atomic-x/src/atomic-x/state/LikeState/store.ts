/**
 * LikeState Store
 * 单例模式全局状态存储，解决状态隔离问题
 */

/**
 * 单个直播间的点赞状态
 */
interface LikeState {
  totalLikeCount: number;
}

/**
 * 状态变化监听器
 */
type StateChangeListener = (state: LikeState) => void;

/**
 * 全局状态存储
 * 按 liveID 索引，每个直播间有独立的状态
 */
class LikeStore {
  private static instance: LikeStore;
  private states: Map<string, LikeState> = new Map();
  private listeners: Map<string, Set<StateChangeListener>> = new Map();

  private constructor() {}

  static getInstance(): LikeStore {
    if (!LikeStore.instance) {
      LikeStore.instance = new LikeStore();
    }
    return LikeStore.instance;
  }

  /**
   * 获取指定直播间的状态
   */
  getState(liveID: string): LikeState {
    if (!this.states.has(liveID)) {
      this.states.set(liveID, {
        totalLikeCount: 0,
      });
    }
    return this.states.get(liveID)!;
  }

  /**
   * 更新指定直播间的状态
   */
  setState(liveID: string, updates: Partial<LikeState>): void {
    const currentState = this.getState(liveID);
    const newState: LikeState = {
      ...currentState,
      ...updates,
    };
    this.states.set(liveID, newState);

    // 通知所有订阅者
    this.notifyListeners(liveID, newState);
  }

  /**
   * 订阅状态变化
   */
  subscribe(liveID: string, listener: StateChangeListener): () => void {
    if (!this.listeners.has(liveID)) {
      this.listeners.set(liveID, new Set());
    }
    this.listeners.get(liveID)!.add(listener);

    // 立即通知当前状态
    listener(this.getState(liveID));

    // 返回取消订阅函数
    return () => {
      const liveListeners = this.listeners.get(liveID);
      if (liveListeners) {
        liveListeners.delete(listener);
        if (liveListeners.size === 0) {
          this.listeners.delete(liveID);
        }
      }
    };
  }

  /**
   * 通知所有订阅者
   */
  private notifyListeners(liveID: string, state: LikeState): void {
    const liveListeners = this.listeners.get(liveID);
    if (liveListeners) {
      liveListeners.forEach((listener) => {
        try {
          listener(state);
        } catch (error) {
          console.error('[LikeStore] Listener error:', error);
        }
      });
    }
  }

  resetState(liveID: string): void {
    this.states.delete(liveID);
    this.notifyListeners(liveID, this.getState(liveID));
  }

  /**
   * 清理指定直播间的状态
   */
  clearState(liveID: string): void {
    this.states.delete(liveID);
    this.listeners.delete(liveID);
  }

  /**
   * 清理所有状态
   */
  clearAll(): void {
    this.states.clear();
    this.listeners.clear();
  }
}

export const likeStore = LikeStore.getInstance();

