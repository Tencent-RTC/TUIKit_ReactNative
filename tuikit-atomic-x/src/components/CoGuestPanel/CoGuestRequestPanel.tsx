import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { AppState, Image, Pressable, StyleSheet, View } from 'react-native';
import {
  GuestApplicationNoResponseReason,
  MirrorType,
  useCoGuestState,
  useDeviceState,
  useLiveListState,
  useLiveSeatState,
  useLoginState,
} from '../../atomic-x';
import { ensureMediaPermission, isPermissionPrompting } from '../../utils';
import { BeautyPanel } from '../Beauty';
import { Drawer, Icon, Text, Toast, rpxToPx } from '../Common';
import { CameraTestView } from '../../native/CameraTestView';
import { useCoGuestPanelTranslation } from './locales';

export type LocalCoGuestType = 'mic' | 'video' | '';

let localCoGuestType: LocalCoGuestType = '';

export const getLocalCoGuestType = (): LocalCoGuestType => localCoGuestType;

export const setLocalCoGuestType = (type: LocalCoGuestType): void => {
  localCoGuestType = type;
};

export type CoGuestLocalStatus = 'IDLE' | 'USER_APPLYING' | 'CONNECTED';

export interface CoGuestRequestPanelProps {
  visible?: boolean;
  onClose?: () => void;
  liveID?: string;
  userID?: string;
  seatIndex?: number;
  initialDetailOpen?: boolean;
  guestStatus?: CoGuestLocalStatus;
  onStatusChange?: (status: CoGuestLocalStatus) => void;
  onAccepted?: () => void;
  onBack?: () => void;
}

type CoGuestType = 'mic' | 'video' | '';

const DRAWER_BG = require('../../static/assets/live/drawer-bg.png');
const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');
const ICON_SPLIT_BG = require('../../static/assets/live/co-mic-split-bg.png');

const CAMERA_TEST_VIEW_ID = 'co-guest-camera-test';
const DETAIL_PREVIEW_HEIGHT = 1054;
const DETAIL_CONNECTED_HEIGHT = 380;
const CAMERA_START_DELAY_MS = 350;
const CAMERA_TEST_MAX_RETRY = 10;
const CAMERA_TEST_RETRY_MS = 100;
const CAMERA_FOLLOW_MS = 200;
const CAMERA_VIEW_NOT_FOUND = -1;
const MIC_PERMISSION_DENIED_CODE = -1105;
const PERMISSION_TIP_INTERVAL_MS = 3000;
const APPLY_ERROR_KEYS: Record<number, string> = {
  100004: 'room_not_exist',
  100005: 'not_room_member',
  100006: 'cannot_do_now',
  100200: 'seat_locked',
  100202: 'already_requesting',
  100203: 'already_on_seat',
  100205: 'seat_full',
  100210: 'seat_occupied',
  100211: 'not_supported',
};
const TIP_DURATION = 2000;
const LISTENER_ID = 'CoGuestRequestPanel';

type Timer = ReturnType<typeof setTimeout> | null;

const errorCodeOf = (error: unknown): number | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : undefined;
};

const parseMaybeJson = (value: unknown): Record<string, any> => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return (value as Record<string, any>) || {};
};

const clearTimer = (timerRef: MutableRefObject<Timer>) => {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
};

// iOS opening the camera also requests the microphone; with the microphone denied, camera test,
// camera and microphone all fail with -1105, so the tip must point at the microphone.
const isMicPermissionError = (error: unknown): boolean =>
  errorCodeOf(error) === MIC_PERMISSION_DENIED_CODE ||
  String((error as { message?: unknown } | null)?.message || '').includes(
    'Microphone'
  );

export const CoGuestRequestPanel = memo(function CoGuestRequestPanel({
  visible = false,
  onClose,
  liveID: liveIDProp,
  userID: userIDProp,
  seatIndex = -1,
  initialDetailOpen = false,
  guestStatus = 'IDLE',
  onStatusChange,
  onAccepted,
  onBack,
}: CoGuestRequestPanelProps) {
  const { t } = useCoGuestPanelTranslation();
  const { currentLive } = useLiveListState();
  const { loginUserInfo } = useLoginState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const userID = userIDProp || loginUserInfo?.userID || '';
  const {
    isFrontCamera,
    localMirrorType,
    openLocalMicrophone,
    closeLocalMicrophone,
    openLocalCamera,
    closeLocalCamera,
    switchCamera,
    switchMirror,
    startCameraTest,
    stopCameraTest,
  } = useDeviceState();
  const {
    connected,
    applyForSeat,
    cancelApplication,
    addCoGuestGuestListener,
    removeCoGuestGuestListener,
  } = useCoGuestState(liveID);
  const { seatList, muteMicrophone } = useLiveSeatState(liveID);

  const [status, setStatus] = useState<CoGuestLocalStatus>(guestStatus);
  const statusRef = useRef<CoGuestLocalStatus>(guestStatus);
  useEffect(() => {
    statusRef.current = guestStatus;
    setStatus(guestStatus);
  }, [guestStatus]);

  const [detailVisible, setDetailVisible] = useState(false);
  const detailVisibleRef = useRef(false);
  const [detailPreviewShown, setDetailPreviewShown] = useState(true);
  const detailPreviewRef = useRef(true);
  const [isShowBeautyPanel, setIsShowBeautyPanel] = useState(false);
  const [anchorAvatarFailed, setAnchorAvatarFailed] = useState(false);
  const [tipVisible, setTipVisible] = useState(false);
  const [tipSeq, setTipSeq] = useState(0);
  const [tipTitle, setTipTitle] = useState('');

  const coGuestTypeRef = useRef<CoGuestType>('');
  const pendingSeatIndexRef = useRef(-1);
  const frontRef = useRef(isFrontCamera !== false);
  const cameraFollowPendingRef = useRef(false);
  const cameraTestRetryCountRef = useRef(0);
  const cameraStartTimerRef = useRef<Timer>(null);
  const cameraTestRetryTimerRef = useRef<Timer>(null);
  const cameraFollowTimerRef = useRef<Timer>(null);

  useEffect(() => {
    frontRef.current = isFrontCamera !== false;
  }, [isFrontCamera]);

  const mirrorEnabled =
    localMirrorType === MirrorType.AUTO ||
    localMirrorType === MirrorType.ENABLE;

  const showTip = useCallback((title: string) => {
    setTipTitle(title);
    setTipSeq((seq) => seq + 1);
    setTipVisible(true);
  }, []);

  const lastPermissionTipAtRef = useRef(0);
  const showPermissionTipOnce = (error: unknown) => {
    if (!isMicPermissionError(error)) return;
    const now = Date.now();
    if (now - lastPermissionTipAtRef.current < PERMISSION_TIP_INTERVAL_MS)
      return;
    lastPermissionTipAtRef.current = now;
    showTip(t('micPermissionDenied'));
  };

  const updateStatus = (next: CoGuestLocalStatus) => {
    statusRef.current = next;
    setStatus(next);
    onStatusChange?.(next);
  };

  const updateDetailVisible = (next: boolean) => {
    detailVisibleRef.current = next;
    setDetailVisible(next);
  };

  const tryStartCameraTest = async () => {
    const wantFront = frontRef.current;
    const permission = await ensureMediaPermission('camera');
    if (permission !== 1) {
      if (permission === -1) showTip(t('camera_permission_denied'));
      return;
    }
    if (!detailVisibleRef.current) return;
    startCameraTest({
      cameraView: CAMERA_TEST_VIEW_ID,
      onSuccess: () => {
        cameraTestRetryCountRef.current = 0;
        // startCameraTest always opens the front camera, so follow the actual camera afterwards.
        if (!wantFront) {
          cameraFollowPendingRef.current = true;
          clearTimer(cameraFollowTimerRef);
          cameraFollowTimerRef.current = setTimeout(() => {
            cameraFollowPendingRef.current = false;
            if (detailVisibleRef.current) {
              switchCamera({ isFront: false });
              frontRef.current = false;
            }
          }, CAMERA_FOLLOW_MS);
        }
      },
      onError: (error) => {
        // The native view registers on attach; until then startCameraTest reports -1.
        if (
          errorCodeOf(error) === CAMERA_VIEW_NOT_FOUND &&
          cameraTestRetryCountRef.current < CAMERA_TEST_MAX_RETRY &&
          detailVisibleRef.current
        ) {
          cameraTestRetryCountRef.current += 1;
          clearTimer(cameraTestRetryTimerRef);
          cameraTestRetryTimerRef.current = setTimeout(
            tryStartCameraTest,
            CAMERA_TEST_RETRY_MS
          );
        } else {
          console.error('startCameraTest fail', error);
          showPermissionTipOnce(error);
        }
      },
    });
  };

  const openCoMicDetail = () => {
    clearTimer(cameraStartTimerRef);
    clearTimer(cameraTestRetryTimerRef);
    clearTimer(cameraFollowTimerRef);
    cameraTestRetryCountRef.current = 0;
    const preview = !initialDetailOpen;
    detailPreviewRef.current = preview;
    setDetailPreviewShown(preview);
    if (!preview) return;
    switchCamera({ isFront: true });
    frontRef.current = true;
    switchMirror({ mirrorType: MirrorType.ENABLE });
    // Camera capture init is heavy; starting it during the slide-in animation drops frames.
    cameraStartTimerRef.current = setTimeout(() => {
      cameraStartTimerRef.current = null;
      if (detailVisibleRef.current) tryStartCameraTest();
    }, CAMERA_START_DELAY_MS);
  };

  const closeCoMicDetail = () => {
    clearTimer(cameraStartTimerRef);
    clearTimer(cameraTestRetryTimerRef);
    clearTimer(cameraFollowTimerRef);
    if (cameraFollowPendingRef.current) {
      cameraFollowPendingRef.current = false;
      frontRef.current = false;
    }
    cameraTestRetryCountRef.current = 0;
    setIsShowBeautyPanel(false);
    if (!detailPreviewRef.current) return;
    stopCameraTest();
  };

  const latest = useRef({ openCoMicDetail, closeCoMicDetail });
  latest.current = { openCoMicDetail, closeCoMicDetail };

  const detailInitedRef = useRef(false);
  useEffect(() => {
    if (!detailInitedRef.current) {
      detailInitedRef.current = true;
      return;
    }
    if (detailVisible) {
      latest.current.openCoMicDetail();
    } else {
      latest.current.closeCoMicDetail();
    }
  }, [detailVisible]);

  useEffect(() => {
    if (visible) {
      setAnchorAvatarFailed(false);
      if (initialDetailOpen) {
        const timer = setTimeout(() => updateDetailVisible(true), 0);
        return () => clearTimeout(timer);
      }
      return undefined;
    }
    if (detailVisibleRef.current) updateDetailVisible(false);
    return undefined;
  }, [visible, initialDetailOpen]);

  const handleDetailBack = () => {
    updateDetailVisible(false);
    if (initialDetailOpen) {
      onBack?.();
    }
  };

  const handleDetailOverlayTap = () => {
    if (initialDetailOpen) {
      onBack?.();
      return;
    }
    onClose?.();
  };

  const handleToggleMirror = () => {
    switchMirror({
      mirrorType: mirrorEnabled ? MirrorType.DISABLE : MirrorType.ENABLE,
    });
  };

  const handleFlipCamera = () => {
    const next = !frontRef.current;
    frontRef.current = next;
    switchCamera({ isFront: next });
  };

  const finalizeAccepted = () => {
    if (statusRef.current === 'CONNECTED') return;
    pendingSeatIndexRef.current = -1;
    updateStatus('CONNECTED');
    // Requesting a denied device leaves a pending open that starts capturing once the user
    // re-grants it in Settings, while the UI still shows it off.
    const coGuestType = coGuestTypeRef.current;
    ensureMediaPermission('camera').then((permission) => {
      if (permission !== 1 || coGuestType !== 'video') return;
      openLocalCamera({
        isFront: frontRef.current,
        onSuccess: () => {
          if (AppState.currentState !== 'active' && !isPermissionPrompting()) {
            closeLocalCamera();
          }
        },
        onError: (error) => {
          console.error('openLocalCamera fail', error);
          showPermissionTipOnce(error);
          closeLocalCamera();
        },
      });
    });
    ensureMediaPermission('microphone').then((permission) => {
      if (permission !== 1) {
        muteMicrophone({ liveID });
        return;
      }
      openLocalMicrophone({
        onError: (error) => {
          console.error('openLocalMicrophone fail', error);
          showPermissionTipOnce(error);
          closeLocalMicrophone();
          muteMicrophone({ liveID });
        },
      });
    });
    if (detailVisibleRef.current) {
      updateDetailVisible(false);
    }
    onClose?.();
    onAccepted?.();
  };

  const handlers = useRef({
    onResponded: (_event?: unknown) => {},
    onNoResponse: (_event?: unknown) => {},
  });
  handlers.current.onResponded = (event?: unknown) => {
    const res = parseMaybeJson(event);
    if (res.isAccept) {
      finalizeAccepted();
    } else {
      updateStatus('IDLE');
      showTip(t('request_rejected'));
    }
  };
  handlers.current.onNoResponse = (event?: unknown) => {
    const res = parseMaybeJson(event);
    if (Number(res.reason) === GuestApplicationNoResponseReason.TIMEOUT) {
      updateStatus('IDLE');
      showTip(t('request_timeout'));
    }
  };

  useEffect(() => {
    if (!liveID) return undefined;
    addCoGuestGuestListener(
      'onGuestApplicationResponded',
      (event) => handlers.current.onResponded(event),
      liveID,
      LISTENER_ID
    );
    addCoGuestGuestListener(
      'onGuestApplicationNoResponse',
      (event) => handlers.current.onNoResponse(event),
      liveID,
      LISTENER_ID
    );
    return () => {
      removeCoGuestGuestListener(
        'onGuestApplicationResponded',
        liveID,
        LISTENER_ID
      );
      removeCoGuestGuestListener(
        'onGuestApplicationNoResponse',
        liveID,
        LISTENER_ID
      );
    };
  }, [liveID, addCoGuestGuestListener, removeCoGuestGuestListener]);

  useEffect(() => {
    const hasSelf = (connected || []).some(
      (item) => !!item?.userID && item.userID === userID
    );
    if (hasSelf && statusRef.current === 'USER_APPLYING') {
      finalizeAccepted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, userID]);

  useEffect(() => {
    if (statusRef.current !== 'USER_APPLYING') return;
    if (pendingSeatIndexRef.current < 0) return;
    const seat = (seatList || []).find(
      (s) => Number(s?.index) === pendingSeatIndexRef.current
    );
    const occupiedUserID = seat?.userInfo?.userID;
    if (occupiedUserID && occupiedUserID !== userID) {
      cancelApplication({ liveID });
      pendingSeatIndexRef.current = -1;
      updateStatus('IDLE');
      showTip(t('seat_occupied'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatList]);

  const lastSelfAllowOpenMicRef = useRef<boolean | null>(null);
  useEffect(() => {
    const selfSeat = (seatList || []).find(
      (s) => s?.userInfo?.userID === userID
    );
    if (!selfSeat) {
      lastSelfAllowOpenMicRef.current = null;
      return;
    }
    const allowOpenMic = selfSeat.userInfo?.allowOpenMicrophone !== false;
    const last = lastSelfAllowOpenMicRef.current;
    if (last !== null && last !== allowOpenMic) {
      showTip(t(allowOpenMic ? 'micUnlocked' : 'micLocked'));
    }
    lastSelfAllowOpenMicRef.current = allowOpenMic;
  }, [seatList, userID, showTip, t]);

  useEffect(
    () => () => {
      clearTimer(cameraStartTimerRef);
      clearTimer(cameraTestRetryTimerRef);
      clearTimer(cameraFollowTimerRef);
      setLocalCoGuestType('');
      if (detailVisibleRef.current && detailPreviewRef.current) {
        stopCameraTest();
      }
    },
    [stopCameraTest]
  );

  const doApplyCoGuest = (type: CoGuestType) => {
    if (statusRef.current !== 'IDLE') return;
    coGuestTypeRef.current = type;
    setLocalCoGuestType(type);
    // The preview camera and co-guest publishing are mutually exclusive, so stop the preview first.
    if (detailVisibleRef.current) {
      updateDetailVisible(false);
    }
    pendingSeatIndexRef.current = seatIndex >= 0 ? seatIndex : -1;
    applyForSeat({
      liveID,
      seatIndex,
      timeout: 0,
      onError: (error) => {
        const code = errorCodeOf(error);
        showTip(
          t((code !== undefined && APPLY_ERROR_KEYS[code]) || 'apply_failed')
        );
        updateStatus('IDLE');
      },
    });
    updateStatus('USER_APPLYING');
  };

  const handleSendCoGuest = (type: CoGuestType) => {
    if (type === 'video') {
      coGuestTypeRef.current = 'video';
      setLocalCoGuestType('video');
      updateDetailVisible(true);
      return;
    }
    doApplyCoGuest(type);
  };

  const handleCancelApplication = () => {
    cancelApplication({ liveID });
    pendingSeatIndexRef.current = -1;
    updateStatus('IDLE');
  };

  const anchor = currentLive?.liveOwner;
  const anchorAvatarSource =
    anchorAvatarFailed || !anchor?.avatarURL
      ? DEFAULT_AVATAR
      : { uri: anchor.avatarURL };
  const rawAnchorName = anchor?.userName || anchor?.userID || '';
  const anchorName =
    rawAnchorName.length > 15
      ? `${rawAnchorName.slice(0, 15)}…`
      : rawAnchorName;
  const isApplying = status === 'USER_APPLYING';
  const isConnected = status === 'CONNECTED';
  const detailHeight = detailPreviewShown
    ? DETAIL_PREVIEW_HEIGHT
    : DETAIL_CONNECTED_HEIGHT;

  const tip = tipVisible && (
    <Toast
      key={tipSeq}
      visible={tipVisible}
      onClose={() => setTipVisible(false)}
      title={tipTitle}
      duration={TIP_DURATION}
    />
  );
  const drawerShown = visible && !initialDetailOpen;
  const tipInDetail = detailVisible;
  const tipInDrawer = !tipInDetail && drawerShown;
  const tipAtRoot = !tipInDetail && !tipInDrawer;

  return (
    <>
      {!initialDetailOpen && (
        <Drawer
          visible={visible}
          onClose={onClose}
          height={430}
          overlayOpacity={0.4}
          bgImage={DRAWER_BG}
          bgImageHeight={710}
          padding="0 40rpx 60rpx 40rpx"
          overlay={tipInDrawer && tip}
        >
          <View style={styles.anchorProfile}>
            <View style={styles.anchorAvatarRing}>
              <Image
                source={anchorAvatarSource}
                style={styles.anchorAvatar}
                resizeMode="cover"
                onError={() => setAnchorAvatarFailed(true)}
              />
            </View>
            <Text style={styles.anchorName}>{anchorName}</Text>
          </View>
          {!isApplying && !isConnected && (
            <View style={styles.coMicActions}>
              <Image
                source={ICON_SPLIT_BG}
                style={styles.coMicSplitBg}
                resizeMode="stretch"
              />
              <Pressable
                style={[styles.coMicApply, styles.coMicApplyVoice]}
                onPress={() => handleSendCoGuest('mic')}
              >
                <Text style={styles.coMicApplyText}>{t('voice_co_guest')}</Text>
              </Pressable>
              <Pressable
                style={[styles.coMicApply, styles.coMicApplyVideo]}
                onPress={() => handleSendCoGuest('video')}
              >
                <Text style={styles.coMicApplyText}>{t('video_co_guest')}</Text>
              </Pressable>
            </View>
          )}
          {isApplying && (
            <View style={styles.coMicActions}>
              <Pressable
                style={[styles.coMicApply, styles.coMicApplyCancel]}
                onPress={handleCancelApplication}
              >
                <Text style={[styles.coMicApplyText, styles.cancelText]}>
                  {t('cancel_apply')}
                </Text>
              </Pressable>
            </View>
          )}
        </Drawer>
      )}
      <Drawer
        visible={detailVisible}
        onClose={handleDetailBack}
        onOverlayTap={handleDetailOverlayTap}
        height={detailHeight}
        showHandle
        bgImage={DRAWER_BG}
        bgImageHeight={detailHeight + 80}
        padding="0 40rpx 48rpx 40rpx"
        overlay={tipInDetail && tip}
      >
        <Pressable style={styles.detailBack} onPress={handleDetailBack}>
          <Icon name="back" style={styles.detailBackIcon} />
        </Pressable>
        <View style={styles.detailHeading}>
          <Text style={styles.detailTitle}>{t('adjust_title')}</Text>
          <Text style={styles.detailSubtitle}>{t('adjust_subtitle')}</Text>
        </View>
        {detailPreviewShown && (
          <View style={styles.localPreview}>
            <CameraTestView
              viewId={CAMERA_TEST_VIEW_ID}
              cornerRadius={20}
              style={styles.localPreviewCamera}
            />
          </View>
        )}
        <View style={styles.detailActions}>
          <Pressable
            style={styles.detailAction}
            onPress={() => setIsShowBeautyPanel(true)}
          >
            <View style={styles.capIcon}>
              <Icon name="beauty" style={styles.capIconImg} />
            </View>
            <Text style={styles.capLabel} numberOfLines={1}>
              {t('beautify')}
            </Text>
          </Pressable>
          <Pressable style={styles.detailAction} onPress={handleToggleMirror}>
            <View style={styles.capIcon}>
              <Icon
                name="mirror"
                style={[
                  styles.capIconImg,
                  { transform: [{ scaleX: mirrorEnabled ? 1 : -1 }] },
                ]}
              />
            </View>
            <Text style={styles.capLabel} numberOfLines={1}>
              {t('mirror')}
            </Text>
          </Pressable>
          <Pressable style={styles.detailAction} onPress={handleFlipCamera}>
            <View style={styles.capIcon}>
              <Icon name="flip" style={styles.capIconImg} />
            </View>
            <Text style={styles.capLabel} numberOfLines={1}>
              {t('flip_camera')}
            </Text>
          </Pressable>
        </View>
        {detailPreviewShown && (
          <Pressable
            style={styles.detailApply}
            onPress={() => doApplyCoGuest('video')}
          >
            <Text style={styles.detailApplyText}>{t('apply_co_guest')}</Text>
          </Pressable>
        )}
      </Drawer>
      <BeautyPanel
        visible={isShowBeautyPanel}
        onClose={() => setIsShowBeautyPanel(false)}
      />
      {tipAtRoot && tip}
    </>
  );
});

const styles = StyleSheet.create({
  anchorProfile: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  anchorAvatarRing: {
    width: rpxToPx(140),
    height: rpxToPx(140),
    borderRadius: rpxToPx(70),
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorAvatar: {
    width: rpxToPx(116),
    height: rpxToPx(116),
    borderRadius: rpxToPx(58),
    borderWidth: rpxToPx(4),
    borderColor: '#4A9EFF',
  },
  anchorName: {
    marginTop: rpxToPx(20),
    color: '#ffffff',
    fontSize: rpxToPx(32),
    fontWeight: '600',
  },
  coMicActions: {
    position: 'relative',
    flexDirection: 'row',
    width: rpxToPx(670),
    height: rpxToPx(80),
    marginTop: rpxToPx(44),
    borderRadius: rpxToPx(22),
    overflow: 'hidden',
  },
  coMicSplitBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpxToPx(670),
    height: rpxToPx(80),
    borderRadius: rpxToPx(22),
  },
  coMicApply: {
    position: 'relative',
    flex: 1,
    height: rpxToPx(80),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  coMicApplyVoice: {
    paddingRight: rpxToPx(40),
  },
  coMicApplyVideo: {
    paddingLeft: rpxToPx(40),
  },
  coMicApplyCancel: {
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: rpxToPx(22),
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  coMicApplyText: {
    color: '#ffffff',
    fontSize: rpxToPx(26),
    fontWeight: '600',
  },
  cancelText: {
    color: 'rgba(255, 255, 255, 0.72)',
  },
  detailBack: {
    position: 'absolute',
    left: rpxToPx(32),
    top: rpxToPx(40),
    width: rpxToPx(72),
    height: rpxToPx(72),
    borderRadius: rpxToPx(36),
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  detailBackIcon: {
    width: rpxToPx(36),
    height: rpxToPx(36),
  },
  detailHeading: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  detailTitle: {
    color: '#ffffff',
    fontSize: rpxToPx(32),
    fontWeight: '600',
  },
  detailSubtitle: {
    marginTop: rpxToPx(8),
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: rpxToPx(24),
  },
  localPreview: {
    width: rpxToPx(494),
    height: rpxToPx(494),
    marginTop: rpxToPx(40),
    borderRadius: rpxToPx(40),
    overflow: 'hidden',
    backgroundColor: '#0e1932',
    alignItems: 'center',
    justifyContent: 'center',
  },
  localPreviewCamera: {
    width: rpxToPx(494),
    height: rpxToPx(494),
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: rpxToPx(526),
    height: rpxToPx(152),
    marginTop: rpxToPx(40),
  },
  detailAction: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  capIcon: {
    width: rpxToPx(96),
    height: rpxToPx(96),
    borderRadius: rpxToPx(48),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rpxToPx(16),
  },
  capIconImg: {
    width: rpxToPx(48),
    height: rpxToPx(48),
  },
  capLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: rpxToPx(22),
  },
  detailApply: {
    width: rpxToPx(670),
    height: rpxToPx(88),
    marginTop: rpxToPx(48),
    borderRadius: rpxToPx(44),
    backgroundColor: '#3b7bff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailApplyText: {
    color: '#ffffff',
    fontSize: rpxToPx(30),
    fontWeight: '600',
  },
});

export default CoGuestRequestPanel;
