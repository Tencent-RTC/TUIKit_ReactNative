import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { rpxToPx } from '../../../utils/unitUtils';

export type AvatarShape = 'circle' | 'square';
export type AvatarDefaultType =
  | 'none'
  | 'user'
  | 'work'
  | 'public'
  | 'meeting'
  | 'avchatroom';

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: number;
  showOnline?: boolean;
  badgeCount?: number;
  showBadgeDot?: boolean;
  shape?: AvatarShape;
  defaultAvatarType?: AvatarDefaultType;
  pureMode?: boolean;
  lazy?: boolean;
}

const DEFAULT_AVATAR_URLS: Record<
  Exclude<AvatarDefaultType, 'none'>,
  string
> = {
  user: 'https://web.sdk.qcloud.com/im/assets/all-in-one/user.png',
  work: 'https://web.sdk.qcloud.com/im/assets/all-in-one/work.png',
  public: 'https://web.sdk.qcloud.com/im/assets/all-in-one/public.png',
  meeting: 'https://web.sdk.qcloud.com/im/assets/all-in-one/meeting.png',
  avchatroom: 'https://web.sdk.qcloud.com/im/assets/all-in-one/avchatroom.png',
};

function getFirstChar(name: string): string {
  if (!name) return '?';
  const match = name.match(/[一-龥]|[a-zA-Z]|[0-9]/);
  return match ? match[0].toUpperCase() : '?';
}

export function Avatar({
  src = '',
  name = '',
  size = 96,
  showOnline = false,
  badgeCount = 0,
  showBadgeDot = false,
  shape = 'square',
  defaultAvatarType = 'none',
  pureMode = false,
  lazy = false,
}: AvatarProps) {
  const [avatarSrc, setAvatarSrc] = useState(lazy ? '' : src);

  useEffect(() => {
    if (!lazy || !src) {
      setAvatarSrc(src);
      return undefined;
    }
    const timer = setTimeout(() => setAvatarSrc(src), 0);
    return () => clearTimeout(timer);
  }, [src, lazy]);

  const defaultAvatarUrl =
    defaultAvatarType === 'none'
      ? ''
      : DEFAULT_AVATAR_URLS[defaultAvatarType] ?? '';
  const imageUrl = avatarSrc || defaultAvatarUrl;

  const sizePx = rpxToPx(size);
  const avatarStyle = {
    width: sizePx,
    height: sizePx,
    borderRadius: shape === 'circle' ? sizePx / 2 : rpxToPx(10),
  };

  return (
    <View style={[styles.container, pureMode && styles.pureMode]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, avatarStyle]}
          resizeMode="cover"
          onError={() => setAvatarSrc('')}
        />
      ) : (
        <View style={[styles.defaultAvatar, avatarStyle]}>
          <Text
            style={[styles.text, { fontSize: rpxToPx(Math.floor(size * 0.4)) }]}
          >
            {getFirstChar(name)}
          </Text>
        </View>
      )}

      {showOnline && <View style={styles.onlineIndicator} />}

      {badgeCount > 0 && (
        <View style={[styles.badge, showBadgeDot && styles.badgeDot]}>
          {!showBadgeDot && (
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: rpxToPx(10),
  },
  pureMode: {
    padding: 0,
  },
  image: {
    backgroundColor: '#f5f5f5',
  },
  defaultAvatar: {
    backgroundColor: '#EBF3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '500',
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.9)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: rpxToPx(20),
    height: rpxToPx(20),
    borderRadius: rpxToPx(10),
    backgroundColor: '#4CAF50',
    borderWidth: rpxToPx(2),
    borderColor: '#ffffff',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff4444',
    minWidth: rpxToPx(36),
    height: rpxToPx(36),
    borderRadius: rpxToPx(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeDot: {
    minWidth: 0,
    width: rpxToPx(20),
    height: rpxToPx(20),
    borderRadius: rpxToPx(10),
  },
  badgeText: {
    minWidth: rpxToPx(24),
    fontWeight: '500',
    fontSize: rpxToPx(24),
    lineHeight: rpxToPx(24),
    textAlign: 'center',
    color: '#ffffff',
  },
});

export default Avatar;
