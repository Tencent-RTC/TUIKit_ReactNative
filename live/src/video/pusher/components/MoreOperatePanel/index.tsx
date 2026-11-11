import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  AudioEffectPanel,
  BeautyPanel,
  DeviceStatus,
  Drawer,
  Icon,
  MirrorType,
  useDeviceState,
  useLiveListState,
  useLiveSeatState,
  type IconName,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx, DRAWER_BG, isDeviceStatusOff, pusherSession } from '../../../../utils';

export interface MoreOperatePanelProps {
  visible: boolean;
  onClose: () => void;
  liveID?: string;
  onTip?: (title: string) => void;
  onPause?: () => void;
  onComment?: () => void;
}

const DRAWER_HEIGHT = 750;

interface CapProps {
  icon: IconName;
  label: string;
  mirrored?: boolean;
  onPress: () => void;
}

function Cap({ icon, label, mirrored = false, onPress }: CapProps) {
  return (
    <Pressable style={styles.cap} onPress={onPress}>
      <View style={styles.capIcon}>
        <Icon name={icon} style={[styles.capImage, mirrored && styles.mirrored]} />
      </View>
      <Text style={styles.capLabel}>{label}</Text>
    </Pressable>
  );
}

export const MoreOperatePanel = memo(function MoreOperatePanel({ visible, onClose, liveID: liveIDProp, onTip, onPause, onComment }: MoreOperatePanelProps) {
  const { t } = useLiveTranslation();
  const { isFrontCamera, switchCamera, switchMirror, localMirrorType, microphoneStatus } = useDeviceState();
  const { currentLive } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { seatList, muteMicrophone, unmuteMicrophone } = useLiveSeatState(liveID);
  const [beautyVisible, setBeautyVisible] = useState(false);
  const [audioEffectVisible, setAudioEffectVisible] = useState(false);

  const mirrorEnabled = localMirrorType === MirrorType.AUTO || localMirrorType === MirrorType.ENABLE;
  const anchorUserID = String(currentLive?.liveOwner?.userID || '');
  const selfSeat = (seatList || []).find((s) => s?.userInfo?.userID === anchorUserID);
  const seatMicStatus = selfSeat?.userInfo?.microphoneStatus;
  const micEnabled =
    seatMicStatus !== undefined && seatMicStatus !== null
      ? !isDeviceStatusOff(seatMicStatus)
      : microphoneStatus === DeviceStatus.ON;

  const handlePause = () => {
    onClose();
    onPause?.();
  };

  const handleMic = () => {
    pusherSession.selfMuted = micEnabled;
    if (micEnabled) {
      muteMicrophone({ liveID });
    } else {
      unmuteMicrophone({ liveID });
    }
  };

  const handleBeauty = () => {
    setBeautyVisible(true);
    onClose();
  };

  const handleAudioEffect = () => {
    setAudioEffectVisible(true);
    onClose();
  };

  const handleCamera = () => switchCamera({ isFront: !isFrontCamera });

  const handleMirror = () => {
    if (!isFrontCamera) {
      onTip?.(t('morePanel.frontOnly'));
      return;
    }
    switchMirror({ mirrorType: mirrorEnabled ? MirrorType.DISABLE : MirrorType.ENABLE });
  };

  const handleComments = () => {
    onComment?.();
    onClose();
  };

  const handleShare = () => {
    if (!liveID) return;
    Clipboard.setString(liveID);
    onClose();
    onTip?.(t('morePanel.shareCopied', { id: liveID }));
  };

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        height={DRAWER_HEIGHT}
        overlayOpacity={0.4}
        bgImage={DRAWER_BG}
        bgImageHeight={DRAWER_HEIGHT}
        padding="20rpx 36rpx 48rpx"
      >
        <View style={styles.group}>
          <View style={styles.list}>
            <Cap icon="pause" label={t('morePanel.pauseLive')} onPress={handlePause} />
            <Cap
              icon={micEnabled ? 'micOn' : 'micOff'}
              label={micEnabled ? t('morePanel.mute') : t('morePanel.unmute')}
              onPress={handleMic}
            />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('morePanel.basicSettings')}</Text>
          <View style={styles.list}>
            <Cap icon="beauty" label={t('morePanel.beauty')} onPress={handleBeauty} />
            <Cap icon="mirror" label={t('morePanel.mirror')} mirrored={!mirrorEnabled} onPress={handleMirror} />
            <Cap icon="flip" label={t('morePanel.flip')} onPress={handleCamera} />
            <Cap icon="audioEffect" label={t('morePanel.soundEffect')} onPress={handleAudioEffect} />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.groupTitle}>{t('morePanel.interactiveFeatures')}</Text>
          <View style={styles.list}>
            <Cap icon="comment" label={t('morePanel.comments')} onPress={handleComments} />
            <Cap icon="share" label={t('morePanel.share')} onPress={handleShare} />
          </View>
        </View>
      </Drawer>
      <BeautyPanel visible={beautyVisible} onClose={() => setBeautyVisible(false)} />
      <AudioEffectPanel visible={audioEffectVisible} onClose={() => setAudioEffectVisible(false)} />
    </>
  );
});

const styles = StyleSheet.create({
  group: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    marginBottom: rpxToPx(36),
  },
  list: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  groupTitle: {
    color: T.darkText50,
    fontSize: rpxToPx(24),
    lineHeight: rpxToPx(36),
    fontWeight: '500',
    marginHorizontal: rpxToPx(8),
    marginBottom: rpxToPx(24),
  },
  cap: {
    width: rpxToPx(136),
    flexDirection: 'column',
    alignItems: 'center',
  },
  capIcon: {
    width: rpxToPx(88),
    height: rpxToPx(88),
    borderRadius: rpxToPx(44),
    backgroundColor: T.darkSurface08,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rpxToPx(16),
  },
  capImage: {
    width: rpxToPx(44),
    height: rpxToPx(44),
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
  capLabel: {
    fontSize: rpxToPx(22),
    lineHeight: rpxToPx(32),
    color: T.darkText75,
    textAlign: 'center',
  },
});

export default MoreOperatePanel;
