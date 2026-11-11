import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../Common';
import { isUserFollowed, toggleUserFollowed } from '../../../utils';
import { Drawer, rpxToPx } from '../../Common';
import { useLiveAudienceListTranslation } from '../locales';
import type { AudienceUserInfo } from '../LiveAudienceList';

export interface AudienceProfilePanelProps {
  visible?: boolean;
  onClose?: () => void;
  userInfo?: AudienceUserInfo | null;
}

const DRAWER_BG = require('../../../static/assets/live/drawer-bg.png');
const DEFAULT_AVATAR = require('../../../static/assets/live/default-avatar.png');
const DRAWER_HEIGHT = 460;

export function AudienceProfilePanel({
  visible = false,
  onClose,
  userInfo,
}: AudienceProfilePanelProps) {
  const { t } = useLiveAudienceListTranslation();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const userID = userInfo?.userID;

  useEffect(() => {
    setAvatarFailed(false);
  }, [userID]);

  useEffect(() => {
    if (visible) {
      setIsFollowing(isUserFollowed(userID));
    }
  }, [visible, userID]);

  const avatarSource =
    !avatarFailed && userInfo?.avatarURL
      ? { uri: userInfo.avatarURL }
      : DEFAULT_AVATAR;

  const toggleFollow = () => {
    if (!userID) return;
    setIsFollowing(toggleUserFollowed(userID));
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={DRAWER_HEIGHT}
      overlayOpacity={0.4}
      bgImage={DRAWER_BG}
      bgImageHeight={DRAWER_HEIGHT}
      padding="0 40rpx 60rpx 40rpx"
      showHandle
    >
      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          <Image
            style={styles.avatar}
            source={avatarSource}
            resizeMode="cover"
            onError={() => setAvatarFailed(true)}
          />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {userInfo?.userName || userInfo?.userID || ''}
        </Text>
        <Pressable
          style={[styles.follow, isFollowing && styles.followActive]}
          onPress={toggleFollow}
        >
          <Text
            style={[styles.followText, isFollowing && styles.followTextActive]}
          >
            {isFollowing ? t('al.followed') : t('al.follow')}
          </Text>
        </Pressable>
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  body: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: rpxToPx(20),
  },
  avatarWrap: {
    width: rpxToPx(128),
    height: rpxToPx(128),
    borderRadius: rpxToPx(64),
    overflow: 'hidden',
    marginBottom: rpxToPx(24),
  },
  avatar: {
    width: rpxToPx(128),
    height: rpxToPx(128),
    borderRadius: rpxToPx(64),
  },
  name: {
    color: '#ffffff',
    fontSize: rpxToPx(34),
    fontWeight: '600',
    marginBottom: rpxToPx(48),
    maxWidth: rpxToPx(560),
    textAlign: 'center',
  },
  follow: {
    width: rpxToPx(560),
    height: rpxToPx(88),
    borderRadius: rpxToPx(44),
    backgroundColor: '#396cff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  followText: {
    color: '#ffffff',
    fontSize: rpxToPx(30),
    fontWeight: '600',
  },
  followTextActive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default AudienceProfilePanel;
