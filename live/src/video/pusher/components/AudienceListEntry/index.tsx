import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import {
  useGiftState,
  useLiveAudienceState,
  useLiveListState,
  type LiveUserInfoParam,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation, type LiveTranslate } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx, normalizeAvatarURL, parseMaybeJson } from '../../../../utils';

export interface AudienceListEntryProps {
  liveID?: string;
  onAudienceTap?: () => void;
}

const DEFAULT_AVATAR = require('../../../../static/assets/live/default-avatar.png');
const RANKED_AVATAR_COUNT = 3;
const GIFT_LISTENER_ID = 'PusherAudienceListEntry';

const RANK_STYLES = [
  { score: undefined, text: undefined },
  { score: { backgroundColor: T.darkBgControlStrong }, text: { color: T.colorTintFrost } },
  { score: { backgroundColor: T.colorBrownSoft }, text: { color: T.colorTintPeach } },
];

const formatCountValue = (value: number, t: LiveTranslate): string => {
  const v = Math.max(0, Math.floor(Number(value) || 0));
  if (v >= 100000) return `10${t('common.wanUnit')}+`;
  if (v >= 10000) return `${Math.floor(v / 10000)}${t('common.wanUnit')}+`;
  return String(v);
};

export const AudienceListEntry = memo(function AudienceListEntry({ liveID: liveIDProp, onAudienceTap }: AudienceListEntryProps) {
  const { t } = useLiveTranslation();
  const { currentLive } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { audienceList, audienceCount, fetchAudienceList } = useLiveAudienceState(liveID);
  const { addGiftListener, removeGiftListener } = useGiftState(liveID);
  const [failedAvatarIDs, setFailedAvatarIDs] = useState<Record<string, boolean>>({});
  const [giftTotals, setGiftTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    if (liveID) fetchAudienceList({ liveID });
  }, [liveID, fetchAudienceList]);

  useEffect(() => {
    if (!liveID) return undefined;
    const onReceiveGift = (event: unknown) => {
      const res = parseMaybeJson<Record<string, unknown>>(event) || {};
      const gift = parseMaybeJson<{ coins?: number }>(res.gift) || {};
      const sender = parseMaybeJson<{ userID?: string }>(res.sender) || {};
      const senderID = sender.userID;
      if (!senderID) return;
      const coins = Number(gift.coins) || 0;
      const count = Number(res.count) || 1;
      setGiftTotals((prev) => ({ ...prev, [senderID]: (prev[senderID] || 0) + coins * count }));
    };
    addGiftListener('onReceiveGift', onReceiveGift, GIFT_LISTENER_ID);
    return () => removeGiftListener('onReceiveGift', GIFT_LISTENER_ID);
  }, [liveID, addGiftListener, removeGiftListener]);

  const list = useMemo(() => audienceList || [], [audienceList]);
  const currentAudienceCount = Number(audienceCount) || 0;

  const ranked = useMemo(() => {
    const scored = list.map((user, order) => ({ user, value: Number(giftTotals[user?.userID] || 0), order }));
    scored.sort((a, b) => b.value - a.value || a.order - b.order);
    return scored.slice(0, RANKED_AVATAR_COUNT);
  }, [list, giftTotals]);

  const avatarOf = (user: LiveUserInfoParam) => {
    const url = normalizeAvatarURL(user?.avatarURL);
    if (!url || (user?.userID && failedAvatarIDs[user.userID])) return DEFAULT_AVATAR;
    return { uri: url };
  };

  const onAvatarError = (user: LiveUserInfoParam) => {
    const id = user?.userID;
    if (!id || failedAvatarIDs[id]) return;
    setFailedAvatarIDs((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <Pressable style={styles.entry} onPress={onAudienceTap}>
      <View style={styles.avatars}>
        {ranked.map((item, index) => (
          <View key={item.user?.userID || index} style={styles.avatarWrap}>
            <Image
              style={styles.avatar}
              source={avatarOf(item.user)}
              resizeMode="cover"
              onError={() => onAvatarError(item.user)}
            />
            <View style={[styles.score, RANK_STYLES[index]?.score]}>
              <Text style={[styles.scoreText, RANK_STYLES[index]?.text]} numberOfLines={1}>
                {formatCountValue(item.value, t)}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.count}>
        <Text style={styles.countText}>{formatCountValue(currentAudienceCount, t)}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpxToPx(4),
  },
  avatarWrap: {
    position: 'relative',
    width: rpxToPx(64),
    height: rpxToPx(52),
  },
  avatar: {
    width: rpxToPx(52),
    height: rpxToPx(52),
    marginLeft: rpxToPx(6),
    borderRadius: rpxToPx(26),
  },
  score: {
    position: 'absolute',
    left: rpxToPx(2),
    bottom: 0,
    width: rpxToPx(60),
    height: rpxToPx(22),
    borderRadius: rpxToPx(12),
    borderWidth: rpxToPx(2),
    borderColor: T.darkBorder24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rpxToPx(8),
    backgroundColor: T.colorWarningSoft,
  },
  scoreText: {
    color: T.colorTintIvory,
    fontSize: rpxToPx(14),
    fontWeight: '700',
    includeFontPadding: false,
  },
  count: {
    height: rpxToPx(52),
    minWidth: rpxToPx(52),
    borderRadius: rpxToPx(26),
    backgroundColor: T.darkBgOverlay22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rpxToPx(16),
    marginLeft: rpxToPx(8),
  },
  countText: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(24),
    fontWeight: '500',
  },
});

export default AudienceListEntry;
