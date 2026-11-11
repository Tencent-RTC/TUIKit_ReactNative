import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../Common';
import { Drawer, rpxToPx } from '../Common';
import { useLiveStreamViewTranslation } from './locales';

const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');

export interface UserInfoPanelUser {
  userID?: string;
  userName?: string;
  avatarURL?: string;
  liveID?: string;
  roomId?: string;
  [key: string]: unknown;
}

export interface UserInfoPanelProps {
  visible?: boolean;
  onClose?: () => void;
  userInfo?: UserInfoPanelUser | null;
  isShowAnchor?: boolean;
}

export const UserInfoPanel = memo(function UserInfoPanel({
  visible = false,
  onClose,
  userInfo,
  isShowAnchor = true,
}: UserInfoPanelProps) {
  const { t } = useLiveStreamViewTranslation();
  const displayName = userInfo?.userName || userInfo?.userID || '';

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={400}
      borderRadius={32}
      overlayOpacity={0.8}
      padding="0"
      showHandle={false}
      showGlow={false}
    >
      <View style={styles.drawer}>
        <View style={styles.avatarContainer}>
          <Image
            style={styles.avatar}
            source={
              userInfo?.avatarURL ? { uri: userInfo.avatarURL } : DEFAULT_AVATAR
            }
            resizeMode="cover"
          />
        </View>
        <View style={styles.userInfoContainer}>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.userRoomId}>
            {isShowAnchor
              ? `${t('sv.roomId')}${userInfo?.liveID || userInfo?.roomId || ''}`
              : `UserId：${userInfo?.userID || ''}`}
          </Text>
        </View>
      </View>
    </Drawer>
  );
});

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: rpxToPx(20),
    backgroundColor: 'rgba(34, 38, 46, 1)',
  },
  avatarContainer: {
    position: 'absolute',
    top: rpxToPx(20),
    width: rpxToPx(200),
    height: rpxToPx(120),
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: rpxToPx(112),
    height: rpxToPx(112),
    borderRadius: rpxToPx(56),
  },
  userInfoContainer: {
    flex: 1,
    paddingTop: rpxToPx(120),
    alignItems: 'center',
  },
  userName: {
    fontSize: rpxToPx(32),
    color: 'rgba(255, 255, 255, 0.9)',
    maxWidth: rpxToPx(600),
  },
  userRoomId: {
    fontSize: rpxToPx(24),
    color: 'rgba(255, 255, 255, 0.55)',
    marginVertical: rpxToPx(20),
  },
});
