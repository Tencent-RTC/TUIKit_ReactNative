import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { AnimatedText, Text } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx } from '../../../../utils';

export interface CountdownOverlayProps {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onFinished?: () => void;
}

const START_COUNT = 3;
const TICK_MS = 1000;
const ENTER_MS = 180;
const EXIT_DELAY_MS = 800;
const EXIT_MS = 200;
const EASING = Easing.bezier(0.22, 1, 0.36, 1);

export function CountdownOverlay({ visible, onVisibleChange, onFinished }: CountdownOverlayProps) {
  const { t } = useLiveTranslation();
  const [count, setCount] = useState(START_COUNT);
  const scale = useRef(new Animated.Value(1.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onVisibleChange, onFinished });
  callbacksRef.current = { onVisibleChange, onFinished };

  const clearTimers = useCallback(() => {
    if (tickTimerRef.current != null) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (fadeTimerRef.current != null) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const showNum = useCallback(
    (value: number) => {
      if (fadeTimerRef.current != null) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      setCount(value);
      scale.stopAnimation();
      opacity.stopAnimation();
      scale.setValue(1.6);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: ENTER_MS, easing: EASING, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: ENTER_MS, easing: EASING, useNativeDriver: true }),
      ]).start();
      fadeTimerRef.current = setTimeout(() => {
        fadeTimerRef.current = null;
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.85, duration: EXIT_MS, easing: EASING, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: EXIT_MS, easing: EASING, useNativeDriver: true }),
        ]).start();
      }, EXIT_DELAY_MS);
    },
    [scale, opacity],
  );

  useEffect(() => {
    if (!visible) {
      clearTimers();
      return undefined;
    }
    let n = START_COUNT;
    showNum(n);
    tickTimerRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearTimers();
        callbacksRef.current.onVisibleChange(false);
        callbacksRef.current.onFinished?.();
        return;
      }
      showNum(n);
    }, TICK_MS);
    return clearTimers;
  }, [visible, clearTimers, showNum]);

  if (!visible) return null;

  return (
    <View style={styles.layer}>
      <View style={styles.circle}>
        <AnimatedText style={[styles.num, { opacity, transform: [{ scale }] }]}>{count}</AnimatedText>
      </View>
      <Pressable style={styles.cancel} onPress={() => onVisibleChange(false)}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200,
    backgroundColor: T.mask12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: rpxToPx(300),
    height: rpxToPx(300),
    borderRadius: rpxToPx(150),
    backgroundColor: T.mask32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rpxToPx(204),
  },
  num: {
    fontSize: rpxToPx(192),
    fontWeight: '300',
    color: T.darkTextPrimary,
    lineHeight: rpxToPx(192),
    includeFontPadding: false,
  },
  cancel: {
    position: 'absolute',
    bottom: rpxToPx(50),
    left: rpxToPx(175),
    width: rpxToPx(400),
    height: rpxToPx(98),
    borderRadius: rpxToPx(28),
    backgroundColor: T.darkBgSheet72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: rpxToPx(32),
    fontWeight: '500',
    color: T.darkText92,
  },
});

export default CountdownOverlay;
