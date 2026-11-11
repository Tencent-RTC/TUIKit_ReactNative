import { memo, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import {
  DeviceStatus,
  DeviceStatusCode,
  useCoGuestState,
  useDeviceState,
  useLiveSeatState,
  type MirrorType,
} from '../../atomic-x';
import { ensureMediaPermission, type AppPermissionKind } from '../../utils';
import { Drawer, Icon, rpxToPx } from '../Common';
import { getLocalCoGuestType } from './CoGuestRequestPanel';
import { useCoGuestPanelTranslation } from './locales';

export interface CoGuestControlBarProps {
  visible?: boolean;
  onClose?: () => void;
  liveID?: string;
  userID?: string;
  freezeCamera?: boolean;
  onOpenDetail?: () => void;
  onEnd?: () => void;
  onTip?: (title: string) => void;
}

const DRAWER_BG = require('../../static/assets/live/drawer-bg.png');
const MIC_PERMISSION_DENIED_CODE = -1105;

// Seat userInfo carries native numeric codes while DeviceState exposes 'ON'/'OFF'.
const isOff = (status: unknown) =>
  status === DeviceStatus.OFF || status === DeviceStatusCode.OFF;

export const CoGuestControlBar = memo(function CoGuestControlBar({
  visible = false,
  onClose,
  liveID = '',
  userID = '',
  freezeCamera = false,
  onOpenDetail,
  onEnd,
  onTip,
}: CoGuestControlBarProps) {
  const { t } = useCoGuestPanelTranslation();
  const { seatList, muteMicrophone, unmuteMicrophone } =
    useLiveSeatState(liveID);
  const {
    openLocalCamera,
    closeLocalCamera,
    openLocalMicrophone,
    closeLocalMicrophone,
    isFrontCamera,
    localMirrorType,
    switchMirror,
    switchCamera,
  } = useDeviceState();
  const { disconnect } = useCoGuestState(liveID);

  const [isBusy, setIsBusy] = useState(false);
  const isBusyRef = useRef(false);
  const lastFrontBeforeCloseRef = useRef(true);
  const lastMirrorBeforeCloseRef = useRef<MirrorType | null>(null);

  const updateBusy = (busy: boolean) => {
    isBusyRef.current = busy;
    setIsBusy(busy);
  };

  useEffect(() => {
    if (!visible) updateBusy(false);
  }, [visible]);

  const selfSeat = (seatList || []).find(
    (seat) => seat?.userInfo?.userID === userID
  );
  const selfMuted = isOff(selfSeat?.userInfo?.microphoneStatus);
  // startCameraTest rebinds the camera, so the seat briefly reports OFF while the adjust panel is open.
  const cameraOff = freezeCamera
    ? false
    : isOff(selfSeat?.userInfo?.cameraStatus);
  const isVideoGuest = getLocalCoGuestType() !== 'mic';

  const ensurePermission = async (
    kind: AppPermissionKind,
    deniedTip: string
  ) => {
    const result = await ensureMediaPermission(kind);
    if (result === 1) return true;
    if (result === -1) onTip?.(deniedTip);
    return false;
  };

  const onToggleMute = async () => {
    if (!selfMuted) {
      muteMicrophone({ liveID });
      return;
    }
    if (selfSeat?.userInfo?.allowOpenMicrophone === false) {
      onTip?.(t('micLocked'));
      return;
    }
    if (!(await ensurePermission('microphone', t('micPermissionDenied'))))
      return;
    openLocalMicrophone({
      onSuccess: () => {
        unmuteMicrophone({ liveID });
      },
      onError: () => {
        closeLocalMicrophone();
        onTip?.(t('micPermissionDenied'));
      },
    });
  };

  const onToggleCamera = async () => {
    if (!cameraOff) {
      lastFrontBeforeCloseRef.current = isFrontCamera !== false;
      lastMirrorBeforeCloseRef.current = localMirrorType ?? null;
      closeLocalCamera();
      return;
    }
    if (!(await ensurePermission('camera', t('cameraPermissionDenied'))))
      return;
    // closeLocalCamera may reset the SDK to front; reopen on front, then restore the snapshot.
    openLocalCamera({
      isFront: true,
      onSuccess: () => {
        if (AppState.currentState !== 'active') {
          closeLocalCamera();
          return;
        }
        if (lastFrontBeforeCloseRef.current === false) {
          switchCamera({ isFront: false });
        }
        if (lastMirrorBeforeCloseRef.current !== null) {
          switchMirror({ mirrorType: lastMirrorBeforeCloseRef.current });
        }
      },
      onError: (error) => {
        const { code, message } = (error ?? {}) as {
          code?: unknown;
          message?: unknown;
        };
        const micDenied =
          code === MIC_PERMISSION_DENIED_CODE ||
          String(message || '').includes('Microphone');
        onTip?.(t(micDenied ? 'micPermissionDenied' : 'cameraLocked'));
      },
    });
  };

  const handleOpenDetail = () => {
    onClose?.();
    onOpenDetail?.();
  };

  const onEndCoMic = () => {
    if (isBusyRef.current) return;
    updateBusy(true);
    disconnect({
      liveID,
      onSuccess: () => {
        updateBusy(false);
        onClose?.();
        onEnd?.();
      },
      onError: () => {
        updateBusy(false);
      },
    });
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={260}
      showHandle
      bgImage={DRAWER_BG}
      bgImageHeight={340}
      padding="0 40rpx 0 40rpx"
    >
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, selfMuted && styles.btnActive]}
          onPress={onToggleMute}
        >
          <Icon
            name={selfMuted ? 'micOff' : 'mic'}
            color={selfMuted ? '#000000' : undefined}
            style={styles.icon}
          />
        </Pressable>
        {isVideoGuest && (
          <Pressable
            style={[styles.btn, cameraOff && styles.btnActive]}
            onPress={onToggleCamera}
          >
            <Icon
              name={cameraOff ? 'cameraOff' : 'cameraOn'}
              color={cameraOff ? '#000000' : undefined}
              style={styles.icon}
            />
          </Pressable>
        )}
        {isVideoGuest && (
          <Pressable style={styles.btn} onPress={handleOpenDetail}>
            <Icon name="adjust" style={styles.icon} />
          </Pressable>
        )}
        <Pressable
          style={[styles.btn, styles.btnDanger, isBusy && styles.btnDisabled]}
          onPress={onEndCoMic}
        >
          <Icon name="hangup" style={styles.icon} />
        </Pressable>
      </View>
    </Drawer>
  );
});

const styles = StyleSheet.create({
  actions: {
    width: rpxToPx(670),
    height: rpxToPx(144),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  btn: {
    width: rpxToPx(96),
    height: rpxToPx(96),
    borderRadius: rpxToPx(48),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  btnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  btnDanger: {
    backgroundColor: '#ff5158',
  },
  btnDisabled: {
    opacity: 0.46,
  },
  icon: {
    width: rpxToPx(48),
    height: rpxToPx(48),
  },
});

export default CoGuestControlBar;
