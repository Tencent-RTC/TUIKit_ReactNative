import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Text } from '../Common';
import type { GiftParam } from '../../atomic-x';
import { rpxToPx } from '../Common';
import type { GiftUserInfo } from './giftService';
import { useGiftTranslation } from './locales';

const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');

export interface GiftEntryData {
  gift?: Partial<GiftParam>;
  sender?: GiftUserInfo;
  recipient?: GiftUserInfo | null;
  count?: number;
}

export interface GiftEntryBannerProps {
  bottomPx?: number;
  elevated?: boolean;
  hidden?: boolean;
}

export interface GiftEntryBannerRef {
  push: (data: GiftEntryData) => void;
  reset: () => void;
}

interface EntryData {
  giftId: string;
  senderId: string;
  recipientId: string;
  name: string;
  avatar: string;
  giftName: string;
  giftIcon: string;
  count: number;
}

interface SlotView extends EntryData {
  active: boolean;
  seq: number;
  bumping: boolean;
  giftIconFailed: boolean;
}

interface SlotRuntime {
  data: SlotView;
  leaving: boolean;
  expireTimer: ReturnType<typeof setTimeout> | null;
  hideTimer: ReturnType<typeof setTimeout> | null;
  bumpTimer: ReturnType<typeof setTimeout> | null;
  translateX: Animated.Value;
  opacity: Animated.Value;
  countScale: Animated.Value;
}

const HOLD_DURATION = 2000;
const ENTER_DURATION = 320;
const EXIT_DURATION = 320;
const BUMP_DURATION = 120;
const ENTER_EASING = Easing.bezier(0.16, 0.82, 0.22, 1);
const BUMP_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const ENTER_FROM_X = rpxToPx(-600);
const EXIT_TO_X = rpxToPx(-48);

function emptySlot(): SlotView {
  return {
    active: false,
    seq: 0,
    bumping: false,
    giftIconFailed: false,
    giftId: '',
    senderId: '',
    recipientId: '',
    name: '',
    avatar: '',
    giftName: '',
    giftIcon: '',
    count: 0,
  };
}

function createRuntime(): SlotRuntime {
  return {
    data: emptySlot(),
    leaving: false,
    expireTimer: null,
    hideTimer: null,
    bumpTimer: null,
    translateX: new Animated.Value(ENTER_FROM_X),
    opacity: new Animated.Value(0),
    countScale: new Animated.Value(1),
  };
}

function clearSlotTimers(slot: SlotRuntime) {
  if (slot.expireTimer) clearTimeout(slot.expireTimer);
  if (slot.hideTimer) clearTimeout(slot.hideTimer);
  if (slot.bumpTimer) clearTimeout(slot.bumpTimer);
  slot.expireTimer = null;
  slot.hideTimer = null;
  slot.bumpTimer = null;
}

export const GiftEntryBanner = forwardRef<
  GiftEntryBannerRef,
  GiftEntryBannerProps
>(function GiftEntryBanner(
  { bottomPx = 240, elevated = false, hidden = false },
  ref
) {
  const { t } = useGiftTranslation();
  const slots = useRef<SlotRuntime[]>([createRuntime(), createRuntime()]);
  const queue = useRef<EntryData[]>([]);
  const [views, setViews] = useState<SlotView[]>(() =>
    slots.current.map((s) => s.data)
  );

  const commit = useCallback(() => {
    setViews(slots.current.map((s) => ({ ...s.data })));
  }, []);

  const leaveRef = useRef<(slot: SlotRuntime) => void>(() => {});

  const restartTimer = useCallback((slot: SlotRuntime) => {
    if (slot.expireTimer) clearTimeout(slot.expireTimer);
    if (slot.hideTimer) clearTimeout(slot.hideTimer);
    slot.expireTimer = setTimeout(() => leaveRef.current(slot), HOLD_DURATION);
  }, []);

  const fillSlot = useCallback(
    (slot: SlotRuntime, data: EntryData) => {
      slot.leaving = false;
      slot.data = {
        ...data,
        active: true,
        seq: slot.data.seq + 1,
        bumping: false,
        giftIconFailed: false,
      };
      slot.translateX.stopAnimation();
      slot.opacity.stopAnimation();
      slot.translateX.setValue(ENTER_FROM_X);
      slot.opacity.setValue(0);
      slot.countScale.setValue(1);
      Animated.parallel([
        Animated.timing(slot.translateX, {
          toValue: 0,
          duration: ENTER_DURATION,
          easing: ENTER_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slot.opacity, {
          toValue: 1,
          duration: ENTER_DURATION,
          easing: ENTER_EASING,
          useNativeDriver: true,
        }),
      ]).start();
      restartTimer(slot);
    },
    [restartTimer]
  );

  const release = useCallback(
    (slot: SlotRuntime) => {
      clearSlotTimers(slot);
      slot.leaving = false;
      slot.data = { ...emptySlot(), seq: slot.data.seq };
      const next = queue.current.shift();
      if (next) fillSlot(slot, next);
      commit();
    },
    [commit, fillSlot]
  );

  const leave = useCallback(
    (slot: SlotRuntime) => {
      if (!slot.data.active || slot.leaving) return;
      slot.leaving = true;
      Animated.parallel([
        Animated.timing(slot.translateX, {
          toValue: EXIT_TO_X,
          duration: EXIT_DURATION,
          easing: ENTER_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slot.opacity, {
          toValue: 0,
          duration: EXIT_DURATION,
          easing: ENTER_EASING,
          useNativeDriver: true,
        }),
      ]).start();
      slot.hideTimer = setTimeout(() => release(slot), EXIT_DURATION);
    },
    [release]
  );
  leaveRef.current = leave;

  const triggerBump = useCallback(
    (slot: SlotRuntime) => {
      if (slot.bumpTimer) clearTimeout(slot.bumpTimer);
      Animated.timing(slot.countScale, {
        toValue: 1.24,
        duration: BUMP_DURATION,
        easing: BUMP_EASING,
        useNativeDriver: true,
      }).start();
      slot.data.bumping = true;
      slot.bumpTimer = setTimeout(() => {
        if (!slot.data.active) return;
        slot.data.bumping = false;
        Animated.timing(slot.countScale, {
          toValue: 1,
          duration: BUMP_DURATION,
          easing: CSS_EASE_OUT,
          useNativeDriver: true,
        }).start();
        commit();
      }, BUMP_DURATION);
    },
    [commit]
  );

  const push = useCallback(
    (entry: GiftEntryData) => {
      if (!entry) return;
      const gift = entry.gift || {};
      const sender = entry.sender || {};
      const senderId = sender.userID || '';
      const recipientId = entry.recipient?.userID || '';
      const giftId = String(gift.giftID || gift.name || '');
      const count = Math.max(1, Math.round(Number(entry.count) || 1));
      const matches = (e: EntryData) =>
        e.giftId === giftId &&
        e.senderId === senderId &&
        e.recipientId === recipientId;

      const active = slots.current.find(
        (s) => s.data.active && !s.leaving && matches(s.data)
      );
      if (active) {
        active.data.count += count;
        restartTimer(active);
        triggerBump(active);
        commit();
        return;
      }

      const queued = queue.current.find(matches);
      if (queued) {
        queued.count += count;
        return;
      }

      const data: EntryData = {
        giftId,
        senderId,
        recipientId,
        name: sender.userName || sender.userID || '',
        avatar: sender.avatarURL || '',
        giftName: gift.name || '',
        giftIcon: gift.iconURL || '',
        count,
      };
      const free = slots.current.find((s) => !s.data.active);
      if (free) {
        fillSlot(free, data);
        commit();
      } else {
        queue.current.push(data);
      }
    },
    [commit, fillSlot, restartTimer, triggerBump]
  );

  const reset = useCallback(() => {
    slots.current.forEach((s) => {
      clearSlotTimers(s);
      s.leaving = false;
      s.data = { ...emptySlot(), seq: s.data.seq };
    });
    queue.current = [];
    commit();
  }, [commit]);

  useImperativeHandle(ref, () => ({ push, reset }), [push, reset]);

  useEffect(() => {
    const list = slots.current;
    return () => list.forEach(clearSlotTimers);
  }, []);

  const onIconError = useCallback(
    (index: number) => {
      const slot = slots.current[index];
      if (!slot) return;
      slot.data.giftIconFailed = true;
      commit();
    },
    [commit]
  );

  if (hidden || !views.some((v) => v.active)) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        elevated && styles.layerElevated,
        { bottom: bottomPx },
      ]}
    >
      {views.map((view, index) => {
        const runtime = slots.current[index];
        if (!view.active || !runtime) return null;
        const name = view.name || t('senderFallback');
        const giftName = view.giftName || t('giftNameFallback');
        return (
          <Animated.View
            key={index}
            style={[
              styles.item,
              {
                opacity: runtime.opacity,
                transform: [{ translateX: runtime.translateX }],
              },
            ]}
          >
            <View style={styles.capsule}>
              <View style={styles.avatar}>
                <Image
                  source={view.avatar ? { uri: view.avatar } : DEFAULT_AVATAR}
                  resizeMode="cover"
                  style={styles.avatarImg}
                />
              </View>
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {t('sent', { name: giftName })}
                </Text>
              </View>
              <View style={styles.imageWrap}>
                {view.giftIcon && !view.giftIconFailed ? (
                  <Image
                    source={{ uri: view.giftIcon }}
                    resizeMode="contain"
                    style={styles.image}
                    onError={() => onIconError(index)}
                  />
                ) : (
                  <Text style={styles.imageFallback}>{t('giftFallback')}</Text>
                )}
              </View>
            </View>
            <Animated.View
              style={[
                styles.count,
                { transform: [{ scale: runtime.countScale }] },
              ]}
            >
              <Text style={[styles.countX, view.bumping && styles.bump]}>
                ×
              </Text>
              <Text style={[styles.countNum, view.bumping && styles.bump]}>
                {view.count}
              </Text>
            </Animated.View>
          </Animated.View>
        );
      })}
    </View>
  );
});

const TEXT_SHADOW = {
  textShadowColor: 'rgba(0, 0, 0, 0.55)',
  textShadowOffset: { width: 0, height: rpxToPx(4) },
  textShadowRadius: rpxToPx(16),
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: rpxToPx(24),
    zIndex: 2400,
    flexDirection: 'column-reverse',
    alignItems: 'flex-start',
  },
  layerElevated: {
    zIndex: 3000,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    height: rpxToPx(88),
    marginTop: rpxToPx(8),
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: rpxToPx(88),
    padding: rpxToPx(6),
    borderRadius: rpxToPx(44),
    backgroundColor: 'rgba(8, 10, 15, 0.28)',
    maxWidth: rpxToPx(560),
  },
  avatar: {
    width: rpxToPx(76),
    height: rpxToPx(76),
    borderRadius: rpxToPx(38),
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(74, 158, 255, 0.36)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: rpxToPx(76),
    height: rpxToPx(76),
    borderRadius: rpxToPx(38),
  },
  copy: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: rpxToPx(14),
    maxWidth: rpxToPx(320),
    minWidth: 0,
    flexShrink: 1,
  },
  name: {
    color: '#ffffff',
    fontSize: rpxToPx(24),
    fontWeight: '600',
    lineHeight: rpxToPx(30),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: rpxToPx(2) },
    textShadowRadius: rpxToPx(10),
    maxWidth: rpxToPx(320),
  },
  detail: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: rpxToPx(18),
    lineHeight: rpxToPx(24),
    maxWidth: rpxToPx(320),
  },
  imageWrap: {
    width: rpxToPx(82),
    height: rpxToPx(82),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: rpxToPx(8),
    flexShrink: 0,
  },
  image: {
    width: rpxToPx(74),
    height: rpxToPx(74),
  },
  imageFallback: {
    width: rpxToPx(68),
    height: rpxToPx(52),
    borderRadius: rpxToPx(24),
    overflow: 'hidden',
    color: '#ffffff',
    backgroundColor: '#f30b82',
    fontSize: rpxToPx(34),
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: rpxToPx(52),
  },
  count: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: rpxToPx(104),
    marginLeft: rpxToPx(8),
    paddingRight: rpxToPx(56),
    transformOrigin: 'left center',
  },
  countX: {
    color: '#ffffff',
    fontSize: rpxToPx(34),
    lineHeight: rpxToPx(44),
    fontWeight: '800',
    ...TEXT_SHADOW,
  },
  countNum: {
    color: '#ffffff',
    fontSize: rpxToPx(52),
    lineHeight: rpxToPx(56),
    fontWeight: '800',
    marginLeft: rpxToPx(4),
    letterSpacing: rpxToPx(-3),
    ...TEXT_SHADOW,
  },
  bump: {
    color: '#78d8ff',
  },
});

export default GiftEntryBanner;
