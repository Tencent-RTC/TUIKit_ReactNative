import { memo, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../Common';
import { useLiveAudienceState } from '../../../atomic-x';
import { isUserFollowed, toggleUserFollowed } from '../../../utils';
import { levelBadgeSource } from '../../BarrageList/levelBadge';
import { Drawer, Icon, rpxToPx } from '../../Common';
import { useLiveAudienceListTranslation } from '../locales';
import type { AudienceUserInfo } from '../LiveAudienceList';

export interface AudienceActionPanelProps {
  visible?: boolean;
  onClose?: () => void;
  userInfo?: AudienceUserInfo | null;
  liveID: string;
  onTip?: (title: string) => void;
}

const DRAWER_BG = require('../../../static/assets/live/drawer-bg.png');
const DEFAULT_AVATAR = require('../../../static/assets/live/default-avatar.png');
const DRAWER_HEIGHT = 560;

export const AudienceActionPanel = memo(function AudienceActionPanel({
  visible = false,
  onClose,
  userInfo,
  liveID,
  onTip,
}: AudienceActionPanelProps) {
  const { t } = useLiveAudienceListTranslation();
  const { kickUserOutOfRoom, disableSendMessage, messageBannedUserList } =
    useLiveAudienceState(liveID);

  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [pendingMute, setPendingMute] = useState<boolean | null>(null);

  const userID = userInfo?.userID;
  const userName = userInfo?.userName || userID || '';
  const userLevel = Number(userInfo?.level);
  const giftValue = Math.max(0, Math.floor(Number(userInfo?.giftValue) || 0));

  const mutedByList = useMemo(
    () => (messageBannedUserList || []).some((u) => u?.userID === userID),
    [messageBannedUserList, userID]
  );
  const isMuted = pendingMute === null ? mutedByList : pendingMute;

  useEffect(() => {
    setAvatarFailed(false);
  }, [userID]);

  useEffect(() => {
    if (visible) {
      setIsFollowed(isUserFollowed(userID));
      setPendingMute(null);
    }
  }, [visible, userID]);

  useEffect(() => {
    setPendingMute(null);
  }, [mutedByList]);

  const avatarSource =
    !avatarFailed && userInfo?.avatarURL
      ? { uri: userInfo.avatarURL }
      : DEFAULT_AVATAR;

  const toggleFollow = () => {
    if (!userID) return;
    setIsFollowed(toggleUserFollowed(userID));
  };

  const toggleMute = () => {
    if (!userID) return;
    const next = !isMuted;
    setPendingMute(next);
    disableSendMessage({
      liveID,
      userID,
      isDisable: next,
      onError: (error) => {
        setPendingMute(null);
        console.log(`disableSendMessage fail: ${String(error)}`);
      },
    });
  };

  const kickOut = () => {
    if (!userID) return;
    const name = userName;
    kickUserOutOfRoom({
      liveID,
      userID,
      onSuccess: () => {
        onClose?.();
        onTip?.(t('al.kickedOut', { name }));
      },
      onError: (error) => {
        console.error(`kickUserOutOfRoom fail: ${String(error)}`);
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
      bgImageHeight={DRAWER_HEIGHT}
      padding="20rpx 36rpx 56rpx"
      showHandle
    >
      <View style={styles.profile}>
        <Image
          style={styles.avatar}
          source={avatarSource}
          resizeMode="cover"
          onError={() => setAvatarFailed(true)}
        />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {userName}
            </Text>
            {userLevel >= 0 && (
              <View style={styles.level}>
                <Image
                  style={styles.levelBg}
                  source={levelBadgeSource(userLevel)}
                  resizeMode="stretch"
                />
                <Text style={styles.levelNum}>{userLevel}</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {t('al.giftValue', { value: giftValue })}
          </Text>
        </View>
        <Pressable
          style={[styles.followPill, isFollowed && styles.followPillActive]}
          onPress={toggleFollow}
        >
          <Text
            style={[styles.followLabel, isFollowed && styles.followLabelActive]}
          >
            {isFollowed ? t('al.followed') : t('al.follow')}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>{t('al.roomManagement')}</Text>
      <View style={styles.actions}>
        <Pressable
          style={[styles.action, isMuted && styles.muteActive]}
          onPress={toggleMute}
        >
          <View style={[styles.actionIcon, styles.muteIconBg]}>
            <Icon
              name={isMuted ? 'viewerMute' : 'viewerComment'}
              style={styles.actionIconImage}
            />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>
              {isMuted ? t('al.unmute') : t('al.mute')}
            </Text>
            <Text
              style={[styles.actionDesc, isMuted && styles.actionDescActive]}
              numberOfLines={1}
            >
              {t('al.muteCopy')}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.action, styles.blockAction]}
          onPress={kickOut}
        >
          <View style={[styles.actionIcon, styles.blockIconBg]}>
            <Icon name="viewerBlock" style={styles.actionIconImage} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>{t('al.block')}</Text>
            <Text style={styles.actionDesc} numberOfLines={1}>
              {t('al.blockCopy')}
            </Text>
          </View>
        </Pressable>
      </View>
    </Drawer>
  );
});

const styles = StyleSheet.create({
  profile: {
    width: rpxToPx(678),
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: rpxToPx(8),
    paddingBottom: rpxToPx(24),
  },
  avatar: {
    width: rpxToPx(116),
    height: rpxToPx(116),
    borderRadius: rpxToPx(58),
    borderWidth: rpxToPx(4),
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginRight: rpxToPx(24),
    flexShrink: 0,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: rpxToPx(34),
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  level: {
    position: 'relative',
    width: rpxToPx(68),
    height: rpxToPx(30),
    marginLeft: rpxToPx(12),
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  levelBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: rpxToPx(68),
    height: rpxToPx(30),
  },
  levelNum: {
    color: '#ffffff',
    fontSize: rpxToPx(18),
    fontWeight: '800',
    lineHeight: rpxToPx(30),
    marginRight: rpxToPx(12),
    textAlign: 'center',
    minWidth: rpxToPx(24),
  },
  meta: {
    color: 'rgba(255, 255, 255, 0.46)',
    fontSize: rpxToPx(24),
    marginTop: rpxToPx(14),
  },
  followPill: {
    minWidth: rpxToPx(108),
    height: rpxToPx(54),
    paddingHorizontal: rpxToPx(22),
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(74, 158, 255, 0.42)',
    borderRadius: rpxToPx(999),
    backgroundColor: 'rgba(74, 158, 255, 0.16)',
    marginLeft: rpxToPx(24),
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followPillActive: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.065)',
  },
  followLabel: {
    fontSize: rpxToPx(22),
    fontWeight: '600',
    color: '#8ECFFF',
  },
  followLabelActive: {
    color: 'rgba(255, 255, 255, 0.64)',
  },
  sectionTitle: {
    width: rpxToPx(678),
    color: 'rgba(255, 255, 255, 0.42)',
    fontSize: rpxToPx(22),
    fontWeight: '600',
    marginTop: rpxToPx(20),
    marginBottom: rpxToPx(18),
  },
  actions: {
    width: rpxToPx(678),
    flexDirection: 'row',
  },
  action: {
    flex: 1,
    minHeight: rpxToPx(164),
    paddingVertical: rpxToPx(24),
    paddingHorizontal: rpxToPx(20),
    borderRadius: rpxToPx(28),
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    marginRight: rpxToPx(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockAction: {
    marginRight: 0,
  },
  muteActive: {
    borderColor: 'rgba(218, 158, 55, 0.34)',
    backgroundColor: 'rgba(151, 101, 27, 0.14)',
  },
  actionIcon: {
    width: rpxToPx(72),
    height: rpxToPx(72),
    borderRadius: rpxToPx(22),
    marginRight: rpxToPx(18),
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteIconBg: {
    backgroundColor: 'rgba(218, 158, 55, 0.12)',
  },
  blockIconBg: {
    backgroundColor: 'rgba(196, 68, 80, 0.13)',
  },
  actionIconImage: {
    width: rpxToPx(42),
    height: rpxToPx(42),
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
  },
  actionTitle: {
    fontSize: rpxToPx(28),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: rpxToPx(8),
  },
  actionDesc: {
    fontSize: rpxToPx(20),
    color: 'rgba(255, 255, 255, 0.44)',
  },
  actionDescActive: {
    color: 'rgba(255, 255, 255, 0.62)',
  },
});

export default AudienceActionPanel;
