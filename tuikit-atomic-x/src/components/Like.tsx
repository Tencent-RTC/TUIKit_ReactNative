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
  Platform,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useLikeState, useLiveListState, useLoginState } from '../atomic-x';
import { rpxToPx } from './Common';

export type LikeRole = 'anchor' | 'audience';

export interface LikeProps {
  role?: LikeRole;
  maxConcurrent?: number;
  enableHaptics?: boolean;
}

export interface LikeRef {
  triggerLike: () => void;
}

interface FloatItem {
  id: number;
  icon: ImageSourcePropType;
  startX: number;
  progress: Animated.Value;
  translateX: Animated.AnimatedInterpolation<number>;
  translateY: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number>;
}

const LIKE_ICON = require('../static/assets/live/live-like.png');
const REACTION_ICONS: ImageSourcePropType[] = [
  require('../static/assets/live/reaction-thumb.png'),
  require('../static/assets/live/reaction-heart.png'),
  require('../static/assets/live/reaction-double-heart.png'),
  require('../static/assets/live/reaction-fire.png'),
  require('../static/assets/live/reaction-sparkle.png'),
];

const BTN_ANIM_DURATION = 120;
const BTN_ANIM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const BTN_PRESSED_SCALE = 0.92;
const MIN_PRESS_VISIBLE_MS = 120;

const STAGE_1 = 0.125;
const STAGE_2 = 0.4225;
const STAGE_3 = 0.7025;
const STAGE_4 = 0.8075;
const STAGE_1_SAMPLES = 8;
const RISE_Y = -100;
const LAYER_W = 380;
const LAYER_H = 520;
const BTN_CENTER_FROM_RIGHT = 156;
const BTN_SIZE = 72;
const BTN_MARGIN_LEFT = 16;
const FLOAT_SIZE = 80;

const SPAWN_THROTTLE = 80;
const BATCH_DELAY = 6000;
const ANDROID_LIGHT_VIBRATE_MS = 15;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function createFloat(id: number): { item: FloatItem; duration: number } {
  const startX = LAYER_W - BTN_CENTER_FROM_RIGHT + (Math.random() * 20 - 10);
  const rise2 = 100 + Math.random() * 60;
  const p1x = -(8 + Math.random() * 4);
  const p1y = RISE_Y - rise2 * 0.34;
  const p2x = -(2 + Math.random() * 4);
  const p2y = RISE_Y - rise2 * 0.66;
  const p3x = -(10 + Math.random() * 4);
  const p3y = RISE_Y - rise2 * 0.78;
  const p4x = -(6 + Math.random() * 4);
  const p4y = RISE_Y - rise2;
  const duration = 1500 + Math.round(Math.random() * 200);
  const icon =
    REACTION_ICONS[Math.floor(Math.random() * REACTION_ICONS.length)]!;

  const stage1Input: number[] = [];
  const stage1Y: number[] = [];
  const stage1Scale: number[] = [];
  for (let i = 0; i <= STAGE_1_SAMPLES; i++) {
    const t = i / STAGE_1_SAMPLES;
    const k = easeOutCubic(t);
    stage1Input.push(t * STAGE_1);
    stage1Y.push(RISE_Y * k);
    stage1Scale.push(0.2 + 0.8 * k);
  }
  const inputRange = [...stage1Input, STAGE_2, STAGE_3, STAGE_4, 1];
  const stage1Zeros = stage1Input.map(() => 0);
  const stage1Ones = stage1Input.map(() => 1);
  const toPx = (values: number[]) => values.map(rpxToPx);

  const progress = new Animated.Value(0);
  const interpolate = (outputRange: number[]) =>
    progress.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });

  return {
    duration,
    item: {
      id,
      icon,
      startX,
      progress,
      translateX: interpolate(toPx([...stage1Zeros, p1x, p2x, p3x, p4x])),
      translateY: interpolate(toPx([...stage1Y, p1y, p2y, p3y, p4y])),
      scale: interpolate([...stage1Scale, 1, 1, 1, 1]),
      opacity: interpolate([...stage1Ones, 0.66, 0.34, 0.22, 0]),
    },
  };
}

function parseMaybeJson(value: unknown): any {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export const Like = forwardRef<LikeRef, LikeProps>(function Like(
  { role = 'audience', maxConcurrent = 8, enableHaptics = true },
  ref
) {
  const { currentLive } = useLiveListState();
  const liveID = String(currentLive?.liveID || '');
  const { sendLike, addLikeListener, removeLikeListener } =
    useLikeState(liveID);
  const { loginUserInfo } = useLoginState();

  const [floats, setFloats] = useState<FloatItem[]>([]);
  const floatSeqRef = useRef(0);
  const lastSpawnAtRef = useRef(0);
  const maxConcurrentRef = useRef(maxConcurrent);
  maxConcurrentRef.current = maxConcurrent;

  const btnScale = useRef(new Animated.Value(1)).current;
  const pressAtRef = useRef(0);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCountRef = useRef(0);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSendAtRef = useRef(0);
  const sendLikeRef = useRef(sendLike);
  sendLikeRef.current = sendLike;
  const liveIDRef = useRef(liveID);
  liveIDRef.current = liveID;
  const selfUserIDRef = useRef(loginUserInfo?.userID);
  selfUserIDRef.current = loginUserInfo?.userID;

  const transitionBtn = useCallback(
    (pressed: boolean) => {
      Animated.timing(btnScale, {
        toValue: pressed ? BTN_PRESSED_SCALE : 1,
        duration: BTN_ANIM_DURATION,
        easing: BTN_ANIM_EASING,
        useNativeDriver: true,
      }).start();
    },
    [btnScale]
  );

  const clearReleaseTimer = () => {
    if (releaseTimerRef.current != null) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  };

  const onPressIn = () => {
    clearReleaseTimer();
    pressAtRef.current = Date.now();
    transitionBtn(true);
  };

  const onPressOut = () => {
    clearReleaseTimer();
    const delay = Math.max(
      0,
      MIN_PRESS_VISIBLE_MS - (Date.now() - pressAtRef.current)
    );
    if (delay === 0) {
      transitionBtn(false);
      return;
    }
    releaseTimerRef.current = setTimeout(() => {
      releaseTimerRef.current = null;
      transitionBtn(false);
    }, delay);
  };

  const spawnFloat = useCallback(() => {
    const now = Date.now();
    if (now - lastSpawnAtRef.current < SPAWN_THROTTLE) return;
    lastSpawnAtRef.current = now;

    const { item, duration } = createFloat(++floatSeqRef.current);
    setFloats((prev) => {
      const next =
        prev.length >= maxConcurrentRef.current
          ? prev.slice(prev.length - maxConcurrentRef.current + 1)
          : prev;
      prev
        .filter((f) => !next.includes(f))
        .forEach((f) => f.progress.stopAnimation());
      return [...next, item];
    });
    Animated.timing(item.progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      setFloats((prev) => prev.filter((f) => f.id !== item.id));
    });
  }, []);

  const flushBatch = useCallback(() => {
    if (batchTimerRef.current != null) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    if (pendingCountRef.current <= 0) return;
    const count = pendingCountRef.current;
    pendingCountRef.current = 0;
    lastSendAtRef.current = Date.now();
    sendLikeRef.current({
      liveID: liveIDRef.current,
      count,
      onError: (error) => {
        console.error('sendLike failed:', error);
      },
    });
  }, []);

  const handleLikeTap = () => {
    if (enableHaptics && Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_LIGHT_VIBRATE_MS);
    }
    spawnFloat();

    pendingCountRef.current += 1;
    const now = Date.now();
    if (
      lastSendAtRef.current === 0 ||
      now - lastSendAtRef.current >= BATCH_DELAY
    ) {
      flushBatch();
      return;
    }
    if (batchTimerRef.current == null) {
      const remain = Math.max(0, BATCH_DELAY - (now - lastSendAtRef.current));
      batchTimerRef.current = setTimeout(flushBatch, remain);
    }
  };

  useImperativeHandle(ref, () => ({ triggerLike: spawnFloat }), [spawnFloat]);

  useEffect(() => {
    if (!liveID) return undefined;
    addLikeListener('onReceiveLikesMessage', (event?: unknown) => {
      const res = parseMaybeJson(event);
      const sender = parseMaybeJson(res?.sender);
      if (sender && sender.userID === selfUserIDRef.current) return;
      spawnFloat();
    });
    return () => {
      removeLikeListener('onReceiveLikesMessage');
    };
  }, [liveID, addLikeListener, removeLikeListener, spawnFloat]);

  useEffect(
    () => () => {
      clearReleaseTimer();
      flushBatch();
    },
    [flushBatch]
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {role !== 'anchor' && (
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={handleLikeTap}
        >
          <Animated.View
            style={[styles.button, { transform: [{ scale: btnScale }] }]}
          >
            <Image
              source={LIKE_ICON}
              style={styles.buttonIcon}
              resizeMode="contain"
            />
          </Animated.View>
        </Pressable>
      )}

      {floats.length > 0 && (
        <View style={styles.floatLayer} pointerEvents="none">
          {floats.map((f) => (
            <Animated.View
              key={f.id}
              style={[
                styles.float,
                {
                  left: rpxToPx(f.startX - FLOAT_SIZE / 2),
                  opacity: f.opacity,
                  transform: [
                    { translateX: f.translateX },
                    { translateY: f.translateY },
                    { scale: f.scale },
                  ],
                },
              ]}
            >
              <Image
                source={f.icon}
                style={styles.floatIcon}
                resizeMode="contain"
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
});

const BTN_CENTER_X = BTN_MARGIN_LEFT + BTN_SIZE / 2;
const BTN_CENTER_Y = BTN_SIZE / 2;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: rpxToPx(88),
    height: rpxToPx(72),
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: rpxToPx(BTN_SIZE),
    height: rpxToPx(BTN_SIZE),
    marginLeft: rpxToPx(BTN_MARGIN_LEFT),
    borderRadius: rpxToPx(BTN_SIZE / 2),
    backgroundColor: 'rgba(20, 20, 22, 0.54)',
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.055)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    width: rpxToPx(BTN_SIZE),
    height: rpxToPx(BTN_SIZE),
  },
  floatLayer: {
    position: 'absolute',
    left: rpxToPx(BTN_CENTER_X + BTN_CENTER_FROM_RIGHT - LAYER_W),
    top: rpxToPx(BTN_CENTER_Y - LAYER_H),
    width: rpxToPx(LAYER_W),
    height: rpxToPx(LAYER_H),
    zIndex: 100,
    elevation: 100,
  },
  float: {
    position: 'absolute',
    bottom: rpxToPx(-FLOAT_SIZE / 2),
    width: rpxToPx(FLOAT_SIZE),
    height: rpxToPx(FLOAT_SIZE),
  },
  floatIcon: {
    width: rpxToPx(FLOAT_SIZE),
    height: rpxToPx(FLOAT_SIZE),
  },
});

export default Like;
