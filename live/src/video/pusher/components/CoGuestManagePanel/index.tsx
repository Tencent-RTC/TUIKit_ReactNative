import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Drawer, Icon, Text, useLiveSeatState, type StreamUserInfo } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { DRAWER_BG, isDeviceStatusOn, rpxToPx } from '../../../../utils';

export interface CoGuestManagePanelProps {
  visible: boolean;
  onClose: () => void;
  liveID: string;
  userInfo: StreamUserInfo | null;
  onTip?: (title: string) => void;
}

const DRAWER_HEIGHT = 300;
const TOAST_NAME_MAX = 8;

export function CoGuestManagePanel({ visible, onClose, liveID, userInfo, onTip }: CoGuestManagePanelProps) {
  const { t } = useLiveTranslation();
  const { seatList, openRemoteMicrophone, closeRemoteMicrophone, kickUserOutOfSeat } = useLiveSeatState(liveID);
  const busyRef = useRef(false);

  const targetUserID = String(userInfo?.userID || '');
  const displayName = String(userInfo?.userName || userInfo?.userID || '');
  const targetSeat = targetUserID
    ? (seatList || []).find((item) => item?.userInfo?.userID === targetUserID) || null
    : null;
  const allowOpenMicrophone = targetSeat?.userInfo?.allowOpenMicrophone !== false;
  const microphoneOn = allowOpenMicrophone && isDeviceStatusOn(targetSeat?.userInfo?.microphoneStatus);
  const compactName = displayName.split(/\s+/).filter(Boolean).join(' ');
  const toastName = compactName.length > TOAST_NAME_MAX ? `${compactName.slice(0, TOAST_NAME_MAX)}…` : compactName;

  useEffect(() => {
    if (visible) busyRef.current = false;
  }, [visible]);

  useEffect(() => {
    if (visible && targetUserID && !targetSeat) onClose();
  }, [visible, targetUserID, targetSeat, onClose]);

  const toggleMicrophone = () => {
    if (!targetUserID || busyRef.current) return;
    if (allowOpenMicrophone && !microphoneOn) {
      onTip?.(t('anchor.guestMicManualOpen'));
      return;
    }
    busyRef.current = true;
    const message = allowOpenMicrophone
      ? t('anchor.guestMicClosed', { name: toastName })
      : t('anchor.guestMicUnlocked', { name: toastName });
    const onSuccess = () => {
      busyRef.current = false;
      onClose();
      onTip?.(message);
    };
    const onError = () => {
      busyRef.current = false;
    };
    if (allowOpenMicrophone) {
      closeRemoteMicrophone({ liveID, userID: targetUserID, onSuccess, onError });
    } else {
      openRemoteMicrophone({ liveID, userID: targetUserID, policy: 'UNLOCK_ONLY', onSuccess, onError });
    }
  };

  const disconnectGuest = () => {
    if (!targetUserID || busyRef.current) return;
    busyRef.current = true;
    kickUserOutOfSeat({
      liveID,
      userID: targetUserID,
      onSuccess: () => {
        busyRef.current = false;
        onClose();
      },
      onError: () => {
        busyRef.current = false;
      },
    });
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={DRAWER_HEIGHT}
      overlayOpacity={0.4}
      bgImage={DRAWER_BG}
      bgImageHeight={400}
      padding="0 40rpx 0 40rpx"
      showHandle
      useSafeBottom
    >
      <Text style={styles.title} numberOfLines={1}>
        {t('anchor.manageUserTitle', { name: displayName })}
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={toggleMicrophone}>
          <View style={styles.actionIcon}>
            <Icon name={microphoneOn ? 'micOn' : 'micOff'} style={styles.actionImage} />
          </View>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {microphoneOn ? t('anchor.muteGuestMic') : t('anchor.unmuteGuestMic')}
          </Text>
        </Pressable>
        <Pressable style={styles.action} onPress={disconnectGuest}>
          <View style={styles.actionIcon}>
            <Icon name="disconnect" style={styles.actionImage} />
          </View>
          <Text style={[styles.actionLabel, styles.danger]} numberOfLines={1}>
            {t('anchor.disconnectGuest')}
          </Text>
        </Pressable>
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: {
    alignSelf: 'stretch',
    height: rpxToPx(44),
    lineHeight: rpxToPx(44),
    textAlign: 'center',
    color: T.darkTextPrimary,
    fontSize: rpxToPx(32),
    fontWeight: '600',
  },
  actions: {
    width: rpxToPx(400),
    marginTop: rpxToPx(42),
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  action: {
    width: rpxToPx(160),
    flexDirection: 'column',
    alignItems: 'center',
  },
  actionIcon: {
    width: rpxToPx(88),
    height: rpxToPx(88),
    borderRadius: rpxToPx(44),
    backgroundColor: T.darkSurface08,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionImage: {
    width: rpxToPx(44),
    height: rpxToPx(44),
  },
  actionLabel: {
    marginTop: rpxToPx(14),
    height: rpxToPx(32),
    lineHeight: rpxToPx(32),
    textAlign: 'center',
    color: T.darkText75,
    fontSize: rpxToPx(22),
  },
  danger: {
    color: '#ff9095',
  },
});

export default CoGuestManagePanel;
