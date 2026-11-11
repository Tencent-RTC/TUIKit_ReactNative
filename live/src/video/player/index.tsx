import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  DeviceStatus,
  DeviceStatusCode,
  DrawerHost,
  GiftPlayer,
  LiveStreamView,
  Toast,
  isAppPermissionDenied,
  isPermissionPrompting,
  getBaseBeautyState,
  getLocalCoGuestType,
  useBaseBeautyActions,
  useCoGuestState,
  useDeviceState,
  useGiftService,
  useLiveListState,
  useLiveSeatState,
  useLoginState,
  type BarrageGiftData,
  type CoGuestLocalStatus,
  type GiftPlayerRef,
  type StreamUserInfo,
  type ToastPosition,
} from '@tencentcloud/react-native-tuikit-atomic-x';
import { useKeepAwake } from '@sayem314/react-native-keep-awake';

import { useLiveTranslation } from '../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../styles/tokens';
import { sdkLanguage } from '../../utils';
import { LiveEndedView, LivingView, type LivingViewRef } from './views';

export interface VideoPlayerPageProps {
  liveID: string;
  onExit: () => void;
}

const DEFAULT_TEMPLATE_LAYOUT = 600;
const JOIN_FAIL_REDIRECT_MS = 500;
const TIP_DURATION = 2000;
const LISTENER_ID = 'VideoPlayerPage';
const SEAT_ADMIN_EVENTS = {
  onLocalCameraOpenedByAdmin: 'audience.cameraUnmutedByAdmin',
  onLocalCameraClosedByAdmin: 'audience.cameraMutedByAdmin',
  onLocalMicrophoneOpenedByAdmin: 'audience.micUnmutedByAdmin',
  onLocalMicrophoneClosedByAdmin: 'audience.micMutedByAdmin',
} as const;

type EndedInfo = { hostName: string; avatarURL: string };

const isDeviceOn = (status: unknown) => status === DeviceStatus.ON || status === DeviceStatusCode.ON;

export function VideoPlayerPage({ liveID, onExit }: VideoPlayerPageProps) {
  useKeepAwake();
  const { t } = useLiveTranslation();
  const { loginUserInfo } = useLoginState();
  const { joinLive, leaveLive, liveList, currentLive, addLiveListListener, removeLiveListListener, callExperimentalAPI } =
    useLiveListState();
  const { addLiveSeatEventListener, removeLiveSeatEventListener, seatList, muteMicrophone, unmuteMicrophone } =
    useLiveSeatState(liveID);
  const { disconnect } = useCoGuestState(liveID);
  const { closeLocalCamera, openLocalCamera, isFrontCamera, cameraStatus } = useDeviceState();
  const { setSmoothLevel, setWhitenessLevel, setRuddyLevel } = useBaseBeautyActions();

  const [templateLayout, setTemplateLayout] = useState(DEFAULT_TEMPLATE_LAYOUT);
  const [guestStatus, setGuestStatus] = useState<CoGuestLocalStatus>('IDLE');
  const [isShowLiveEnded, setIsShowLiveEnded] = useState(false);
  const [endedInfo, setEndedInfo] = useState<EndedInfo>({ hostName: '', avatarURL: '' });
  const [endedReason, setEndedReason] = useState('');
  const [isLargeSizeGiftPlayer, setIsLargeSizeGiftPlayer] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
  const [tip, setTip] = useState<{ visible: boolean; title: string; position: ToastPosition; seq: number }>({
    visible: false,
    title: '',
    position: 'center',
    seq: 0,
  });

  const livingViewRef = useRef<LivingViewRef>(null);
  const giftPlayerRef = useRef<GiftPlayerRef>(null);
  const guestStatusRef = useRef(guestStatus);
  guestStatusRef.current = guestStatus;
  const currentLiveRef = useRef(currentLive);
  currentLiveRef.current = currentLive;
  const liveInfoSnapshotRef = useRef<EndedInfo>({ hostName: '', avatarURL: '' });
  if (currentLive?.liveID) {
    liveInfoSnapshotRef.current = {
      hostName: currentLive.liveOwner?.userName || currentLive.liveOwner?.userID || '',
      avatarURL: currentLive.liveOwner?.avatarURL || '',
    };
  }
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const isExitingLiveRef = useRef(false);

  const { showGift, onGiftFinished } = useGiftService({ giftPlayerRef });
  const currentLoginUserId = loginUserInfo?.userID || '';

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  const showTip = useCallback((title: string, position: ToastPosition = 'center') => {
    setTip(prev => ({ visible: true, title, position, seq: prev.seq + 1 }));
  }, []);

  const removeAllLiveListeners = useCallback(() => {
    removeLiveListListener('onLiveEnded', () => {}, LISTENER_ID);
    removeLiveListListener('onKickedOutOfLive', () => {}, LISTENER_ID);
    Object.keys(SEAT_ADMIN_EVENTS).forEach(eventName => removeLiveSeatEventListener(eventName, LISTENER_ID));
  }, [removeLiveListListener, removeLiveSeatEventListener]);

  useEffect(() => {
    callExperimentalAPI({ api: 'setCurrentLanguage', params: { language: sdkLanguage() } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveID) {
      showTip(t('audience.emptyLiveID'));
      return;
    }
    joinLive({
      liveID,
      onSuccess: () => {
        const layout = currentLiveRef.current?.seatLayoutTemplateID;
        if (layout) setTemplateLayout(layout);
      },
      onError: error => {
        console.warn('[VideoPlayerPage] joinLive failed', error);
        showTip(t('audience.liveEnded'));
        later(() => onExitRef.current(), JOIN_FAIL_REDIRECT_MS);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveID]);

  useEffect(() => {
    const layout = currentLive?.seatLayoutTemplateID;
    if (layout) setTemplateLayout(layout);
  }, [currentLive?.seatLayoutTemplateID]);

  const prevLiveListRef = useRef(liveList);
  useEffect(() => {
    const oldList = prevLiveListRef.current || [];
    const newList = liveList || [];
    prevLiveListRef.current = liveList;
    for (let i = 0; i < oldList.length; i++) {
      const liveNewInfo = newList[i];
      const liveOldInfo = oldList[i];
      if (!liveNewInfo || !liveOldInfo) continue;
      if (!liveOldInfo.isMessageDisable && liveNewInfo.isMessageDisable) {
        showTip(t('audience.allMuted'));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveList]);

  useEffect(() => {
    const fillEndedInfo = () => {
      const live = currentLiveRef.current;
      const snap = liveInfoSnapshotRef.current;
      setEndedInfo({
        hostName: live?.liveOwner?.userName || live?.liveOwner?.userID || snap.hostName,
        avatarURL: live?.liveOwner?.avatarURL || snap.avatarURL,
      });
    };
    const handleLiveEnded = () => {
      fillEndedInfo();
      setEndedReason('');
      setIsShowLiveEnded(true);
    };
    const handleKickedOutOfLive = () => {
      isExitingLiveRef.current = true;
      removeAllLiveListeners();
      fillEndedInfo();
      setEndedReason(t('audience.kickedOut'));
      setIsShowLiveEnded(true);
      showTip(t('audience.kickedOut'));
    };
    addLiveListListener('onLiveEnded', handleLiveEnded, LISTENER_ID);
    addLiveListListener('onKickedOutOfLive', handleKickedOutOfLive, LISTENER_ID);
    (Object.keys(SEAT_ADMIN_EVENTS) as (keyof typeof SEAT_ADMIN_EVENTS)[]).forEach(eventName => {
      addLiveSeatEventListener(eventName, () => showTip(t(SEAT_ADMIN_EVENTS[eventName])), LISTENER_ID);
    });
    return removeAllLiveListeners;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveID]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(id => clearTimeout(id));
      timers.clear();
    };
  }, []);

  const doExitLive = useCallback(() => {
    isExitingLiveRef.current = true;
    if (guestStatusRef.current === 'CONNECTED') {
      disconnect({ liveID });
      setGuestStatus('IDLE');
    }
    leaveLive({
      onSuccess: () => onExitRef.current(),
      onError: error => {
        console.error('[VideoPlayerPage] leaveLive failed', error);
        onExitRef.current();
      },
    });
  }, [disconnect, leaveLive, liveID]);

  const navigateBack = useCallback(() => {
    doExitLive();
  }, [doExitLive]);

  const deviceRef = useRef({ seatList, cameraStatus, isFrontCamera });
  deviceRef.current = { seatList, cameraStatus, isFrontCamera };
  const doExitLiveRef = useRef(doExitLive);
  doExitLiveRef.current = doExitLive;

  useEffect(() => {
    const bg = { cameraClosed: false, micMuted: false, isFront: true, beauty: getBaseBeautyState() };
    const findSelfSeat = () =>
      (deviceRef.current.seatList || []).find(s => s?.userInfo?.userID === currentLoginUserId);

    const handleAppHide = () => {
      if (guestStatusRef.current !== 'CONNECTED' || isPermissionPrompting()) return;
      const selfSeat = findSelfSeat();
      if (!selfSeat) return;
      if (getLocalCoGuestType() !== 'mic' && isDeviceOn(selfSeat.userInfo?.cameraStatus)) {
        bg.cameraClosed = true;
        bg.isFront = deviceRef.current.isFrontCamera !== false;
        bg.beauty = getBaseBeautyState();
        closeLocalCamera();
      }
      if (isDeviceOn(selfSeat.userInfo?.microphoneStatus)) {
        bg.micMuted = true;
        muteMicrophone({ liveID });
      }
    };

    const handleAppShow = () => {
      if (!bg.cameraClosed && !bg.micMuted) return;
      const selfSeat = findSelfSeat();
      if (guestStatusRef.current !== 'CONNECTED' || !selfSeat) {
        bg.cameraClosed = false;
        bg.micMuted = false;
        return;
      }
      if (bg.cameraClosed) {
        bg.cameraClosed = false;
        if (getLocalCoGuestType() !== 'mic') {
          openLocalCamera({ isFront: bg.isFront });
          const { beauty } = bg;
          setSmoothLevel({ smoothLevel: beauty.smoothLevel });
          setWhitenessLevel({ whitenessLevel: beauty.whitenessLevel });
          setRuddyLevel({ ruddyLevel: beauty.ruddyLevel });
        }
      }
      if (bg.micMuted) {
        bg.micMuted = false;
        if (selfSeat.userInfo?.allowOpenMicrophone === false) return;
        unmuteMicrophone({ liveID });
        if (AppState.currentState !== 'active') {
          muteMicrophone({ liveID });
        }
      }
    };

    // Revoking a permission in Settings terminates a native app; RN keeps running, so check on return.
    // Only permissions granted when the page opened count, so viewers who never granted them are not kicked out.
    const baseline = { camera: false, microphone: false };
    let baselineReady = false;
    Promise.all([isAppPermissionDenied('camera'), isAppPermissionDenied('microphone')]).then(
      ([cameraDenied, micDenied]) => {
        baseline.camera = !cameraDenied;
        baseline.microphone = !micDenied;
        baselineReady = true;
      },
    );
    const redirectToEntryForPermission = async () => {
      if (!baselineReady || isExitingLiveRef.current) return;
      const [cameraDenied, micDenied] = await Promise.all([
        isAppPermissionDenied('camera'),
        isAppPermissionDenied('microphone'),
      ]);
      const cameraRevoked = baseline.camera && cameraDenied;
      const micRevoked = baseline.microphone && micDenied;
      if (!cameraRevoked && !micRevoked) return;
      showTip(t('audience.permissionRevoked'));
      doExitLiveRef.current();
    };

    let lastState = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      const wasActive = lastState === 'active';
      lastState = next;
      if (next === 'active' && !wasActive) {
        handleAppShow();
        redirectToEntryForPermission();
      } else if (next !== 'active' && wasActive) {
        handleAppHide();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveID, currentLoginUserId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const handleReceiveGift = useCallback(
    (giftData: BarrageGiftData, count: number) => {
      showGift({ ...giftData, count }, { count });
    },
    [showGift],
  );

  const onGiftPlayerFinished = useCallback(() => {
    setIsLargeSizeGiftPlayer(false);
    onGiftFinished();
  }, [onGiftFinished]);

  const onStreamViewSeatClick = useCallback((payload: StreamUserInfo) => {
    livingViewRef.current?.openCoGuestRequestFromSeat(payload);
  }, []);

  // Android adjustResize shrinks the window with the keyboard; pin the full height so only BarrageInput moves.
  const handlePageLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    setPageHeight((prev) => (height > prev ? height : prev));
  };

  return (
    <View
      style={[styles.container, pageHeight > 0 && { flex: 0, height: pageHeight }]}
      onLayout={handlePageLayout}
    >
      <DrawerHost>
      {!!liveID && (
        <LiveStreamView
          liveID={liveID}
          isAnchor={false}
          templateLayout={templateLayout}
          currentLoginUserId={currentLoginUserId}
          enableClickPanel
          isLiving
          onStreamViewClick={onStreamViewSeatClick}
        />
      )}
      {!!liveID && (
        <LivingView
          ref={livingViewRef}
          liveID={liveID}
          templateLayout={templateLayout}
          currentLoginUserId={currentLoginUserId}
          guestStatus={guestStatus}
          onGuestStatusChange={setGuestStatus}
          onTip={showTip}
          onReceiveGift={handleReceiveGift}
          onBack={navigateBack}
        />
      )}
      {isShowLiveEnded && (
        <LiveEndedView
          hostName={endedInfo.hostName}
          avatarURL={endedInfo.avatarURL}
          reason={endedReason}
          onClose={doExitLive}
        />
      )}
      <GiftPlayer
        ref={giftPlayerRef}
        visible={isLargeSizeGiftPlayer}
        onVisibleChange={setIsLargeSizeGiftPlayer}
        onFinished={onGiftPlayerFinished}
      />
      {tip.visible && (
        <Toast
          key={tip.seq}
          visible={tip.visible}
          onClose={() => setTip(prev => ({ ...prev, visible: false }))}
          title={tip.title}
          position={tip.position}
          duration={TIP_DURATION}
        />
      )}
      </DrawerHost>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: T.darkBgPage,
  },
});

export default VideoPlayerPage;
