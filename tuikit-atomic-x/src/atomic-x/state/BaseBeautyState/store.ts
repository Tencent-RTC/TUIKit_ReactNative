/**
 * BaseBeautyState Store
 * 全局美颜状态的单例存储（Native 端是全局单例，不按房间隔离）
 */

/**
 * 真实 UI 值
 */
interface RealUiValues {
  whiteness: number;
  smooth: number;
  ruddy: number;
}

/**
 * 美颜状态
 */
interface BaseBeautyState {
  smoothLevel: number;
  whitenessLevel: number;
  ruddyLevel: number;
  realUiValues: RealUiValues;
}

type StateChangeListener = (state: BaseBeautyState) => void;

class BaseBeautyStore {
  private static instance: BaseBeautyStore;

  private state: BaseBeautyState = {
    smoothLevel: 0,
    whitenessLevel: 0,
    ruddyLevel: 0,
    realUiValues: {
      whiteness: 0,
      smooth: 0,
      ruddy: 0,
    },
  };

  private listeners: Set<StateChangeListener> = new Set();

  private constructor() {}

  static getInstance(): BaseBeautyStore {
    if (!BaseBeautyStore.instance) {
      BaseBeautyStore.instance = new BaseBeautyStore();
    }
    return BaseBeautyStore.instance;
  }

  /**
   * 获取当前美颜状态快照
   */
  getState(): BaseBeautyState {
    return this.state;
  }

  /**
   * 局部更新状态，并通知所有订阅者
   */
  setState(updates: Partial<BaseBeautyState>): void {
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
        console.error('[BaseBeautyStore] Listener error:', error);
      }
    });
  }
}

export const baseBeautyStore = BaseBeautyStore.getInstance();
