import React, { memo, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { useLiveAudienceState, useLiveListState } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation, type LiveTranslate } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { normalizeAvatarURL, rpxToPx } from '../../../../utils';

const DEFAULT_AVATAR = require('../../../../static/assets/live/default-avatar.png');
const MAX_AVATARS = 3;

export interface AudienceListEntryProps {
  onAudienceTap?: () => void;
}

const formatOnlineCount = (n: number, t: LiveTranslate): string => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 10000) return `${Math.min(10, Math.floor(v / 10000))}${t('common.wanUnit')}+`;
  return String(v);
};

export const AudienceListEntry = memo(function AudienceListEntry({ onAudienceTap }: AudienceListEntryProps) {
  const { t } = useLiveTranslation();
  const { currentLive } = useLiveListState();
  const liveID = String(currentLive?.liveID || '');
  const { audienceList, audienceCount, fetchAudienceList } = useLiveAudienceState(liveID);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, true>>({});

  useEffect(() => {
    if (liveID) fetchAudienceList({ liveID });
  }, [liveID, fetchAudienceList]);

  const list = audienceList || [];
  const currentAudienceCount = Number(audienceCount) || 0;
  const avatarListReversed = list.slice(0, MAX_AVATARS).reverse();

  return (
    <Pressable style={styles.entry} onPress={onAudienceTap}>
      <View style={styles.avatars}>
        {avatarListReversed.map((user, index) => {
          const url = normalizeAvatarURL(user?.avatarURL);
          const key = user?.userID || String(index);
          return (
            <View key={key} style={[styles.avatarWrap, index > 0 && styles.avatarOverlap]}>
              <Image
                style={styles.avatar}
                source={url && !failedAvatars[key] ? { uri: url } : DEFAULT_AVATAR}
                resizeMode="cover"
                onError={() => setFailedAvatars(prev => ({ ...prev, [key]: true }))}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.count}>
        <Text style={styles.countText}>{formatOnlineCount(currentAudienceCount, t)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatars: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  avatarWrap: {
    width: rpxToPx(52),
    height: rpxToPx(52),
    borderRadius: rpxToPx(26),
    overflow: 'hidden',
    borderWidth: rpxToPx(2),
    borderColor: T.darkBorder90,
    backgroundColor: T.mask20,
  },
  avatarOverlap: {
    marginRight: rpxToPx(-18),
  },
  avatar: {
    width: rpxToPx(48),
    height: rpxToPx(48),
    borderRadius: rpxToPx(24),
  },
  count: {
    height: rpxToPx(52),
    minWidth: rpxToPx(52),
    borderRadius: rpxToPx(26),
    backgroundColor: T.darkBgOverlay35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rpxToPx(16),
    marginLeft: rpxToPx(12),
  },
  countText: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(24),
    fontWeight: '500',
  },
});

export default AudienceListEntry;
