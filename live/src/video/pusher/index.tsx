import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Keyboard, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  DeviceStatus,
  DrawerHost,
  GiftPlayer,
  LiveStreamView,
  Toast,
  isAppPermissionDenied,
  isPermissionPrompting,
  MirrorType,
  useAudioEffectActions,
  getBaseBeautyState,
  getDeviceState,
  useBaseBeautyActions,
  useDeviceActions,
  useGiftService,
  useLiveListState,
  useLiveSeatState,
  useLiveSummaryState,
  useLoginState,
  type BarrageGiftData,
  type GiftPlayerRef,
  type StreamUserInfo,
  type LiveStreamViewRef,
  type SummaryData,
} from '@tencentcloud/react-native-tuikit-atomic-x';
import { useKeepAwake } from '@sayem314/react-native-keep-awake';

import { useLiveTranslation } from '../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../styles/tokens';
import { isEnglishUI, pusherSession, sdkLanguage, toMsTimestamp } from '../../utils';
import { CoGuestManagePanel } from './components/CoGuestManagePanel';
import { BeforeLiveView, LiveSummaryView, LivingView } from './views';

export interface VideoPusherPageProps {
  liveID?: string;
  onExit: () => void;
}

type PusherStatus = 'PREPARE' | 'PUSHER' | 'SUMMARY';

const TOAST_DURATION = 2000;
const DEFAULT_TEMPLATE_LAYOUT = 600;
const MUTE_IMAGE_ZH = require('../../static/images/live/background/live_mute_image_zh.png');
const MUTE_IMAGE_EN = require('../../static/images/live/background/live_mute_image_en.png');
const MUTE_IMAGE_MULTI = require('../../static/images/live/background/live_mute_image_multi.png');

export function VideoPusherPage({ liveID: liveIDProp, onExit }: VideoPusherPageProps) {
  useKeepAwake();
  const { loginUserInfo } = useLoginState();
  const userID = loginUserInfo?.userID || '';
  const liveID = liveIDProp || (userID ? `live_${userID}` : '');

  const { setVoiceEarMonitorEnable, setVoiceEarMonitorVolume, setAudioChangerType, setAudioReverbType } =
    useAudioEffectActions();
  const { setSmoothLevel, setWhitenessLevel, setRuddyLevel } = useBaseBeautyActions();
  const {
    openLocalCamera,
    openLocalMicrophone,
    closeLocalMicrophone,
    closeLocalCamera,
    setCaptureVolume,
    switchMirror,
  } = useDeviceActions();
  const { muteMicrophone, unmuteMicrophone } = useLiveSeatState(liveID);
  const { t } = useLiveTranslation();
  const { currentLive, callExperimentalAPI } = useLiveListState();
  const { summaryData } = useLiveSummaryState(liveID);

  const [status, setStatus] = useState<PusherStatus>(liveIDProp ? 'PUSHER' : 'PREPARE');
  const [toast, setToast] = useState({ visible: false, title: '', seq: 0 });
  const [templateLayout, setTemplateLayout] = useState(DEFAULT_TEMPLATE_LAYOUT);
  const [liveStartAt, setLiveStartAt] = useState(0);
  const [ended, setEnded] = useState({ at: 0, elapsedSeconds: 0, pausedSeconds: 0 });
  const [liveSummary, setLiveSummary] = useState<SummaryData | null>(null);
  const [coGuestManageTarget, setCoGuestManageTarget] = useState<StreamUserInfo | null>(null);
  const [isShowCoGuestManage, setIsShowCoGuestManage] = useState(false);
  const [giftURL, setGiftURL] = useState<string | undefined>(undefined);
  const [isLargeGiftPlaying, setIsLargeGiftPlaying] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);

  const giftPlayerRef = useRef<GiftPlayerRef>(null);
  const liveStreamViewRef = useRef<LiveStreamViewRef>(null);
  const { showGift, onGiftFinished } = useGiftService({ giftPlayerRef });

  const isStartLive = status === 'PUSHER';
  const isLiveEnded = status === 'SUMMARY';
  const statusRef = useRef(status);
  statusRef.current = status;

  const showTip = useCallback((title: string) => {
    setToast((prev) => ({ visible: true, title, seq: prev.seq + 1 }));
  }, []);

  const showCoGuestManage = useCallback((user: StreamUserInfo) => {
    setCoGuestManageTarget(user);
    setIsShowCoGuestManage(true);
  }, []);
  const closeCoGuestManage = useCallback(() => setIsShowCoGuestManage(false), []);

  const clearAudioEffectSet = useCallback(() => {
    setCaptureVolume({ volume: 100 });
    setVoiceEarMonitorEnable({ enable: false });
    setVoiceEarMonitorVolume({ volume: 100 });
    setAudioChangerType({ changerType: 'NONE' });
    setAudioReverbType({ reverbType: 'NONE' });
  }, [setCaptureVolume, setVoiceEarMonitorEnable, setVoiceEarMonitorVolume, setAudioChangerType, setAudioReverbType]);

  const clearBeautyPanelSet = useCallback(() => {
    setSmoothLevel({ smoothLevel: 0 });
    setWhitenessLevel({ whitenessLevel: 0 });
    setRuddyLevel({ ruddyLevel: 0 });
  }, [setSmoothLevel, setWhitenessLevel, setRuddyLevel]);

  const goBack = useCallback(() => {
    clearAudioEffectSet();
    clearBeautyPanelSet();
    closeLocalMicrophone();
    closeLocalCamera();
    onExit();
  }, [clearAudioEffectSet, clearBeautyPanelSet, closeLocalMicrophone, closeLocalCamera, onExit]);

  const handleLiveEnded = useCallback(
    (pausedSeconds = 0) => {
      if (statusRef.current !== 'PUSHER') return;
      clearAudioEffectSet();
      clearBeautyPanelSet();
      const now = Date.now();
      setEnded({
        at: now,
        pausedSeconds: pausedSeconds || 0,
        elapsedSeconds:
          liveStartAt > 0 ? Math.max(0, Math.round((now - liveStartAt - pausedSeconds * 1000) / 1000)) : 0,
      });
      setStatus('SUMMARY');
    },
    [clearAudioEffectSet, clearBeautyPanelSet, liveStartAt],
  );

  const handleReceiveGift = (giftData: BarrageGiftData) => {
    if (!giftData) return;
    setGiftURL(typeof giftData.gift?.resourceURL === 'string' ? giftData.gift.resourceURL : undefined);
    showGift({ gift: giftData.gift, sender: giftData.sender, count: Number(giftData.count) || 1 }, { onlyDisplay: true });
  };

  const handleGiftFinished = () => {
    setIsLargeGiftPlaying(false);
    onGiftFinished();
  };

  useEffect(() => {
    if (liveStartAt > 0) return;
    const createTime = toMsTimestamp(currentLive?.createTime);
    if (createTime > 0) setLiveStartAt(createTime);
  }, [currentLive?.createTime, liveStartAt]);

  useEffect(() => {
    const n = Number(currentLive?.seatLayoutTemplateID);
    if (n > 0) setTemplateLayout(n);
  }, [currentLive?.seatLayoutTemplateID]);

  useEffect(() => {
    if (summaryData) setLiveSummary({ ...summaryData });
  }, [summaryData]);

  useEffect(() => {
    if (!isStartLive) return;
    liveStreamViewRef.current?.setLocalVideoMuteImage(isEnglishUI() ? MUTE_IMAGE_EN : MUTE_IMAGE_ZH, MUTE_IMAGE_MULTI);
  }, [isStartLive]);

  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    const bg = {
      mutedByBackground: false,
      cameraClosedByBackground: false,
      frontBeforeBackground: true,
      beautyBeforeBackground: getBaseBeautyState(),
    };

    pusherSession.onPauseChanged = paused => {
      if (paused) {
        bg.cameraClosedByBackground = false;
        bg.mutedByBackground = false;
      }
    };

    const handleAppHide = () => {
      if (statusRef.current !== 'PUSHER' || isPermissionPrompting()) return;
      const device = getDeviceState();
      if (device.cameraStatus === DeviceStatus.ON) {
        bg.cameraClosedByBackground = true;
        bg.frontBeforeBackground = device.isFrontCamera !== false;
        bg.beautyBeforeBackground = getBaseBeautyState();
        closeLocalCamera();
      }
      if (pusherSession.selfMuted) return;
      bg.mutedByBackground = true;
      muteMicrophone({ liveID });
    };

    const handleAppShow = () => {
      if (!bg.cameraClosedByBackground && !bg.mutedByBackground) return;
      if (statusRef.current !== 'PUSHER') {
        bg.cameraClosedByBackground = false;
        bg.mutedByBackground = false;
        return;
      }
      if (bg.cameraClosedByBackground) {
        bg.cameraClosedByBackground = false;
        openLocalCamera({ isFront: bg.frontBeforeBackground });
        const beauty = bg.beautyBeforeBackground;
        setSmoothLevel({ smoothLevel: beauty.smoothLevel });
        setWhitenessLevel({ whitenessLevel: beauty.whitenessLevel });
        setRuddyLevel({ ruddyLevel: beauty.ruddyLevel });
      }
      if (bg.mutedByBackground) {
        bg.mutedByBackground = false;
        if (pusherSession.selfMuted) {
          muteMicrophone({ liveID });
          return;
        }
        unmuteMicrophone({ liveID });
        if (AppState.currentState !== 'active' || pusherSession.paused) {
          muteMicrophone({ liveID });
        }
      }
    };

    // Revoking a permission in Settings terminates a native app; RN keeps running, so check on return.
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
      if (!baselineReady) return;
      const [cameraDenied, micDenied] = await Promise.all([
        isAppPermissionDenied('camera'),
        isAppPermissionDenied('microphone'),
      ]);
      const cameraRevoked = baseline.camera && cameraDenied;
      const micRevoked = baseline.microphone && micDenied;
      if (!cameraRevoked && !micRevoked) return;
      showTip(t('anchor.permissionRevoked'));
      goBackRef.current();
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
    return () => {
      subscription.remove();
      pusherSession.onPauseChanged = null;
      pusherSession.paused = false;
      pusherSession.selfMuted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveID]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    callExperimentalAPI({ api: 'setCurrentLanguage', params: { language: sdkLanguage() } });
    clearAudioEffectSet();
    switchMirror({ mirrorType: MirrorType.ENABLE });
    if (status !== 'PREPARE') {
      openLocalCamera({ isFront: true });
      openLocalMicrophone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android adjustResize shrinks the window with the keyboard; pin the full height so only BarrageInput moves.
  const handlePageLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    setPageHeight((prev) => (height > prev ? height : prev));
  };

  return (
    <View style={[styles.page, pageHeight > 0 && { flex: 0, height: pageHeight }]} onLayout={handlePageLayout}>
      <View style={styles.container} onStartShouldSetResponder={() => true} onResponderRelease={Keyboard.dismiss}>
        <DrawerHost>
        {!!liveID && !isLiveEnded && (
          <LiveStreamView
            ref={liveStreamViewRef}
            liveID={liveID}
            isAnchor
            templateLayout={templateLayout}
            isLiving={isStartLive}
            currentLoginUserId={userID}
            onStreamViewClick={showCoGuestManage}
          />
        )}
        {status === 'PREPARE' && (
          <BeforeLiveView
            liveID={liveID}
            templateLayout={templateLayout}
            onBack={goBack}
            onTip={showTip}
            onStarted={() => setStatus('PUSHER')}
          />
        )}
        {isStartLive && (
          <LivingView liveID={liveID} onTip={showTip} onEnded={handleLiveEnded} onReceiveGift={handleReceiveGift} />
        )}
        {isStartLive && (
          <CoGuestManagePanel
            visible={isShowCoGuestManage}
            onClose={closeCoGuestManage}
            liveID={liveID}
            userInfo={coGuestManageTarget}
            onTip={showTip}
          />
        )}
        {isLiveEnded && (
          <LiveSummaryView
            summary={liveSummary}
            liveDuration={ended.elapsedSeconds}
            startTime={liveStartAt}
            endedAt={ended.at}
            pausedSeconds={ended.pausedSeconds}
            onClose={goBack}
          />
        )}
        {isStartLive && (
          <GiftPlayer
            ref={giftPlayerRef}
            visible={isLargeGiftPlaying}
            onVisibleChange={setIsLargeGiftPlaying}
            url={giftURL}
            onFinished={handleGiftFinished}
          />
        )}
        <Toast
          key={toast.seq}
          visible={toast.visible}
          title={toast.title}
          duration={TOAST_DURATION}
          onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
        />
        </DrawerHost>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: T.colorBlack,
  },
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: T.darkBgPage50,
  },
});

export default VideoPusherPage;
