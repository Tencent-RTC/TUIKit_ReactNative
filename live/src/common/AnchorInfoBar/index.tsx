import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, ImageSourcePropType, Pressable, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import {
  isUserFollowed,
  toggleUserFollowed,
  useLikeState,
  useLiveListState,
  useLoginState,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation, type LiveTranslate } from '../../locales';
import { styles } from './styles';

const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');
const FAN_CLUB_ICON = require('../../static/images/live/icon/fan-club.png');

export type AnchorInfoBarRole = 'anchor' | 'audience';

export interface AnchorInfoBarProps {
  role?: AnchorInfoBarRole | string;
  liveID?: string;
  onFanClubTap?: () => void;
}

const normalizeAvatar = (url: unknown): string => {
  const s = (url == null ? '' : String(url)).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
};

const formatViewCount = (n: number, t: LiveTranslate): string => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 100000) return `${Math.floor(v / 10000)}${t('common.wanUnit')}+`;
  if (v >= 10000) {
    const w = v / 10000;
    return `${w >= 10 ? Math.floor(w) : Math.round(w * 10) / 10}${t('common.wanUnit')}`;
  }
  return String(v);
};

function useAvatarSource(url: string): { source: ImageSourcePropType; onError: () => void } {
  const [failedURL, setFailedURL] = useState('');
  const source = useMemo<ImageSourcePropType>(
    () => (url && url !== failedURL ? { uri: url } : DEFAULT_AVATAR),
    [url, failedURL],
  );
  return { source, onError: () => setFailedURL(url) };
}

export const AnchorInfoBar = memo(function AnchorInfoBar({ role, liveID: liveIDProp, onFanClubTap }: AnchorInfoBarProps) {
  const { t } = useLiveTranslation();
  const { loginUserInfo } = useLoginState();
  const { currentLive } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { totalLikeCount } = useLikeState(liveID);
  const likeCountText = formatViewCount(totalLikeCount, t);

  const anchorAvatar = useAvatarSource(normalizeAvatar(loginUserInfo?.avatarURL));

  const owner = currentLive?.liveOwner;
  const ownerID = owner?.userID;
  const [hostAvatarURL, setHostAvatarURL] = useState('');
  const [hostName, setHostName] = useState('');
  const [isFollowingHost, setIsFollowingHost] = useState(false);
  const hostAvatar = useAvatarSource(hostAvatarURL);

  useEffect(() => {
    const url = normalizeAvatar(owner?.avatarURL);
    if (url) setHostAvatarURL(url);
  }, [owner?.avatarURL]);

  useEffect(() => {
    const name = owner?.userName || owner?.userID || '';
    if (name) setHostName(name);
  }, [owner?.userName, owner?.userID]);

  useEffect(() => {
    if (ownerID) setIsFollowingHost(isUserFollowed(ownerID));
  }, [ownerID]);

  const toggleFollowHost = () => {
    if (!ownerID) return;
    setIsFollowingHost(toggleUserFollowed(ownerID));
  };

  if (role === 'anchor') {
    const anchorName = loginUserInfo?.nickname || loginUserInfo?.userID || '';
    return (
      <View style={styles.anchorInfo}>
        <Image
          style={styles.anchorAvatar}
          source={anchorAvatar.source}
          resizeMode="cover"
          onError={anchorAvatar.onError}
        />
        <View style={styles.anchorCopy}>
          <Text style={styles.anchorName} numberOfLines={1}>
            {t('anchor.hostLive', { name: anchorName })}
          </Text>
          <Text style={styles.anchorMeta} numberOfLines={1}>
            {t('anchor.likeCount', { count: likeCountText })}
          </Text>
        </View>
        <Pressable style={styles.fanClubButton} onPress={onFanClubTap}>
          <Image style={styles.fanClubIcon} source={FAN_CLUB_ICON} resizeMode="stretch" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.streamInfo}>
      <Image
        style={styles.streamAvatar}
        source={hostAvatar.source}
        resizeMode="cover"
        onError={hostAvatar.onError}
      />
      <View style={styles.streamDetails}>
        <Text style={styles.streamTitle} numberOfLines={1}>
          {t('audience.hostLive', { name: hostName })}
        </Text>
        <Text style={styles.streamMeta} numberOfLines={1}>
          {t('audience.likeCount', { count: likeCountText })}
        </Text>
      </View>
      <Pressable
        style={[styles.followButton, isFollowingHost && styles.followButtonFollowing]}
        onPress={toggleFollowHost}
      >
        <Text style={[styles.followText, isFollowingHost && styles.followTextFollowing]}>
          {isFollowingHost ? t('audience.followed') : t('audience.follow')}
        </Text>
      </Pressable>
    </View>
  );
});

export default AnchorInfoBar;
