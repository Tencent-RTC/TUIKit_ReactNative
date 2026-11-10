import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../Common';
import {
  useGiftState,
  useLiveAudienceState,
  useLiveListState,
  useLoginState,
} from '../../../atomic-x';
import { heightPercentToRpx } from '../../../utils';
import { levelBadgeSource } from '../../BarrageList/levelBadge';
import { Drawer, Toast, rpxToPx } from '../../Common';
import { AudienceActionPanel } from '../AudienceActionPanel';
import { AudienceProfilePanel } from '../AudienceProfilePanel';
import { useLiveAudienceListTranslation } from '../locales';

export interface AudienceUserInfo {
  userID: string;
  userName?: string;
  avatarURL?: string;
  level?: number | string;
  giftValue?: number | string;
  [key: string]: unknown;
}

export interface LiveAudienceListProps {
  visible?: boolean;
  onClose?: () => void;
  liveID?: string;
  onOverlayActiveChange?: (active: boolean) => void;
}

const DRAWER_BG = require('../../../static/assets/live/drawer-bg.png');
const DEFAULT_AVATAR = require('../../../static/assets/live/default-avatar.png');
const ROW_H = 169;
const DRAWER_HANDLE_H = 76;
const DRAWER_HEADER_H = 80;
const DRAWER_BOTTOM_PAD = 44;
const TIP_DURATION = 2000;
const GIFT_LISTENER_ID = 'LiveAudienceList';
// iOS cannot present a Modal while the list drawer's Modal is still dismissing.
const INNER_PANEL_OPEN_DELAY = 340;

const parseMaybeJson = (value: unknown): Record<string, any> => {
  if (typeof value === 'string') return JSON.parse(value);
  return (value as Record<string, any>) || {};
};

export const LiveAudienceList = memo(function LiveAudienceList({
  visible = false,
  onClose,
  liveID: liveIDProp,
  onOverlayActiveChange,
}: LiveAudienceListProps) {
  const { t } = useLiveAudienceListTranslation();
  const { currentLive } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { loginUserInfo } = useLoginState();
  const { audienceList } = useLiveAudienceState(liveID);
  const { addGiftListener, removeGiftListener } = useGiftState(liveID);

  const [myGiftTotal, setMyGiftTotal] = useState(0);
  const [failedAvatarIDs, setFailedAvatarIDs] = useState<
    Record<string, boolean>
  >({});
  const [isShowAudienceActionPanel, setIsShowAudienceActionPanel] =
    useState(false);
  const [isShowAudienceProfilePanel, setIsShowAudienceProfilePanel] =
    useState(false);
  const [selectedAudience, setSelectedAudience] =
    useState<AudienceUserInfo | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  const [tipSeq, setTipSeq] = useState(0);
  const [tipTitle, setTipTitle] = useState('');
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myUserID = loginUserInfo?.userID;
  const isAnchor = !!myUserID && myUserID === currentLive?.liveOwner?.userID;

  const scrollHeightRpx = useMemo(() => {
    const avail =
      heightPercentToRpx(0.6) -
      DRAWER_HANDLE_H -
      DRAWER_HEADER_H -
      DRAWER_BOTTOM_PAD;
    return Math.max(1, Math.floor(avail / ROW_H)) * ROW_H;
  }, []);
  const drawerHeight =
    DRAWER_HANDLE_H + DRAWER_HEADER_H + scrollHeightRpx + DRAWER_BOTTOM_PAD;

  const anyInnerPanelVisible =
    isShowAudienceActionPanel || isShowAudienceProfilePanel;
  const overlayCallbackRef = useRef(onOverlayActiveChange);
  overlayCallbackRef.current = onOverlayActiveChange;
  const overlayMountedRef = useRef(false);
  useEffect(() => {
    if (!overlayMountedRef.current) {
      overlayMountedRef.current = true;
      return;
    }
    overlayCallbackRef.current?.(anyInnerPanelVisible);
  }, [anyInnerPanelVisible]);

  useEffect(() => {
    if (!liveID) return undefined;
    const onReceiveGift = (event?: unknown) => {
      try {
        const res = parseMaybeJson(event);
        const gift = parseMaybeJson(res.gift);
        const sender = parseMaybeJson(res.sender);
        if (!sender.userID || sender.userID !== myUserID) return;
        const coins = Number(gift.coins) || 0;
        const count = Number(res.count) || 1;
        setMyGiftTotal((total) => total + coins * count);
      } catch (e) {
        console.error('onReceiveGift parse error', e);
      }
    };
    addGiftListener('onReceiveGift', onReceiveGift, GIFT_LISTENER_ID);
    return () => removeGiftListener('onReceiveGift', GIFT_LISTENER_ID);
  }, [liveID, myUserID, addGiftListener, removeGiftListener]);

  useEffect(
    () => () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    },
    []
  );

  const avatarOf = (audience: AudienceUserInfo) => {
    if (failedAvatarIDs[audience.userID] || !audience.avatarURL) {
      return DEFAULT_AVATAR;
    }
    return { uri: audience.avatarURL };
  };
  const onAvatarError = (audience: AudienceUserInfo) => {
    const id = audience.userID;
    if (!id) return;
    setFailedAvatarIDs((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  const audLevel = (audience: AudienceUserInfo) => {
    const lv = Number(audience.level);
    if (!isNaN(lv) && lv > 0) return lv;
    if (audience.userID && audience.userID === myUserID) {
      const myLv = Number(loginUserInfo?.level);
      if (!isNaN(myLv) && myLv > 0) return myLv;
    }
    return 0;
  };
  const audGiftValue = (audience: AudienceUserInfo) =>
    audience.userID && audience.userID === myUserID ? myGiftTotal : 0;

  const showTip = useCallback((title: string) => {
    setTipTitle(title);
    setTipSeq((seq) => seq + 1);
    setTipVisible(true);
  }, []);

  const onTapAudience = (audience: AudienceUserInfo) => {
    if (audience.userID && audience.userID === myUserID) {
      showTip(t('al.cannotFollowSelf'));
      return;
    }
    setSelectedAudience(audience);
    onClose?.();
    const openAction = isAnchor;
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      if (openAction) setIsShowAudienceActionPanel(true);
      else setIsShowAudienceProfilePanel(true);
    }, INNER_PANEL_OPEN_DELAY);
  };

  const list = audienceList as AudienceUserInfo[];
  const tip = tipVisible && (
    <Toast
      key={tipSeq}
      visible={tipVisible}
      onClose={() => setTipVisible(false)}
      title={tipTitle}
      duration={TIP_DURATION}
    />
  );

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        height={drawerHeight}
        overlayOpacity={0.4}
        bgImage={DRAWER_BG}
        bgImageHeight={drawerHeight}
        padding="0 32rpx 0 32rpx"
        showHandle
        overlay={visible && tip}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('al.title')}</Text>
        </View>
        <ScrollView
          style={{ height: rpxToPx(scrollHeightRpx) }}
          showsVerticalScrollIndicator={false}
        >
          {list.length > 0 ? (
            <View style={styles.grid}>
              {list.map((audience, index) => {
                const level = audLevel(audience);
                return (
                  <View key={audience.userID} style={styles.rowWrap}>
                    <Pressable
                      style={styles.item}
                      onPress={() => onTapAudience(audience)}
                    >
                      <Text style={styles.marker} numberOfLines={1}>
                        {index + 1}
                      </Text>
                      <View style={styles.avatarContainer}>
                        <Image
                          style={styles.avatar}
                          source={avatarOf(audience)}
                          resizeMode="cover"
                          onError={() => onAvatarError(audience)}
                        />
                      </View>
                      <View style={styles.identity}>
                        <Text style={styles.name} numberOfLines={1}>
                          {audience.userName || audience.userID}
                        </Text>
                        <View style={styles.levelBadge}>
                          <Image
                            style={styles.levelBg}
                            source={levelBadgeSource(level)}
                            resizeMode="stretch"
                          />
                          <Text style={styles.levelNum}>{level}</Text>
                        </View>
                      </View>
                      <Text style={styles.giftValue} numberOfLines={1}>
                        {audGiftValue(audience)}
                      </Text>
                    </Pressable>
                    {index !== list.length - 1 && (
                      <View style={styles.divider}>
                        <View style={styles.dividerLeft} />
                        <View style={styles.dividerRight} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('al.empty')}</Text>
            </View>
          )}
        </ScrollView>
      </Drawer>

      <AudienceActionPanel
        visible={isShowAudienceActionPanel}
        onClose={() => setIsShowAudienceActionPanel(false)}
        userInfo={selectedAudience}
        liveID={liveID}
        onTip={showTip}
      />
      <AudienceProfilePanel
        visible={isShowAudienceProfilePanel}
        onClose={() => setIsShowAudienceProfilePanel(false)}
        userInfo={selectedAudience}
      />
      {!visible && tip}
    </>
  );
});

const styles = StyleSheet.create({
  header: {
    paddingVertical: rpxToPx(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: rpxToPx(80),
  },
  title: {
    fontSize: rpxToPx(30),
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '400',
  },
  grid: {
    flexDirection: 'column',
    width: rpxToPx(686),
  },
  rowWrap: {
    flexDirection: 'column',
    width: rpxToPx(686),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    width: rpxToPx(686),
    height: rpxToPx(168),
  },
  divider: {
    flexDirection: 'row',
    width: rpxToPx(686),
    height: rpxToPx(1),
  },
  dividerLeft: {
    flex: 1,
    height: rpxToPx(1),
    experimental_backgroundImage:
      'linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.16))',
  },
  dividerRight: {
    flex: 1,
    height: rpxToPx(1),
    experimental_backgroundImage:
      'linear-gradient(to right, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0))',
  },
  marker: {
    minWidth: rpxToPx(48),
    color: 'rgba(255, 255, 255, 0.38)',
    fontSize: rpxToPx(30),
    textAlign: 'center',
    marginRight: rpxToPx(28),
  },
  avatarContainer: {
    width: rpxToPx(100),
    height: rpxToPx(100),
    marginRight: rpxToPx(28),
    overflow: 'hidden',
    borderRadius: rpxToPx(50),
  },
  avatar: {
    width: rpxToPx(100),
    height: rpxToPx(100),
    borderRadius: rpxToPx(50),
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flexGrow: 0,
    flexShrink: 1,
    fontSize: rpxToPx(30),
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: '500',
    minWidth: 0,
    maxWidth: rpxToPx(300),
  },
  levelBadge: {
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
  giftValue: {
    color: '#ffe29a',
    fontSize: rpxToPx(24),
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 0,
  },
  emptyState: {
    padding: rpxToPx(64),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: rpxToPx(28),
  },
});

export default LiveAudienceList;
