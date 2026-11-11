import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Common';
import {
  CoHostStatus,
  DeviceStatus,
  DeviceStatusCode,
  useCoGuestState,
  useCoHostState,
  useDeviceState,
  useLiveListState,
  useLiveSeatState,
  type SeatInfo,
} from '../../atomic-x';
import { Dialog, Drawer, Icon, Toast, rpxToPx, type IconName } from '../Common';
import { useLiveStreamViewTranslation } from './locales';

export interface StreamUserInfo {
  userID?: string;
  userName?: string;
  avatarURL?: string;
  seatIndex?: number;
  [key: string]: unknown;
}

// Seat userInfo carries native numeric codes while DeviceState exposes 'ON'/'OFF'.
export function isDeviceOn(status: unknown): boolean {
  return status === DeviceStatusCode.ON || status === DeviceStatus.ON;
}

export function isDeviceOff(status: unknown): boolean {
  return status === DeviceStatusCode.OFF || status === DeviceStatus.OFF;
}

export function getDisplayName(user?: StreamUserInfo | null): string {
  return String(user?.userName || user?.nickname || user?.userID || '');
}

export function getErrorCode(error: unknown): number | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : undefined;
}

const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');

const ERROR_SELF_MUTED = -2360;
const ERROR_SELF_BANNED_VIDEO = -2370;

export interface LiveStreamActionPanelProps {
  visible?: boolean;
  onClose?: () => void;
  userInfo?: StreamUserInfo | null;
  liveID?: string;
  isAnchorMode?: boolean;
  isSelf?: boolean;
}

type ConfirmKind = 'disconnectHost' | 'kickGuest' | 'disconnectSelf';

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <View style={styles.actionBtnImageContainer}>
        <Icon name={icon} style={styles.actionBtnImage} />
      </View>
      <Text style={styles.actionBtnContent} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LiveStreamActionPanel({
  visible = false,
  onClose,
  userInfo,
  liveID: liveIDProp = '',
  isAnchorMode = false,
  isSelf = false,
}: LiveStreamActionPanelProps) {
  const { t } = useLiveStreamViewTranslation();
  const { currentLive } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');

  const {
    cameraStatus,
    isFrontCamera,
    openLocalCamera,
    closeLocalCamera,
    switchCamera,
  } = useDeviceState();
  const { exitHostConnection, coHostStatus } = useCoHostState(liveID);
  const { disconnect } = useCoGuestState(liveID);
  const {
    seatList,
    muteMicrophone,
    unmuteMicrophone,
    openRemoteCamera,
    closeRemoteCamera,
    openRemoteMicrophone,
    closeRemoteMicrophone,
    kickUserOutOfSeat,
  } = useLiveSeatState(liveID);

  const [tip, setTip] = useState({ seq: 0, title: '', visible: false });
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);

  const showTip = useCallback((title: string) => {
    setTip((prev) => ({ seq: prev.seq + 1, title, visible: true }));
  }, []);

  const close = useCallback(() => onClose?.(), [onClose]);

  const targetUserID = userInfo?.userID;
  const displayName = userInfo?.userName || userInfo?.userID || '';

  const targetSeat = useMemo<SeatInfo | null>(() => {
    if (!targetUserID || !Array.isArray(seatList)) return null;
    return seatList.find((s) => s?.userInfo?.userID === targetUserID) ?? null;
  }, [seatList, targetUserID]);

  const targetMicOn = isDeviceOn(targetSeat?.userInfo?.microphoneStatus);
  const targetCameraOn = isDeviceOn(targetSeat?.userInfo?.cameraStatus);

  const prevSeatListRef = useRef<SeatInfo[] | null>(null);
  useEffect(() => {
    const oldList = prevSeatListRef.current;
    prevSeatListRef.current = seatList;
    if (!oldList || !seatList || seatList.length >= oldList.length) return;
    const missing = oldList.find(
      (o) => !seatList.some((n) => n.userInfo?.userID === o.userInfo?.userID)
    );
    if (missing && missing.userInfo?.userID === targetUserID) {
      close();
    }
  }, [seatList, targetUserID, close]);

  const showFlip = isSelf && targetCameraOn;
  const showHangup = !isSelf || !isAnchorMode;

  const micOffText = isSelf
    ? t('sv.micOffSelf')
    : isAnchorMode
    ? t('sv.micOffAnchor')
    : t('sv.micOff');
  const micOnText = isSelf
    ? t('sv.micOnSelf')
    : isAnchorMode
    ? t('sv.micOnAnchor')
    : t('sv.micOn');
  const cameraOffText =
    isAnchorMode && !isSelf ? t('sv.cameraOffAnchor') : t('sv.cameraOff');
  const cameraOnText =
    isAnchorMode && !isSelf ? t('sv.cameraOnAnchor') : t('sv.cameraOn');
  const hangupText = !isAnchorMode
    ? t('sv.disconnectGuest')
    : !isSelf
    ? t('sv.hangup')
    : t('sv.removeSeat');

  const microphoneOperation = () => {
    if (!isSelf) {
      if (!targetUserID) return;
      if (targetMicOn) {
        closeRemoteMicrophone({ liveID, userID: targetUserID });
        showTip(t('sv.youMutedUser', { name: displayName }));
      } else {
        openRemoteMicrophone({
          liveID,
          userID: targetUserID,
          policy: 'UNLOCK_ONLY',
        });
        showTip(t('sv.youUnmutedUser', { name: displayName }));
      }
      close();
      return;
    }
    if (targetMicOn) {
      muteMicrophone({ liveID });
    } else {
      unmuteMicrophone({
        liveID,
        onError: (error) => {
          if (getErrorCode(error) === ERROR_SELF_MUTED) {
            showTip(t('sv.selfMuted'));
          }
        },
      });
    }
    close();
  };

  const cameraOperation = () => {
    if (!isSelf) {
      if (!targetUserID) return;
      if (targetCameraOn) {
        closeRemoteCamera({ liveID, userID: targetUserID });
        showTip(t('sv.youBannedUserVideo', { name: displayName }));
      } else {
        openRemoteCamera({
          liveID,
          userID: targetUserID,
          policy: 'UNLOCK_ONLY',
        });
        showTip(t('sv.youUnbannedUserVideo', { name: displayName }));
      }
      close();
      return;
    }
    if (targetCameraOn) {
      closeLocalCamera();
    } else {
      openLocalCamera({
        isFront: isFrontCamera ?? true,
        onError: (error) => {
          if (getErrorCode(error) === ERROR_SELF_BANNED_VIDEO) {
            showTip(t('sv.selfBannedVideo'));
          }
        },
      });
    }
    close();
  };

  const flipCamera = () => {
    if (cameraStatus !== DeviceStatus.ON || !isSelf) return;
    switchCamera({ isFront: !(isFrontCamera ?? true) });
    close();
  };

  const handleHangUp = () => {
    if (!isAnchorMode) {
      setConfirmKind('disconnectSelf');
    } else if (coHostStatus === CoHostStatus.CONNECTED) {
      setConfirmKind('disconnectHost');
    } else {
      setConfirmKind('kickGuest');
    }
  };

  const handleConfirm = () => {
    if (confirmKind === 'disconnectHost') {
      exitHostConnection({ liveID });
    } else if (confirmKind === 'kickGuest' && targetUserID) {
      kickUserOutOfSeat({ liveID, userID: targetUserID });
    } else if (confirmKind === 'disconnectSelf') {
      disconnect({ liveID });
    }
    close();
  };

  const handleCancel = () => {
    if (confirmKind !== 'disconnectSelf') {
      close();
    }
  };

  const confirmMessage =
    confirmKind === 'disconnectHost'
      ? t('sv.confirmDisconnectHost')
      : confirmKind === 'kickGuest'
      ? t('sv.confirmDisconnectGuest')
      : t('sv.confirmDisconnect');
  const confirmText =
    confirmKind === 'disconnectSelf' ? t('sv.confirm') : t('sv.disconnect');

  return (
    <>
      <Drawer
        visible={visible}
        onClose={close}
        height={400}
        borderRadius={32}
        overlayOpacity={0.4}
        padding="0"
        showHandle={false}
        showGlow={false}
      >
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <View style={styles.avatarContainer}>
              <Image
                style={styles.userAvatar}
                source={
                  userInfo?.avatarURL
                    ? { uri: userInfo.avatarURL }
                    : DEFAULT_AVATAR
                }
                resizeMode="cover"
              />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.username} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.userId}>ID: {userInfo?.userID || ''}</Text>
            </View>
          </View>
          <View style={styles.drawerContent}>
            <View style={styles.drawerActions}>
              <ActionButton
                icon={targetMicOn ? 'micOn' : 'micOff'}
                label={targetMicOn ? micOffText : micOnText}
                onPress={microphoneOperation}
              />
              <ActionButton
                icon={targetCameraOn ? 'cameraOn' : 'cameraOff'}
                label={targetCameraOn ? cameraOffText : cameraOnText}
                onPress={cameraOperation}
              />
              {showFlip && (
                <ActionButton
                  icon="flip"
                  label={t('sv.flip')}
                  onPress={flipCamera}
                />
              )}
              {showHangup && (
                <ActionButton
                  icon="hangup"
                  label={hangupText}
                  onPress={handleHangUp}
                />
              )}
            </View>
          </View>
        </View>
      </Drawer>
      <Dialog
        visible={confirmKind !== null}
        onClose={() => setConfirmKind(null)}
        message={confirmMessage}
        confirmText={confirmText}
        cancelText={t('sv.cancel')}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      <Toast
        key={tip.seq}
        visible={tip.visible}
        title={tip.title}
        duration={2000}
        onClose={() => setTip((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'column',
    backgroundColor: 'rgba(31, 32, 36, 1)',
  },
  drawerHeader: {
    paddingVertical: rpxToPx(40),
    paddingHorizontal: rpxToPx(48),
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: rpxToPx(80),
    height: rpxToPx(80),
    marginRight: rpxToPx(24),
  },
  userAvatar: {
    width: rpxToPx(80),
    height: rpxToPx(80),
    borderRadius: rpxToPx(40),
  },
  userDetails: {
    flex: 1,
    flexDirection: 'column',
  },
  username: {
    fontSize: rpxToPx(32),
    color: '#C5CCDB',
    fontWeight: '500',
    marginBottom: rpxToPx(8),
    maxWidth: rpxToPx(550),
  },
  userId: {
    fontSize: rpxToPx(28),
    color: '#7C85A6',
  },
  drawerContent: {
    paddingHorizontal: rpxToPx(48),
  },
  drawerActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    height: rpxToPx(160),
    width: rpxToPx(120),
    marginLeft: rpxToPx(10),
  },
  actionBtnImageContainer: {
    width: rpxToPx(100),
    height: rpxToPx(100),
    backgroundColor: 'rgba(43, 44, 48, 1)',
    marginBottom: rpxToPx(16),
    borderRadius: rpxToPx(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnImage: {
    width: rpxToPx(50),
    height: rpxToPx(50),
  },
  actionBtnContent: {
    fontSize: rpxToPx(26),
    color: '#ffffff',
  },
});
