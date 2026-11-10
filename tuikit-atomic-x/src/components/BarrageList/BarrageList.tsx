import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../Common';
import type {
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import {
  useBarrageState,
  useGiftState,
  useLiveListState,
  useLoginState,
} from '../../atomic-x';
import { parseTextToSegments } from '../../utils';
import { rpxToPx } from '../Common';
import { levelBadgeSource, resolveMsgLevel } from './levelBadge';
import { wrapSegmentsIntoLines, type MessageLine } from './lineBreaker';
import { useBarrageListTranslation } from './locales';
import { createCharRuler } from './textMeasurer';

export type BarrageListMode = 'anchor' | 'audience';

export interface BarrageSender {
  userID?: string;
  userName?: string;
  avatarURL?: string;
  level?: number | string;
  [key: string]: unknown;
}

export interface BarrageGift {
  giftID?: string;
  name?: string;
  iconURL?: string;
  [key: string]: unknown;
}

export interface BarrageMessage {
  sequence?: number | string;
  messageType?: number;
  textContent?: string;
  sender?: BarrageSender;
  recipient?: BarrageSender;
  gift?: BarrageGift;
  count?: number | string;
  __localKey?: string;
  __level?: number;
  __owner?: boolean;
  [key: string]: unknown;
}

export interface BarrageGiftData {
  gift?: BarrageGift;
  sender?: BarrageSender;
  recipient?: BarrageSender;
  count?: number | string;
  [key: string]: unknown;
}

export interface BarrageListProps {
  mode?: BarrageListMode;
  liveID?: string;
  topPx?: number;
  width?: number;
  onItemTap?: (message: BarrageMessage) => void;
  onReceiveGift?: (giftData: BarrageGiftData) => void;
}

const CUSTOM_MESSAGE_TYPE = 1;
const GIFT_COMBO_MS = 2000;
const NEAR_BOTTOM_THRESHOLD = 16;
const ENTER_DELAY_MS = 50;
const ENTER_DURATION_MS = 300;
const PILL_REFOLLOW_MS = 600;
const SCROLL_DELAY_MS = 100;
const PROGRAMMATIC_SCROLL_MS = 600;
const GIFT_LISTENER_ID = 'BarrageList';
const LIST_HEIGHT_RPX = 380;
const PILL_HEIGHT_RPX = 52;
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

const isRenderableBarrage = (message: BarrageMessage): boolean =>
  message?.messageType !== CUSTOM_MESSAGE_TYPE;

const parseMaybeJson = <T,>(value: unknown): T =>
  (typeof value === 'string' ? JSON.parse(value) : value) as T;

const toCount = (value: unknown): number =>
  Math.max(1, Math.round(Number(value) || 1));

const FONT_PX = rpxToPx(26);
const EMOJI_PX = rpxToPx(34);
const NICK_MAX_CHARS = 20;
const NICK_MAX_RATIO = 0.45;
const NICK_MARGIN_PX = rpxToPx(8);
const BADGE_PX = rpxToPx(68 + 8);
const ANCHOR_PX = rpxToPx(66);
const BUBBLE_PADDING_RPX = 24;
const GIFT_NAME_MARGIN_PX = rpxToPx(6);
const GIFT_ICON_PX = rpxToPx(24);
const GIFT_COUNT_MAX_PX = rpxToPx(110);
const ruler = createCharRuler(FONT_PX);

const nickTextOf = (message: BarrageMessage): string => {
  const raw = String(
    message?.sender?.userName || message?.sender?.userID || ''
  );
  return raw.length > NICK_MAX_CHARS ? `${raw.slice(0, NICK_MAX_CHARS)}…` : raw;
};

const nickMaxWidthPxOf = (barWidthRpx: number): number =>
  rpxToPx(
    Math.max(
      160,
      Math.round((barWidthRpx - BUBBLE_PADDING_RPX) * NICK_MAX_RATIO)
    )
  );

const layoutTextLines = (
  message: BarrageMessage,
  isOwner: boolean,
  barWidthRpx: number
): MessageLine[] => {
  const contentWidthPx = rpxToPx(barWidthRpx - BUBBLE_PADDING_RPX);
  const nickPx =
    Math.min(
      ruler.measureStrPx(`${nickTextOf(message)}：`),
      nickMaxWidthPxOf(barWidthRpx)
    ) + NICK_MARGIN_PX;
  const headerPx = BADGE_PX + (isOwner ? ANCHOR_PX : 0) + nickPx;
  return wrapSegmentsIntoLines(parseTextToSegments(message.textContent || ''), {
    line0AvailPx: Math.max(0, contentWidthPx - headerPx),
    lineNAvailPx: contentWidthPx,
    emojiPx: EMOJI_PX,
    measureCharPx: ruler.measureCharPx,
  });
};

const giftNameWidthPxOf = (
  message: BarrageMessage,
  giftPrefix: string,
  barWidthRpx: number
): number => {
  const contentWidthPx = rpxToPx(barWidthRpx - BUBBLE_PADDING_RPX);
  const nickPx =
    Math.min(
      ruler.measureStrPx(nickTextOf(message)),
      nickMaxWidthPxOf(barWidthRpx)
    ) + NICK_MARGIN_PX;
  const prefixPx = ruler.measureStrPx(giftPrefix) + GIFT_NAME_MARGIN_PX;
  const countPx =
    Math.min(
      ruler.measureStrPx(`×${message.count || '1'}`),
      GIFT_COUNT_MAX_PX
    ) + GIFT_NAME_MARGIN_PX;
  const reservedPx =
    BADGE_PX + nickPx + prefixPx + GIFT_NAME_MARGIN_PX + GIFT_ICON_PX + countPx;
  return Math.max(0, Math.round(contentWidthPx - reservedPx));
};

let localKeySeed = 0;
const createLocalKey = (prefix: string): string => {
  localKeySeed += 1;
  return `${prefix}_${Date.now()}_${localKeySeed}`;
};

const messageKey = (message: BarrageMessage): string =>
  String(message.sequence ?? message.__localKey ?? '');

const withKey = (message: BarrageMessage): BarrageMessage =>
  message.sequence != null || message.__localKey
    ? message
    : { ...message, __localKey: createLocalKey('msg') };

interface LevelBadgeProps {
  level: number;
}

function LevelBadge({ level }: LevelBadgeProps) {
  return (
    <View style={styles.levelBadge}>
      <Image
        style={styles.levelBg}
        source={levelBadgeSource(level)}
        resizeMode="stretch"
      />
      <Text style={styles.levelNum}>{level}</Text>
    </View>
  );
}

interface BarrageItemProps {
  message: BarrageMessage;
  level: number;
  isOwner: boolean;
  animate: boolean;
  barWidthPx: number;
  barWidthRpx: number;
  giftPrefix: string;
  anchorLabel: string;
  onPress: (message: BarrageMessage) => void;
  onEntered: () => void;
}

const BarrageItem = memo(function BarrageItem({
  message,
  level,
  isOwner,
  animate,
  barWidthPx,
  barWidthRpx,
  giftPrefix,
  anchorLabel,
  onPress,
  onEntered,
}: BarrageItemProps) {
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const onEnteredRef = useRef(onEntered);
  onEnteredRef.current = onEntered;

  useEffect(() => {
    if (!animate) {
      return undefined;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: ENTER_DURATION_MS,
      delay: ENTER_DELAY_MS,
      easing: CSS_EASE_OUT,
      useNativeDriver: true,
    });
    animation.start(() => onEnteredRef.current());
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = useMemo(
    () => (message.gift ? [] : layoutTextLines(message, isOwner, barWidthRpx)),
    [message, isOwner, barWidthRpx]
  );
  const nickStyle = [
    styles.nickname,
    { maxWidth: nickMaxWidthPxOf(barWidthRpx) },
  ];

  return (
    <Pressable
      style={[styles.chatItem, { maxWidth: barWidthPx }]}
      onPress={() => onPress(message)}
    >
      <Animated.View
        style={[styles.messageWrapper, { maxWidth: barWidthPx, opacity }]}
      >
        {message.gift ? (
          <View style={styles.giftContent}>
            <LevelBadge level={level} />
            <Text style={nickStyle} numberOfLines={1}>
              {nickTextOf(message)}
            </Text>
            <View style={styles.giftRow}>
              <Text style={styles.giftPrefix}>{giftPrefix}</Text>
              <Text
                style={[
                  styles.giftName,
                  {
                    maxWidth: giftNameWidthPxOf(
                      message,
                      giftPrefix,
                      barWidthRpx
                    ),
                  },
                ]}
                numberOfLines={1}
              >
                {message.textContent || ''}
              </Text>
              {message.gift.iconURL ? (
                <Image
                  style={styles.giftIcon}
                  source={{ uri: message.gift.iconURL }}
                />
              ) : null}
              <Text style={styles.giftCount} numberOfLines={1}>
                ×{message.count || '1'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.textContent}>
            {lines.map((line, lineIndex) => (
              <View key={lineIndex} style={styles.msgLine}>
                {lineIndex === 0 && (
                  <>
                    <LevelBadge level={level} />
                    {isOwner ? (
                      <View style={styles.role}>
                        <View style={styles.roleInner}>
                          <Text style={styles.roleText}>{anchorLabel}</Text>
                        </View>
                      </View>
                    ) : null}
                    <Text style={nickStyle} numberOfLines={1}>
                      {nickTextOf(message)}：
                    </Text>
                  </>
                )}
                {line.map((run, runIndex) =>
                  run.type === 'text' ? (
                    <Text key={runIndex} style={styles.chatContent}>
                      {run.text}
                    </Text>
                  ) : (
                    <Image
                      key={runIndex}
                      style={styles.emoji}
                      source={{ uri: run.src }}
                      resizeMode="contain"
                    />
                  )
                )}
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
});

interface PendingGift {
  count: number;
  timer: ReturnType<typeof setTimeout>;
}

export const BarrageList = memo(function BarrageList({
  mode = 'audience',
  liveID: liveIDProp,
  topPx = 0,
  width = 500,
  onItemTap,
  onReceiveGift,
}: BarrageListProps) {
  const { t } = useBarrageListTranslation();
  const { currentLive } = useLiveListState();
  const { loginUserInfo } = useLoginState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { messageList } = useBarrageState(liveID);
  const { addGiftListener, removeGiftListener } = useGiftState(liveID);

  const [mixMessageList, setMixMessageList] = useState<BarrageMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(
    () => new Set()
  );

  const listRef = useRef<FlatList<BarrageMessage>>(null);
  const followingRef = useRef(true);
  const userDraggedRef = useRef(false);
  const programmaticScrollUntilRef = useRef(0);
  const firstAppendDoneRef = useRef(false);
  const enteringCountRef = useRef(0);
  const consumedLengthRef = useRef(0);
  const pendingGiftsRef = useRef(new Map<string, PendingGift>());
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const onReceiveGiftRef = useRef(onReceiveGift);
  onReceiveGiftRef.current = onReceiveGift;

  const barWidthPx = rpxToPx(width);
  const listHeightPx = rpxToPx(LIST_HEIGHT_RPX);
  const pillTopPx = Math.max(
    0,
    topPx + listHeightPx - rpxToPx(PILL_HEIGHT_RPX)
  );
  const myUserID = loginUserInfo?.userID;
  const myLevel = Number(loginUserInfo?.level);
  const ownerUserID = currentLive?.liveOwner?.userID;
  const snapshotSourceRef = useRef({ myUserID, myLevel, ownerUserID });
  snapshotSourceRef.current = { myUserID, myLevel, ownerUserID };

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  const scrollToBottom = useCallback(
    (animated = true) => {
      programmaticScrollUntilRef.current =
        Date.now() + SCROLL_DELAY_MS + PROGRAMMATIC_SCROLL_MS;
      later(() => listRef.current?.scrollToEnd({ animated }), SCROLL_DELAY_MS);
    },
    [later]
  );

  const appendMessages = useCallback(
    (messages: BarrageMessage[]) => {
      if (messages.length === 0) {
        return;
      }
      // Level and host badge are fixed when a message arrives, so later profile or owner updates do not rewrite history.
      const {
        myUserID: selfID,
        myLevel: selfLevel,
        ownerUserID: ownerID,
      } = snapshotSourceRef.current;
      const keyed = messages.map((message) => {
        const userID = message.sender?.userID;
        return {
          ...withKey(message),
          __level: resolveMsgLevel(message, selfID, selfLevel),
          __owner: !!userID && !!ownerID && userID === ownerID,
        };
      });
      const [single] = keyed;
      const animate =
        firstAppendDoneRef.current &&
        keyed.length === 1 &&
        enteringCountRef.current === 0;
      firstAppendDoneRef.current = true;
      if (animate && single) {
        enteringCountRef.current += 1;
        setEnteringKeys((prev) => new Set(prev).add(messageKey(single)));
      }
      setMixMessageList((prev) => [...prev, ...keyed]);
      if (followingRef.current) {
        scrollToBottom();
      } else {
        setUnreadCount((prev) => prev + keyed.length);
      }
    },
    [scrollToBottom]
  );

  const handleEntered = useCallback((key: string) => {
    enteringCountRef.current = Math.max(0, enteringCountRef.current - 1);
    setEnteringKeys((prev) => {
      if (!prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    consumedLengthRef.current = 0;
    firstAppendDoneRef.current = false;
    enteringCountRef.current = 0;
    followingRef.current = true;
    userDraggedRef.current = false;
    setMixMessageList([]);
    setUnreadCount(0);
    setEnteringKeys(new Set());
  }, [liveID]);

  useEffect(() => {
    const list = (messageList || []) as unknown as BarrageMessage[];
    if (list.length < consumedLengthRef.current) {
      consumedLengthRef.current = list.length;
      return;
    }
    const delta = list
      .slice(consumedLengthRef.current)
      .filter(isRenderableBarrage);
    consumedLengthRef.current = list.length;
    appendMessages(delta);
  }, [messageList, appendMessages]);

  useEffect(() => {
    if (!liveID) {
      return undefined;
    }
    const pendingGifts = pendingGiftsRef.current;
    const addGiftMessage = (value: BarrageMessage) => {
      const comboKey = `${value.sender?.userID || ''}:${
        value.gift?.giftID || value.gift?.name || ''
      }:${value.recipient?.userID || ''}`;
      const pending = pendingGifts.get(comboKey);
      const count = (pending ? pending.count : 0) + toCount(value.count);
      if (pending) {
        clearTimeout(pending.timer);
      }
      pendingGifts.set(comboKey, {
        count,
        timer: setTimeout(() => {
          pendingGifts.delete(comboKey);
          appendMessages([{ ...value, count }]);
        }, GIFT_COMBO_MS),
      });
    };
    const handleReceiveGift = (event: unknown) => {
      try {
        const res = parseMaybeJson<BarrageGiftData>(event) || {};
        const gift = parseMaybeJson<BarrageGift | undefined>(res.gift);
        const sender = parseMaybeJson<BarrageSender | undefined>(res.sender);
        const giftData: BarrageGiftData = { ...res, gift, sender };
        addGiftMessage({
          ...giftData,
          textContent: gift?.name || '',
          __localKey: createLocalKey('gift'),
        });
        onReceiveGiftRef.current?.(giftData);
      } catch (error) {
        console.error('[BarrageList] onReceiveGift parse error:', error);
      }
    };
    addGiftListener('onReceiveGift', handleReceiveGift, GIFT_LISTENER_ID);
    return () => {
      removeGiftListener('onReceiveGift', GIFT_LISTENER_ID);
      pendingGifts.forEach((pending) => clearTimeout(pending.timer));
      pendingGifts.clear();
    };
  }, [liveID, addGiftListener, removeGiftListener, appendMessages]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const bottomGap =
        contentSize.height - contentOffset.y - layoutMeasurement.height;
      const nearBottom = bottomGap <= NEAR_BOTTOM_THRESHOLD;
      // Content growth fires scroll events before the follow-up scrollToEnd lands; only a user drag may stop following.
      if (!userDraggedRef.current) {
        followingRef.current = true;
        setUnreadCount((prev) => (prev > 0 ? 0 : prev));
        return;
      }
      if (!nearBottom && Date.now() < programmaticScrollUntilRef.current)
        return;
      followingRef.current = nearBottom;
      if (nearBottom) {
        setUnreadCount((prev) => (prev > 0 ? 0 : prev));
      }
    },
    []
  );

  const handleScrollBeginDrag = useCallback(() => {
    userDraggedRef.current = true;
    programmaticScrollUntilRef.current = 0;
  }, []);

  const handlePillPress = useCallback(() => {
    followingRef.current = true;
    setUnreadCount(0);
    scrollToBottom();
    later(() => {
      if (followingRef.current) {
        listRef.current?.scrollToEnd({ animated: false });
      }
    }, PILL_REFOLLOW_MS);
  }, [later, scrollToBottom]);

  const handleItemPress = useCallback(
    (message: BarrageMessage) => onItemTap?.(message),
    [onItemTap]
  );

  const giftPrefix = t('giftPrefix');
  const anchorLabel = t('anchor');

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BarrageMessage>) => {
      const key = messageKey(item);
      return (
        <BarrageItem
          message={item}
          level={item.__level ?? 0}
          isOwner={!!item.__owner}
          animate={enteringKeys.has(key)}
          barWidthPx={barWidthPx}
          barWidthRpx={width}
          giftPrefix={giftPrefix}
          anchorLabel={anchorLabel}
          onPress={handleItemPress}
          onEntered={() => handleEntered(key)}
        />
      );
    },
    [
      enteringKeys,
      barWidthPx,
      width,
      giftPrefix,
      anchorLabel,
      handleItemPress,
      handleEntered,
    ]
  );

  const welcome = (
    <View style={[styles.welcomeWrapper, { maxWidth: barWidthPx }]}>
      <Text style={styles.welcomeText}>
        {t(mode === 'anchor' ? 'welcomeHost' : 'welcome')}
      </Text>
    </View>
  );

  return (
    <>
      <FlatList
        ref={listRef}
        style={[
          styles.chatList,
          { top: topPx, width: barWidthPx, height: listHeightPx },
        ]}
        contentContainerStyle={styles.chatListContent}
        data={mixMessageList}
        keyExtractor={messageKey}
        renderItem={renderItem}
        extraData={enteringKeys}
        ListHeaderComponent={welcome}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
      />
      <Pressable
        style={[
          styles.pill,
          { top: pillTopPx },
          unreadCount > 0 ? null : styles.pillHidden,
        ]}
        pointerEvents={unreadCount > 0 ? 'auto' : 'none'}
        onPress={handlePillPress}
      >
        <Text style={styles.pillCount}>{unreadCount}</Text>
        <Text style={styles.pillText}>{t('newMessages')}</Text>
      </Pressable>
    </>
  );
});

const styles = StyleSheet.create({
  chatList: {
    position: 'absolute',
    left: rpxToPx(32),
  },
  chatListContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  bottomSpacer: {
    height: rpxToPx(10),
  },
  pill: {
    position: 'absolute',
    left: rpxToPx(32),
    height: rpxToPx(52),
    paddingHorizontal: rpxToPx(20),
    borderRadius: rpxToPx(26),
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(74, 158, 255, 0.34)',
    backgroundColor: 'rgba(10, 12, 18, 0.96)',
    boxShadow: `0 ${rpxToPx(10)}px ${rpxToPx(32)}px rgba(0, 0, 0, 0.38)`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 998,
  },
  pillHidden: {
    opacity: 0,
  },
  pillText: {
    color: '#ffffff',
    fontSize: rpxToPx(22),
    fontWeight: '600',
  },
  pillCount: {
    color: '#78D8FF',
    fontSize: rpxToPx(22),
    fontWeight: '600',
    marginRight: rpxToPx(6),
  },
  welcomeWrapper: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: rpxToPx(24),
    paddingVertical: rpxToPx(12),
    paddingHorizontal: rpxToPx(16),
    marginBottom: rpxToPx(10),
  },
  welcomeText: {
    color: '#78d8ff',
    fontSize: rpxToPx(26),
    fontWeight: '600',
  },
  chatItem: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: rpxToPx(6),
    paddingRight: rpxToPx(6),
    paddingBottom: rpxToPx(6),
  },
  messageWrapper: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: rpxToPx(24),
    paddingVertical: rpxToPx(8),
    paddingHorizontal: rpxToPx(12),
  },
  giftContent: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  giftRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  giftPrefix: {
    color: '#fff4cf',
    fontSize: rpxToPx(26),
    lineHeight: rpxToPx(34),
    fontWeight: '600',
    marginRight: rpxToPx(6),
  },
  giftName: {
    flexShrink: 1,
    color: '#ffe7a3',
    fontSize: rpxToPx(26),
    lineHeight: rpxToPx(34),
    fontWeight: '600',
    paddingVertical: rpxToPx(2),
    marginRight: rpxToPx(6),
  },
  giftIcon: {
    width: rpxToPx(24),
    height: rpxToPx(24),
  },
  giftCount: {
    color: '#ffe7a3',
    fontSize: rpxToPx(26),
    lineHeight: rpxToPx(34),
    fontWeight: '700',
    marginLeft: rpxToPx(6),
    maxWidth: rpxToPx(110),
  },
  textContent: {
    flexShrink: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  msgLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatContent: {
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: rpxToPx(26),
    lineHeight: rpxToPx(34),
    fontWeight: '600',
  },
  nickname: {
    color: '#78d8ff',
    fontSize: rpxToPx(26),
    lineHeight: rpxToPx(34),
    fontWeight: '600',
    marginRight: rpxToPx(8),
  },
  emoji: {
    width: rpxToPx(32),
    height: rpxToPx(32),
    marginRight: rpxToPx(2),
  },
  role: {
    height: rpxToPx(30),
    marginRight: rpxToPx(8),
    borderRadius: rpxToPx(15),
    backgroundColor: '#65a8d1',
  },
  roleInner: {
    flex: 1,
    margin: rpxToPx(2),
    paddingHorizontal: rpxToPx(10),
    borderRadius: rpxToPx(13),
    backgroundColor: '#3266a4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    color: '#ffffff',
    fontSize: rpxToPx(17),
    fontWeight: '800',
  },
  levelBadge: {
    width: rpxToPx(68),
    height: rpxToPx(30),
    marginRight: rpxToPx(8),
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
});
