/**
 * @module CoGuestState
 * @module_description
 * Live Co-Guest Management Interface
 * Core Features: Handles co-guest interaction between audience and streamers, managing co-guest applications, invitations, acceptance, rejection, and complete co-guest processes.
 * Technical Highlights: Based on audio-video technology, supports real-time co-guest state synchronization, adaptive audio-video quality, network condition monitoring, and other advanced features.
 * Business Value: Provides core capabilities for audience participation and interaction on live streaming platforms, enhancing user engagement and live entertainment.
 * Application Scenarios: Audience co-guest, interactive Q&A, online karaoke, game streaming, and other scenarios requiring audience participation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { callNativeAPI } from '../../utils';
import { addListener, removeListener } from '../../bridge/HybridBridge';
import type { HybridListenerKey } from '../../bridge/HybridBridge';
import type {
  LiveUserInfoParam,
  SeatUserInfoParam,
  ApplyForSeatOptions,
  CancelApplicationOptions,
  AcceptApplicationOptions,
  RejectApplicationOptions,
  InviteToSeatOptions,
  CancelInvitationOptions,
  AcceptInvitationOptions,
  RejectInvitationOptions,
  DisconnectOptions,
} from './types';
import { coGuestStore } from './store';

/**
 * Co-guest listener function type
 */
type ILiveListener = (params?: unknown) => void;

/**
 * Co-guest state event name constants
 */
const CO_GUEST_EVENTS = [
  'connected',
  'invitees',
  'applicants',
  'candidates',
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

/**
 * CoGuestState Hook
 * 
 * @example
 * ```tsx
 * import { useCoGuestState } from '@/src/atomic-x/state/CoGuestState';
 * 
 * function CoGuestComponent() {
 *   const { 
 *     connected, 
 *     invitees, 
 *     applicants,
 *     applyForSeat,
 *     acceptApplication 
 *   } = useCoGuestState('your_live_id');
 * 
 *   const handleApplyForSeat = async () => {
 *     await applyForSeat({
 *       seatIndex: 2,
 *       timeout: 10,
 *       onSuccess: () => console.log('Application successful'),
 *       onError: (error) => console.error('Application failed:', error)
 *     });
 *   };
 * 
 *   return (
 *     <View>
 *       <Text>Connected Guests: {connected.length}</Text>
 *       <Text>Applicants: {applicants.length}</Text>
 *       <Button onPress={handleApplyForSeat} title="Apply for Co-guest" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useCoGuestState(liveID: string) {
  // Get initial state from global store
  const initialState = coGuestStore.getState(liveID);

  /**
   * @memberof module:CoGuestState
   * @type {SeatUserInfoParam[]}
   * @example
   * ```tsx
   * const { connected } = useCoGuestState(liveID);
   * 
   * console.log('Connected guests count:', connected.length);
   * connected.forEach(guest => {
   *   console.log('Guest:', guest.userName, 'Seat:', guest.seatIndex);
   * });
   * ```
   */
  const [connected, setConnected] = useState<SeatUserInfoParam[]>(initialState.connected);

  /**
   * @memberof module:CoGuestState
   * @type {LiveUserInfoParam[]}
   * @example
   * ```tsx
   * const { invitees } = useCoGuestState(liveID);
   * 
   * console.log('Invited users count:', invitees.length);
   * invitees.forEach(user => {
   *   console.log('Invited user:', user.nickname, user.userID);
   * });
   * ```
   */
  const [invitees, setInvitees] = useState<LiveUserInfoParam[]>(initialState.invitees);

  /**
   * @memberof module:CoGuestState
   * @type {LiveUserInfoParam[]}
   * @example
   * ```tsx
   * const { applicants } = useCoGuestState(liveID);
   * 
   * console.log('Applicants count:', applicants.length);
   * applicants.forEach(user => {
   *   console.log('Applicant:', user.nickname, user.userID);
   * });
   * ```
   */
  const [applicants, setApplicants] = useState<LiveUserInfoParam[]>(initialState.applicants);

  /**
   * @memberof module:CoGuestState
   * @type {LiveUserInfoParam[]}
   * @example
   * ```tsx
   * const { candidates } = useCoGuestState(liveID);
   * 
   * console.log('Candidates count:', candidates.length);
   * candidates.forEach(user => {
   *   console.log('Candidate:', user.nickname, user.userID);
   * });
   * ```
   */
  const [candidates, setCandidates] = useState<LiveUserInfoParam[]>(initialState.candidates);

  // Subscribe to global store state changes
  useEffect(() => {
    if (!liveID) {
      return;
    }

    // Subscribe to state changes
    const unsubscribe = coGuestStore.subscribe(liveID, (state) => {
      setConnected(state.connected);
      setInvitees(state.invitees);
      setApplicants(state.applicants);
      setCandidates(state.candidates);
    });

    // Clean up subscription
    return unsubscribe;
  }, [liveID]);

  // Event listener references
  type WritableMap = Record<string, unknown>;

  /**
   * Handle co-guest state change events
   * Update global store, store will automatically notify all subscribers
   */
  const handleEvent = useCallback((eventName: string) => (event: WritableMap) => {
    try {
      // 如果 event 已经是对象，直接使用；否则尝试解析
      const data = event && typeof event === 'object' && !Array.isArray(event)
        ? event
        : typeof event === 'string'
          ? JSON.parse(event)
          : event;

      console.log(`[CoGuestState] ${eventName} event received:`, JSON.stringify(data));

      // 检查 data 的 key 是否匹配 CO_GUEST_EVENTS 中的某个值
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const updates: {
          connected?: SeatUserInfoParam[];
          invitees?: LiveUserInfoParam[];
          applicants?: LiveUserInfoParam[];
          candidates?: LiveUserInfoParam[];
        } = {};

        Object.keys(data).forEach((key) => {
          if (CO_GUEST_EVENTS.includes(key)) {
            const value = data[key];

            // 根据不同的 key 更新对应的响应式数据
            if (key === 'connected') {
              // connected 是数组类型
              let parsedData: SeatUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as SeatUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<SeatUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<SeatUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.connected = parsedData;
            } else if (key === 'invitees') {
              // invitees 是数组类型
              let parsedData: LiveUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.invitees = parsedData;
            } else if (key === 'applicants') {
              // applicants 是数组类型
              let parsedData: LiveUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.applicants = parsedData;
            } else if (key === 'candidates') {
              // candidates 是数组类型
              let parsedData: LiveUserInfoParam[];
              if (Array.isArray(value)) {
                parsedData = value as LiveUserInfoParam[];
              } else if (typeof value === 'string') {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(value, []);
              } else {
                parsedData = safeJsonParse<LiveUserInfoParam[]>(JSON.stringify(value), []);
              }
              updates.candidates = parsedData;
            }
          }
        });

        // 批量更新全局 store（只更新一次，避免多次通知）
        if (Object.keys(updates).length > 0) {
          coGuestStore.setState(liveID, updates);
        }
      }
    } catch (error) {
      console.error(`[CoGuestState] ${eventName} event parse error:`, error);
      console.log(`[CoGuestState] ${eventName} event received (raw):`, event);
    }
  }, [liveID]);

  /**
   * 绑定事件监听
   */
  useEffect(() => {
    if (!liveID) {
      return;
    }

    const createListenerKeyObject = (eventName: string, listenerID?: string | null): HybridListenerKey => {
      return {
        type: 'state',
        store: 'CoGuestStore',
        name: eventName,
        roomID: liveID ?? null,
        listenerID: listenerID ?? null,
      };
    };

    // 保存监听器清理函数的引用
    const cleanupFunctions: Array<{ remove: () => void }> = [];

    CO_GUEST_EVENTS.forEach((eventName) => {
      const keyObject = createListenerKeyObject(eventName);
      const key = JSON.stringify(keyObject);
      console.log(key);
      // addListener 会自动注册 Native 端和 JS 层的事件监听器
      const subscription = addListener(key, handleEvent(eventName));
      if (subscription) {
        cleanupFunctions.push(subscription);
      }

      console.log(`[CoGuestState] Added listener for: ${eventName}, eventName=${key}`);
    });

    return () => {
      CO_GUEST_EVENTS.forEach((eventName) => {
        const keyObject = createListenerKeyObject(eventName);
        const key = JSON.stringify(keyObject);
        removeListener(key);
      });
      // 同时清理 JS 层的订阅
      cleanupFunctions.forEach((cleanup) => {
        cleanup.remove();
      });
    };
  }, [handleEvent, liveID]);

  /**
   * 申请连麦座位
   * 
   * @param params - 申请连麦座位参数
   * @example
   * ```tsx
   * await applyForSeat({
   *   liveID: 'your_live_id',
   *   seatIndex: 2,
   *   timeout: 10,
   *   extension: 'extra info',
   *   onSuccess: () => console.log('申请成功'),
   *   onError: (error) => console.error('申请失败:', error)
   * });
   * ```
   */
  const applyForSeat = useCallback(async (params: ApplyForSeatOptions): Promise<void> => {
    const { onSuccess, onError, ...applyParams } = params;

    try {
      const result = await callNativeAPI<void>('applyForSeat', applyParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Apply for seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 取消申请
   * 
   * @param params - 取消申请参数
   * @example
   * ```tsx
   * await cancelApplication({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('取消申请成功'),
   *   onError: (error) => console.error('取消申请失败:', error)
   * });
   * ```
   */
  const cancelApplication = useCallback(async (params: CancelApplicationOptions): Promise<void> => {
    const { onSuccess, onError, ...cancelParams } = params;

    try {
      const result = await callNativeAPI<void>('cancelApplication', cancelParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Cancel application failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 接受申请
   * 
   * @param params - 接受申请参数
   * @example
   * ```tsx
   * await acceptApplication({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   seatIndex: 0,
   *   onSuccess: () => console.log('接受申请成功'),
   *   onError: (error) => console.error('接受申请失败:', error)
   * });
   * ```
   */
  const acceptApplication = useCallback(async (params: AcceptApplicationOptions): Promise<void> => {
    // 验证必填参数
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...acceptParams } = params;

    try {
      const result = await callNativeAPI<void>('acceptApplication', acceptParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Accept application failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 拒绝申请
   * 
   * @param params - 拒绝申请参数
   * @example
   * ```tsx
   * await rejectApplication({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   onSuccess: () => console.log('拒绝申请成功'),
   *   onError: (error) => console.error('拒绝申请失败:', error)
   * });
   * ```
   */
  const rejectApplication = useCallback(async (params: RejectApplicationOptions): Promise<void> => {
    // 验证必填参数
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...rejectParams } = params;

    try {
      const result = await callNativeAPI<void>('rejectApplication', rejectParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Reject application failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 邀请上麦
   * 
   * @param params - 邀请上麦参数
   * @example
   * ```tsx
   * await inviteToSeat({
   *   liveID: 'your_live_id',
   *   userID: 'user123',
   *   seatIndex: 2,
   *   timeout: 10,
   *   extension: 'extra info',
   *   onSuccess: () => console.log('邀请成功'),
   *   onError: (error) => console.error('邀请失败:', error)
   * });
   * ```
   */
  const inviteToSeat = useCallback(async (params: InviteToSeatOptions): Promise<void> => {
    // 验证必填参数
    if (!params.userID) {
      const error = new Error('Missing required parameter: userID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...inviteParams } = params;

    try {
      const result = await callNativeAPI<void>('inviteToSeat', inviteParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Invite to seat failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 取消邀请
   * 
   * @param params - 取消邀请参数
   * @example
   * ```tsx
   * await cancelInvitation({
   *   liveID: 'your_live_id',
   *   inviteeID: 'user123',
   *   onSuccess: () => console.log('取消邀请成功'),
   *   onError: (error) => console.error('取消邀请失败:', error)
   * });
   * ```
   */
  const cancelInvitation = useCallback(async (params: CancelInvitationOptions): Promise<void> => {
    // 验证必填参数
    if (!params.inviteeID) {
      const error = new Error('Missing required parameter: inviteeID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...cancelParams } = params;

    try {
      const result = await callNativeAPI<void>('cancelInvitation', cancelParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Cancel invitation failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 接受邀请
   * 
   * @param params - 接受邀请参数
   * @example
   * ```tsx
   * await acceptInvitation({
   *   liveID: 'your_live_id',
   *   inviterID: 'user123',
   *   onSuccess: () => console.log('接受邀请成功'),
   *   onError: (error) => console.error('接受邀请失败:', error)
   * });
   * ```
   */
  const acceptInvitation = useCallback(async (params: AcceptInvitationOptions): Promise<void> => {
    // 验证必填参数
    if (!params.inviterID) {
      const error = new Error('Missing required parameter: inviterID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...acceptParams } = params;

    try {
      const result = await callNativeAPI<void>('acceptInvitation', acceptParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Accept invitation failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 拒绝邀请
   * 
   * @param params - 拒绝邀请参数
   * @example
   * ```tsx
   * await rejectInvitation({
   *   liveID: 'your_live_id',
   *   inviterID: 'user123',
   *   onSuccess: () => console.log('拒绝邀请成功'),
   *   onError: (error) => console.error('拒绝邀请失败:', error)
   * });
   * ```
   */
  const rejectInvitation = useCallback(async (params: RejectInvitationOptions): Promise<void> => {
    // 验证必填参数
    if (!params.inviterID) {
      const error = new Error('Missing required parameter: inviterID');
      params.onError?.(error);
      return;
    }

    const { onSuccess, onError, ...rejectParams } = params;

    try {
      const result = await callNativeAPI<void>('rejectInvitation', rejectParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Reject invitation failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 断开连麦连接
   * 
   * @param params - 断开连接参数（可选）
   * @example
   * ```tsx
   * await disconnect({
   *   liveID: 'your_live_id',
   *   onSuccess: () => console.log('断开连接成功'),
   *   onError: (error) => console.error('断开连接失败:', error)
   * });
   * ```
   */
  const disconnect = useCallback(async (params?: DisconnectOptions): Promise<void> => {
    const { onSuccess, onError, ...disconnectParams } = params || {};

    try {
      const result = await callNativeAPI<void>('disconnect', disconnectParams);

      if (result.success) {
        onSuccess?.();
      } else {
        const error = new Error(result.error || 'Disconnect failed');
        onError?.(error);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    }
  }, []);

  /**
   * 添加连麦嘉宾侧事件监听
   * 
   * @param eventName - 事件名称，可选值: 'onHostInvitationReceived'(收到主播邀请)<br>'onHostInvitationCancelled'(主播取消邀请)<br>'onGuestApplicationResponded'(嘉宾申请响应)<br>'onGuestApplicationNoResponse'(嘉宾申请无响应)<br>'onKickedOffSeat'(被踢下座位)
   * @param listener - 事件回调函数
   * @param liveID - 直播间ID（可选，如果传入则使用传入的，否则使用 hook 中的 liveID）
   * @param listenerID - 监听器ID（可选）
   * @example
   * ```tsx
   * addCoGuestGuestListener('onHostInvitationReceived', (params) => {
   *   console.log('收到主播邀请:', params);
   * });
   * ```
   */
  const addCoGuestGuestListener = useCallback((eventName: string, listener: ILiveListener, liveIDParam?: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'CoGuestStore',
      name: eventName,
      roomID: liveIDParam ?? liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * 移除连麦嘉宾侧事件监听
   * 
   * @param eventName - 事件名称，可选值: 'onHostInvitationReceived'(收到主播邀请)<br>'onHostInvitationCancelled'(主播取消邀请)<br>'onGuestApplicationResponded'(嘉宾申请响应)<br>'onGuestApplicationNoResponse'(嘉宾申请无响应)<br>'onKickedOffSeat'(被踢下座位)
   * @param liveID - 直播间ID（可选，如果传入则使用传入的，否则使用 hook 中的 liveID）
   * @param listenerID - 监听器ID（可选）
   * @example
   * ```tsx
   * removeCoGuestGuestListener('onHostInvitationReceived');
   * ```
   */
  const removeCoGuestGuestListener = useCallback((eventName: string, liveIDParam?: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'CoGuestStore',
      name: eventName,
      roomID: liveIDParam ?? liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  /**
   * 添加连麦主播侧事件监听
   * 
   * @param eventName - 事件名称，可选值: 'onGuestApplicationReceived'(收到嘉宾申请)<br>'onGuestApplicationCancelled'(嘉宾取消申请)<br>'onGuestApplicationProcessedByOtherHost'(嘉宾申请被其他主播处理)<br>'onHostInvitationResponded'(主播邀请得到回应)<br>'onHostInvitationNoResponse'(主播邀请无响应)
   * @param listener - 事件回调函数
   * @param listenerID - 监听器ID（可选）
   * @example
   * ```tsx
   * addCoGuestHostListener('onGuestApplicationReceived', (params) => {
   *   console.log('收到嘉宾申请:', params);
   * });
   * ```
   */
  const addCoGuestHostListener = useCallback((eventName: string, listener: ILiveListener, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'CoGuestStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    addListener(JSON.stringify(createListenerKeyObject), listener);
  }, [liveID]);

  /**
   * 移除连麦主播侧事件监听
   * 
   * @param eventName - 事件名称，可选值: 'onGuestApplicationReceived'(收到嘉宾申请)<br>'onGuestApplicationCancelled'(嘉宾取消申请)<br>'onGuestApplicationProcessedByOtherHost'(嘉宾申请被其他主播处理)<br>'onHostInvitationResponded'(主播邀请得到回应)<br>'onHostInvitationNoResponse'(主播邀请无响应)
   * @param listenerID - 监听器ID（可选）
   * @example
   * ```tsx
   * removeCoGuestHostListener('onGuestApplicationReceived');
   * ```
   */
  const removeCoGuestHostListener = useCallback((eventName: string, listenerID?: string): void => {
    const createListenerKeyObject: HybridListenerKey = {
      type: 'state',
      store: 'CoGuestStore',
      name: eventName,
      roomID: liveID ?? null,
      listenerID: listenerID ?? null,
    };
    removeListener(JSON.stringify(createListenerKeyObject));
  }, [liveID]);

  return {
    connected,                    // 已连接的连麦嘉宾列表
    invitees,                     // 被邀请上麦的用户列表
    applicants,                   // 申请上麦的用户列表
    candidates,                   // 可邀请上麦的候选用户列表
    applyForSeat,                 // 申请连麦座位
    cancelApplication,             // 取消申请
    acceptApplication,             // 接受申请
    rejectApplication,            // 拒绝申请
    inviteToSeat,                 // 邀请上麦
    cancelInvitation,             // 取消邀请
    acceptInvitation,             // 接受邀请
    rejectInvitation,             // 拒绝邀请
    disconnect,                   // 断开连麦连接
    addCoGuestGuestListener,      // 添加嘉宾侧事件监听
    removeCoGuestGuestListener,   // 移除嘉宾侧事件监听
    addCoGuestHostListener,       // 添加主播侧事件监听
    removeCoGuestHostListener,    // 移除主播侧事件监听
  };
}

export default useCoGuestState;


