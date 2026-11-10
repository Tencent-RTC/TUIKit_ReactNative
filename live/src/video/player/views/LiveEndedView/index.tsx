import React from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { Avatar, Icon } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx, useTopBarOffsetPx } from '../../../../utils';

const SHADE_BG = require('../../../../static/images/live/background/live-ended-shade.png');
const DEFAULT_AVATAR_URI = Image.resolveAssetSource(require('../../../../static/assets/live/default-avatar.png')).uri;
const CONTENT_TOP_RATIO = 0.135;

export interface LiveEndedViewProps {
  hostName: string;
  avatarURL: string;
  reason?: string;
  onClose: () => void;
}

export function LiveEndedView({ hostName, avatarURL, reason, onClose }: LiveEndedViewProps) {
  const { t } = useLiveTranslation();
  const { height } = useWindowDimensions();
  const closeTopPx = useTopBarOffsetPx();
  const contentTopPx = Math.round(height * CONTENT_TOP_RATIO);

  return (
    <View style={styles.view}>
      <Image style={[styles.bg, { height }]} source={SHADE_BG} resizeMode="stretch" />
      <Pressable style={[styles.close, { top: closeTopPx }]} onPress={onClose}>
        <Icon name="close" style={styles.closeIcon} />
      </Pressable>
      <View style={[styles.content, { top: contentTopPx }]}>
        <Text style={styles.title}>{reason || t('audience.liveEnded')}</Text>
        <View style={styles.avatar}>
          <Avatar src={avatarURL || DEFAULT_AVATAR_URI} name={hostName} size={160} shape="circle" pureMode />
        </View>
        <Text style={styles.host} numberOfLines={1}>
          {hostName}
        </Text>
        <Text style={styles.copy}>{t('audience.liveEndedCopy')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  view: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#06080d',
    zIndex: 2000,
    elevation: 2000,
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpxToPx(750),
  },
  close: {
    position: 'absolute',
    right: rpxToPx(36),
    width: rpxToPx(68),
    height: rpxToPx(68),
    borderRadius: rpxToPx(34),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: rpxToPx(46),
    height: rpxToPx(46),
  },
  content: {
    position: 'absolute',
    left: rpxToPx(56),
    right: rpxToPx(56),
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(54),
    fontWeight: '600',
    lineHeight: rpxToPx(68),
    letterSpacing: rpxToPx(0.8),
  },
  avatar: {
    marginTop: rpxToPx(72),
    width: rpxToPx(172),
    height: rpxToPx(172),
    borderRadius: rpxToPx(86),
    borderWidth: rpxToPx(6),
    borderColor: T.darkBorder90,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  host: {
    marginTop: rpxToPx(34),
    color: T.darkTextPrimary,
    fontSize: rpxToPx(40),
    fontWeight: '600',
    lineHeight: rpxToPx(56),
  },
  copy: {
    marginTop: rpxToPx(14),
    color: T.darkText60,
    fontSize: rpxToPx(28),
    lineHeight: rpxToPx(42),
  },
});

export default LiveEndedView;
