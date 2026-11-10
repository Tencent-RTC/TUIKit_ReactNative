import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  useGiftState,
  useLiveListState,
  type GiftParam,
  type SendGiftOptions,
} from '../../atomic-x';
import { Text, rpxToPx } from '../Common';
import { useGiftTranslation } from './locales';

const COMBO_RING_IMAGE = require('../../static/assets/live/combo-ring.png');

export const COMBO_DURATION = 2000;
export const COMBO_EXPIRE_DELAY = COMBO_DURATION + 40;
const HOLD_REPEAT_DELAY = 300;
const HOLD_REPEAT_INTERVAL = 300;
const SEND_FLUSH_INTERVAL = 300;
const COMBO_SEND_DEDUPE_MS = 100;
const RIPPLE_DURATION = 1200;
const RIPPLE_LIFETIME = 1300;
const RIPPLE_EASING = Easing.bezier(0.16, 0.58, 0.3, 1);
const PRESS_DURATION = 120;
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

export function isAdvancedGift(gift: GiftParam): boolean {
  return !!gift.resourceURL && String(gift.resourceURL).length > 0;
}

export function useComboSender(
  liveID: string,
  sendGift: (params: SendGiftOptions) => Promise<void>
) {
  const pending = useRef({ giftID: '', count: 0 });
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFlushAt = useRef(0);
  const latest = useRef({ liveID, sendGift });
  latest.current = { liveID, sendGift };

  const flushPendingSend = useCallback(() => {
    if (flushTimer.current != null) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const { giftID, count } = pending.current;
    pending.current = { giftID: '', count: 0 };
    if (count <= 0 || !giftID) return;
    lastFlushAt.current = Date.now();
    latest.current.sendGift({
      liveID: latest.current.liveID,
      giftID,
      count,
      onError: (error) => {
        console.error(
          `[Gift] send fail giftID=${giftID}, count=${count}, error=${String(
            error
          )}`
        );
      },
    });
  }, []);

  const enqueueSend = useCallback(
    (gift: GiftParam) => {
      if (pending.current.giftID && pending.current.giftID !== gift.giftID) {
        flushPendingSend();
      }
      pending.current = {
        giftID: gift.giftID,
        count: pending.current.count + 1,
      };
      if (
        Date.now() - lastFlushAt.current >= SEND_FLUSH_INTERVAL &&
        flushTimer.current == null
      ) {
        flushPendingSend();
        return;
      }
      if (flushTimer.current == null) {
        flushTimer.current = setTimeout(flushPendingSend, SEND_FLUSH_INTERVAL);
      }
    },
    [flushPendingSend]
  );

  return { enqueueSend, flushPendingSend };
}

export function useComboHold(dispatchSend: () => boolean) {
  const [pressing, setPressing] = useState(false);
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSendAt = useRef(0);
  const dispatchRef = useRef(dispatchSend);
  dispatchRef.current = dispatchSend;

  const stopHold = useCallback(() => {
    if (delayTimer.current) clearTimeout(delayTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    delayTimer.current = null;
    repeatTimer.current = null;
  }, []);

  const dedupedSend = useCallback(() => {
    const now = Date.now();
    if (now - lastSendAt.current < COMBO_SEND_DEDUPE_MS) return false;
    lastSendAt.current = now;
    return dispatchRef.current();
  }, []);

  const onPressIn = useCallback(() => {
    setPressing(true);
    dedupedSend();
    stopHold();
    delayTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => {
        if (!dedupedSend()) stopHold();
      }, HOLD_REPEAT_INTERVAL);
    }, HOLD_REPEAT_DELAY);
  }, [dedupedSend, stopHold]);

  const onPressOut = useCallback(() => {
    setPressing(false);
    stopHold();
  }, [stopHold]);

  const reset = useCallback(() => {
    setPressing(false);
    stopHold();
  }, [stopHold]);

  useEffect(() => stopHold, [stopHold]);

  return { pressing, onPressIn, onPressOut, reset };
}

export type ComboButtonVariant = 'grid' | 'floating';

interface ComboButtonProps {
  variant: ComboButtonVariant;
  count: number;
  cycle: number;
  pressing: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}

interface Ripple {
  id: number;
  progress: Animated.Value;
}

export function ComboButton({
  variant,
  count,
  cycle,
  pressing,
  onPressIn,
  onPressOut,
}: ComboButtonProps) {
  const { t } = useGiftTranslation();
  const ringProgress = useRef(new Animated.Value(0)).current;
  const faceScale = useRef(new Animated.Value(1)).current;
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleSeq = useRef(0);
  const rippleTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = rippleTimers.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (cycle <= 0) return;
    ringProgress.stopAnimation();
    ringProgress.setValue(0);
    Animated.timing(ringProgress, {
      toValue: 1,
      duration: COMBO_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    const id = ++rippleSeq.current;
    const progress = new Animated.Value(0);
    setRipples((list) => [...list, { id, progress }]);
    Animated.timing(progress, {
      toValue: 1,
      duration: RIPPLE_DURATION,
      easing: RIPPLE_EASING,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      rippleTimers.current.delete(timer);
      setRipples((list) => list.filter((r) => r.id !== id));
    }, RIPPLE_LIFETIME);
    rippleTimers.current.add(timer);
  }, [cycle, ringProgress]);

  useEffect(() => {
    Animated.timing(faceScale, {
      toValue: pressing ? 0.92 : 1,
      duration: PRESS_DURATION,
      easing: CSS_EASE,
      useNativeDriver: true,
    }).start();
  }, [pressing, faceScale]);

  const rightRotate = ringProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '0deg', '0deg'],
  });
  const leftRotate = ringProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '-180deg', '0deg'],
  });

  const isFloating = variant === 'floating';

  return (
    <Pressable
      style={isFloating ? comboStyles.comboFloating : comboStyles.comboGrid}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View
        pointerEvents="none"
        style={[
          comboStyles.rippleLayer,
          isFloating
            ? comboStyles.rippleLayerFloating
            : comboStyles.rippleLayerGrid,
        ]}
      >
        {ripples.map((r) => (
          <Animated.View
            key={r.id}
            style={[
              comboStyles.ripple,
              {
                opacity: r.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 0],
                }),
                transform: [
                  {
                    scale: r.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1.4],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <View
        style={[
          comboStyles.ring,
          isFloating ? comboStyles.ringFloating : comboStyles.ringGrid,
        ]}
      >
        <View style={comboStyles.ringTrack} />
        <Image
          source={COMBO_RING_IMAGE}
          resizeMode="stretch"
          style={comboStyles.ringImage}
        />
        <View style={comboStyles.maskRight}>
          <Animated.View
            style={[
              comboStyles.maskFill,
              comboStyles.maskFillRight,
              { transform: [{ rotate: rightRotate }] },
            ]}
          />
        </View>
        <View style={comboStyles.maskLeft}>
          <Animated.View
            style={[
              comboStyles.maskFill,
              comboStyles.maskFillLeft,
              { transform: [{ rotate: leftRotate }] },
            ]}
          />
        </View>
        <View style={comboStyles.coreRing} />
        <Animated.View
          style={[comboStyles.face, { transform: [{ scale: faceScale }] }]}
        >
          <Text style={comboStyles.label}>{t('comboPress')}</Text>
          <Text style={comboStyles.label}>{t('comboLabel')}</Text>
        </Animated.View>
      </View>
      <View
        style={[
          comboStyles.count,
          isFloating ? comboStyles.countFloating : comboStyles.countGrid,
        ]}
      >
        <Text style={comboStyles.countText}>{count}</Text>
      </View>
    </Pressable>
  );
}

const RING = rpxToPx(124);
const HALF_RING = rpxToPx(62);
const RING_BG = '#050812';
const BRAND_GRADIENT = 'linear-gradient(to bottom right, #4A9EFF, #0052D9)';

const comboStyles = StyleSheet.create({
  comboGrid: {
    width: rpxToPx(179),
    height: rpxToPx(208),
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  comboFloating: {
    width: rpxToPx(179),
    height: rpxToPx(236),
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  rippleLayer: {
    position: 'absolute',
    width: rpxToPx(176),
    height: rpxToPx(176),
  },
  rippleLayerGrid: {
    left: rpxToPx(1.5),
    top: rpxToPx(-22),
  },
  rippleLayerFloating: {
    left: rpxToPx(2),
    top: rpxToPx(6),
  },
  ripple: {
    position: 'absolute',
    left: rpxToPx(26),
    top: rpxToPx(26),
    width: RING,
    height: RING,
    borderRadius: HALF_RING,
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(74, 158, 255, 0.6)',
    backgroundColor: 'rgba(74, 158, 255, 0.14)',
  },
  ring: {
    width: RING,
    height: RING,
    position: 'relative',
  },
  ringGrid: {
    marginTop: rpxToPx(4),
  },
  ringFloating: {
    marginTop: rpxToPx(32),
  },
  ringTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: RING,
    height: RING,
    borderRadius: HALF_RING,
    backgroundColor: RING_BG,
  },
  ringImage: {
    position: 'absolute',
    left: rpxToPx(2),
    top: rpxToPx(2),
    width: rpxToPx(120),
    height: rpxToPx(120),
  },
  maskRight: {
    position: 'absolute',
    left: HALF_RING,
    top: 0,
    width: HALF_RING,
    height: RING,
    overflow: 'hidden',
    borderTopRightRadius: HALF_RING,
    borderBottomRightRadius: HALF_RING,
  },
  maskLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: HALF_RING,
    height: RING,
    overflow: 'hidden',
    borderTopLeftRadius: HALF_RING,
    borderBottomLeftRadius: HALF_RING,
  },
  maskFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: HALF_RING,
    height: RING,
    backgroundColor: RING_BG,
  },
  maskFillRight: {
    borderTopRightRadius: HALF_RING,
    borderBottomRightRadius: HALF_RING,
    transformOrigin: 'left center',
  },
  maskFillLeft: {
    borderTopLeftRadius: HALF_RING,
    borderBottomLeftRadius: HALF_RING,
    transformOrigin: 'right center',
  },
  coreRing: {
    position: 'absolute',
    left: rpxToPx(16),
    top: rpxToPx(16),
    width: rpxToPx(92),
    height: rpxToPx(92),
    borderRadius: rpxToPx(46),
    backgroundColor: RING_BG,
  },
  face: {
    position: 'absolute',
    left: rpxToPx(17),
    top: rpxToPx(17),
    width: rpxToPx(90),
    height: rpxToPx(90),
    borderRadius: rpxToPx(45),
    experimental_backgroundImage: BRAND_GRADIENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: rpxToPx(22),
    fontWeight: '800',
    lineHeight: rpxToPx(26),
    textAlign: 'center',
  },
  count: {
    minWidth: rpxToPx(44),
    height: rpxToPx(32),
    paddingHorizontal: rpxToPx(8),
    borderRadius: rpxToPx(8),
    experimental_backgroundImage:
      'linear-gradient(to bottom, #4A9EFF, #0052D9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countGrid: {
    position: 'absolute',
    bottom: rpxToPx(24),
    left: rpxToPx(67),
  },
  countFloating: {
    marginTop: rpxToPx(8),
  },
  countText: {
    color: '#ffffff',
    fontSize: rpxToPx(22),
    fontWeight: '800',
    lineHeight: rpxToPx(32),
  },
});

export interface GiftSentPayload {
  gift: GiftParam;
  count: number;
}

export interface FloatingGiftComboProps {
  onComboSend?: (payload: GiftSentPayload) => void;
  onClosed?: () => void;
}

export interface FloatingGiftComboRef {
  activate: (gift: GiftParam, initialCount?: number) => void;
  stop: () => void;
}

export const FloatingGiftCombo = forwardRef<
  FloatingGiftComboRef,
  FloatingGiftComboProps
>(function FloatingGiftCombo({ onComboSend, onClosed }, ref) {
  const { currentLive } = useLiveListState();
  const liveID = String(currentLive?.liveID || '');
  const { sendGift } = useGiftState(liveID);
  const { enqueueSend, flushPendingSend } = useComboSender(liveID, sendGift);

  const [visible, setVisible] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [cycle, setCycle] = useState(0);
  const giftRef = useRef<GiftParam | null>(null);
  const visibleRef = useRef(false);
  const countRef = useRef(0);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ onComboSend, onClosed });
  latest.current = { onComboSend, onClosed };

  const stopRef = useRef<() => void>(() => {});

  const restartComboTimer = useCallback(() => {
    if (expireTimer.current) clearTimeout(expireTimer.current);
    setCycle((c) => c + 1);
    expireTimer.current = setTimeout(() => {
      if (visibleRef.current) stopRef.current();
    }, COMBO_EXPIRE_DELAY);
  }, []);

  const doSend = useCallback(() => {
    const gift = giftRef.current;
    if (!visibleRef.current || !gift) return false;
    countRef.current += 1;
    setComboCount(countRef.current);
    restartComboTimer();
    enqueueSend(gift);
    latest.current.onComboSend?.({ gift, count: countRef.current });
    return true;
  }, [enqueueSend, restartComboTimer]);

  const hold = useComboHold(doSend);
  const resetHold = hold.reset;

  const stop = useCallback(() => {
    flushPendingSend();
    resetHold();
    if (expireTimer.current) clearTimeout(expireTimer.current);
    expireTimer.current = null;
    giftRef.current = null;
    countRef.current = 0;
    visibleRef.current = false;
    setComboCount(0);
    setVisible(false);
    latest.current.onClosed?.();
  }, [flushPendingSend, resetHold]);
  stopRef.current = stop;

  const activate = useCallback(
    (gift: GiftParam, initialCount?: number) => {
      if (!gift) return;
      giftRef.current = gift;
      countRef.current = Math.max(1, Math.floor(Number(initialCount) || 1));
      visibleRef.current = true;
      resetHold();
      setComboCount(countRef.current);
      setVisible(true);
      restartComboTimer();
    },
    [resetHold, restartComboTimer]
  );

  useImperativeHandle(ref, () => ({ activate, stop }), [activate, stop]);

  useEffect(
    () => () => {
      if (expireTimer.current) clearTimeout(expireTimer.current);
      flushPendingSend();
    },
    [flushPendingSend]
  );

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.host, !visible && styles.hidden]}
    >
      <ComboButton
        variant="floating"
        count={comboCount}
        cycle={cycle}
        pressing={hold.pressing}
        onPressIn={hold.onPressIn}
        onPressOut={hold.onPressOut}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: rpxToPx(20),
    bottom: rpxToPx(160),
    width: rpxToPx(240),
    height: rpxToPx(236),
    alignItems: 'flex-end',
  },
  hidden: {
    opacity: 0,
  },
});

export default FloatingGiftCombo;
