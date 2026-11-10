import React, { memo, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon, Like, type IconName } from '@tencentcloud/react-native-tuikit-atomic-x';

import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx } from '../../../../utils';

const PRESS_ANIM_DURATION = 120;
const PRESS_ANIM_SCALE = 0.92;
const MIN_PRESS_VISIBLE_MS = 120;
const ACTION_LOCK_MS = 400;
const WAVE_BARS = [
  { left: 18.4, maxH: 12, scales: [0.6, 0.8] },
  { left: 28, maxH: 30, scales: [0.56, 0.83] },
  { left: 37.6, maxH: 36.8, scales: [0.61, 0.85] },
  { left: 47.2, maxH: 18, scales: [0.5, 0.8] },
];
const WAVE_START_DELAY_MS = [850, 600, 300, 0];
const WAVE_SEGMENT_MS = [560, 560, 480];

export interface BottomToolbarProps {
  micEnabled: boolean;
  micConnected: boolean;
  micDisabled: boolean;
  onCoGuestTap?: () => void;
  onMicConnectedTap?: () => void;
  onGiftTap?: () => void;
}

interface PressButtonProps {
  onAction: () => void;
  children: React.ReactNode;
}

function PressButton({ onAction, children }: PressButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressStartAtRef = useRef(0);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateScale = (pressed: boolean) => {
    Animated.timing(scale, {
      toValue: pressed ? PRESS_ANIM_SCALE : 1,
      duration: PRESS_ANIM_DURATION,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  };

  const clearReleaseTimer = () => {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  };

  const startPress = () => {
    clearReleaseTimer();
    pressStartAtRef.current = Date.now();
    animateScale(true);
  };

  const endPress = () => {
    clearReleaseTimer();
    const delay = Math.max(0, MIN_PRESS_VISIBLE_MS - (Date.now() - pressStartAtRef.current));
    if (delay === 0) {
      animateScale(false);
      return;
    }
    releaseTimerRef.current = setTimeout(() => {
      releaseTimerRef.current = null;
      animateScale(false);
    }, delay);
  };

  useEffect(() => clearReleaseTimer, []);

  return (
    <Pressable onPressIn={startPress} onPressOut={endPress} onPress={onAction}>
      <Animated.View style={[styles.btnBg, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function IconButton({
  icon,
  iconStyle,
  onAction,
}: {
  icon: IconName;
  iconStyle: StyleProp<ViewStyle>;
  onAction: () => void;
}) {
  return (
    <PressButton onAction={onAction}>
      <Icon name={icon} style={iconStyle} />
    </PressButton>
  );
}

function CoGuestWave() {
  const scales = useRef(WAVE_BARS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    const loops = WAVE_BARS.map((bar, i) => {
      const targets = [bar.scales[0], bar.scales[1], 1];
      return Animated.sequence([
        Animated.delay(WAVE_START_DELAY_MS[i]),
        Animated.loop(
          Animated.sequence(
            targets.map((toValue, seg) =>
              Animated.timing(scales[i], {
                toValue,
                duration: WAVE_SEGMENT_MS[seg],
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ),
          ),
        ),
      ]);
    });
    loops.forEach(anim => anim.start());
    return () => {
      loops.forEach(anim => anim.stop());
      scales.forEach(value => value.setValue(1));
    };
  }, [scales]);

  return (
    <View style={styles.wave}>
      {WAVE_BARS.map((bar, i) => (
        <View key={i} style={[styles.waveSlot, { left: rpxToPx(bar.left) }]}>
          <Animated.View
            style={[styles.waveBar, { height: rpxToPx(bar.maxH), transform: [{ scaleY: scales[i] }] }]}
          />
        </View>
      ))}
    </View>
  );
}

export const BottomToolbar = memo(function BottomToolbar({
  micEnabled,
  micConnected,
  onCoGuestTap,
  onMicConnectedTap,
  onGiftTap,
}: BottomToolbarProps) {
  const lastActionAtRef = useRef(0);

  const withActionLock = (cb?: () => void) => () => {
    const now = Date.now();
    if (now - lastActionAtRef.current < ACTION_LOCK_MS) return;
    lastActionAtRef.current = now;
    cb?.();
  };

  return (
    <View style={styles.operateButtons}>
      {micEnabled && !micConnected && (
        <IconButton icon="coGuest" iconStyle={styles.coGuestIcon} onAction={withActionLock(onCoGuestTap)} />
      )}
      {micEnabled && micConnected && (
        <PressButton onAction={withActionLock(onMicConnectedTap)}>
          <CoGuestWave />
        </PressButton>
      )}
      <PressButton onAction={withActionLock(onGiftTap)}>
        <Icon name="gift" style={styles.btnIcon} />
      </PressButton>
      <Like />
    </View>
  );
});

const styles = StyleSheet.create({
  operateButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnBg: {
    width: rpxToPx(72),
    height: rpxToPx(72),
    backgroundColor: T.darkBgFloat,
    borderRadius: rpxToPx(36),
    borderWidth: rpxToPx(2),
    borderColor: T.darkSurface055,
    marginLeft: rpxToPx(16),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnIcon: {
    width: rpxToPx(72),
    height: rpxToPx(72),
  },
  coGuestIcon: {
    width: rpxToPx(76),
    height: rpxToPx(64),
    margin: rpxToPx(-10),
  },
  wave: {
    width: rpxToPx(72),
    height: rpxToPx(72),
  },
  waveSlot: {
    position: 'absolute',
    top: 0,
    width: rpxToPx(6.4),
    height: rpxToPx(72),
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveBar: {
    width: rpxToPx(6.4),
    backgroundColor: '#f5f7fa',
    borderRadius: rpxToPx(3.2),
  },
});

export default BottomToolbar;
