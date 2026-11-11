/**
 * State 模块统一导出
 */

// 导出 LoginState
export { useLoginState, default as useLoginStateDefault } from './LoginState';
export * from './LoginState/types';

// 导出 LiveListState
export { useLiveListState, default as useLiveListStateDefault } from './LiveListState';
export { LiveInfoModifyFlag } from './LiveListState/types';
// 导出类型，但排除内部类型 ILiveListener 以避免冲突
export type {
  TakeSeatModeType,
  LiveUserInfoParam,
  LiveInfoParam,
  FetchLiveListOptions,
  CreateLiveOptions,
  JoinLiveOptions,
  LeaveLiveOptions,
  EndLiveOptions,
  UpdateLiveInfoOptions,
  LiveInfoModifyFlagType,
  CallExperimentalAPIOptions,
} from './LiveListState/types';

// 导出 LiveAudienceState
export { useLiveAudienceState, default as useLiveAudienceStateDefault } from './LiveAudienceState';
export type {
  FetchAudienceListOptions,
  SetAdministratorOptions,
  RevokeAdministratorOptions,
  KickUserOutOfRoomOptions,
  DisableSendMessageOptions,
} from './LiveAudienceState/types';

// 导出 GiftState
export { useGiftState, default as useGiftStateDefault } from './GiftState';
export type {
  GiftParam,
  GiftCategoryParam,
  RefreshUsableGiftsOptions,
  SendGiftOptions,
  SetLanguageOptions,
} from './GiftState/types';

// 导出 CoHostState
export { useCoHostState, default as useCoHostStateDefault } from './CoHostState';
export type {
  RequestHostConnectionOptions,
  CancelHostConnectionOptions,
  AcceptHostConnectionOptions,
  RejectHostConnectionOptions,
  ExitHostConnectionOptions,
} from './CoHostState/types';
export { CoHostStatus, CoHostLayoutTemplate } from './CoHostState/types';

// 导出 CoGuestState
export { useCoGuestState, default as useCoGuestStateDefault } from './CoGuestState';
export type {
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
} from './CoGuestState/types';
export { GuestApplicationNoResponseReason } from './CoGuestState/types';

// 导出 LiveSeatState
export { useLiveSeatState, default as useLiveSeatStateDefault } from './LiveSeatState';
export type {
  SeatInfo,
  LiveCanvasParams,
  TakeSeatOptions,
  LeaveSeatOptions,
  MuteMicrophoneOptions,
  UnmuteMicrophoneOptions,
  KickUserOutOfSeatOptions,
  MoveUserToSeatOptions,
  LockSeatOptions,
  UnlockSeatOptions,
  OpenRemoteCameraOptions,
  CloseRemoteCameraOptions,
  OpenRemoteMicrophoneOptions,
  CloseRemoteMicrophoneOptions,
} from './LiveSeatState/types';

// 导出 DeviceState
export {
  useDeviceState,
  useDeviceActions,
  getDeviceState,
  default as useDeviceStateDefault,
} from './DeviceState';
// 导出类型，但排除 VolumeOptions 以避免与 AudioEffectState 冲突
export type {
  DeviceStatusCodeType,
  DeviceStatusType,
  DeviceErrorCodeType,
  DeviceErrorType,
  AudioOutputType,
  OpenLocalMicrophoneOptions,
  SetAudioRouteOptions,
  OpenLocalCameraOptions,
  StartCameraTestOptions,
  SwitchCameraOptions,
  UpdateVideoQualityOptions,
  SwitchMirrorOptions,
  NetworkInfo,
  LocalVideoQuality,
} from './DeviceState/types';
export { DeviceStatusCode, DeviceStatus, DeviceErrorCode, DeviceErrorEnum, MirrorType } from './DeviceState/types';

// 导出 BarrageState
export { useBarrageState, default as useBarrageStateDefault } from './BarrageState';
export type {
  BarrageParam,
  SendTextMessageOptions,
  SendCustomMessageOptions,
  AppendLocalTipOptions,
} from './BarrageState/types';

// 导出 LikeState
export { useLikeState, default as useLikeStateDefault } from './LikeState';
export type {
  SendLikeOptions,
} from './LikeState/types';

// 导出 BaseBeautyState
export {
  useBaseBeautyState,
  useBaseBeautyActions,
  getBaseBeautyState,
  default as useBaseBeautyStateDefault,
} from './BaseBeautyState';
export type {
  SetSmoothLevelOptions,
  SetWhitenessLevelOptions,
  SetRuddyLevelOptions,
  RealUiValues,
  BeautyType,
} from './BaseBeautyState/types';

// 导出 AudioEffectState
export {
  useAudioEffectState,
  useAudioEffectActions,
  default as useAudioEffectStateDefault,
} from './AudioEffectState';
export type {
  AudioChangerTypeParam,
  AudioReverbTypeParam,
  SetAudioChangerTypeOptions,
  SetAudioReverbTypeOptions,
  SetVoiceEarMonitorEnableOptions,
  VolumeOptions,
} from './AudioEffectState/types';

// 导出 LiveSummaryState
export { useLiveSummaryState, default as useLiveSummaryStateDefault } from './LiveSummaryState';
export type {
  SummaryData,
} from './LiveSummaryState/types';

// 导出 BattleState  
export { useBattleState, default as useBattleStateDefault } from './BattleState';
export type {
  BattleInfoParam,
  RequestBattleOptions,
  CancelBattleRequestOptions,
  AcceptBattleOptions,
  RejectBattleOptions,
  ExitBattleOptions,
} from './BattleState/types';

