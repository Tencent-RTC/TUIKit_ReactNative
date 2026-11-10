import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { rpxToPx } from '../../../utils/unitUtils';

export type ToastPosition = 'center' | 'top';

export interface ToastProps {
  visible?: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  duration?: number;
  position?: ToastPosition;
}

const DEFAULT_DURATION = 2400;
const SHOW_DURATION = 220;
const HIDE_DURATION = 200;
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const CSS_EASE_IN = Easing.bezier(0.42, 0, 1, 1);

const HALOS = [
  { inset: 0, size: 32, color: 'rgba(126, 232, 255, 0.05)' },
  { inset: 2, size: 28, color: 'rgba(126, 232, 255, 0.11)' },
  { inset: 4, size: 24, color: 'rgba(126, 232, 255, 0.20)' },
  { inset: 6, size: 20, color: 'rgba(126, 232, 255, 0.34)' },
  { inset: 8, size: 16, color: 'rgba(126, 232, 255, 0.55)' },
];

export function Toast({
  visible = false,
  onClose,
  title = '',
  message = '',
  duration = DEFAULT_DURATION,
  position = 'center',
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    opacity.setValue(0);
    scale.setValue(0.9);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: SHOW_DURATION,
        easing: CSS_EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: SHOW_DURATION,
        easing: CSS_EASE_OUT,
        useNativeDriver: true,
      }),
    ]).start();

    const autoCloseMs = duration > 0 ? duration : DEFAULT_DURATION;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: HIDE_DURATION,
          easing: CSS_EASE_IN,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.96,
          duration: HIDE_DURATION,
          easing: CSS_EASE_IN,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onCloseRef.current?.();
      });
    }, autoCloseMs);

    return () => {
      clearTimeout(timer);
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [visible, duration, opacity, scale]);

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        position === 'top' ? styles.layerTop : styles.layerCenter,
      ]}
    >
      <Animated.View style={[styles.chip, { opacity, transform: [{ scale }] }]}>
        <View style={styles.dotWrap}>
          {HALOS.map((halo) => (
            <View
              key={halo.size}
              style={[
                styles.halo,
                {
                  top: rpxToPx(halo.inset),
                  left: rpxToPx(halo.inset),
                  width: rpxToPx(halo.size),
                  height: rpxToPx(halo.size),
                  borderRadius: rpxToPx(halo.size / 2),
                  backgroundColor: halo.color,
                },
              ]}
            />
          ))}
          <View style={styles.dot} />
        </View>
        <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
          {title || message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  layerCenter: {
    justifyContent: 'center',
  },
  layerTop: {
    justifyContent: 'flex-start',
    paddingTop: rpxToPx(300),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: rpxToPx(18),
    paddingRight: rpxToPx(32),
    paddingBottom: rpxToPx(18),
    paddingLeft: rpxToPx(28),
    borderRadius: rpxToPx(999),
    backgroundColor: 'rgba(5, 50, 127, 0.92)',
    experimental_backgroundImage:
      'linear-gradient(to right, rgba(5, 50, 127, 0.92), rgba(56, 99, 112, 0.88))',
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.10)',
    boxShadow: `0 ${rpxToPx(8)}px ${rpxToPx(24)}px rgba(0, 82, 217, 0.35)`,
  },
  dotWrap: {
    position: 'relative',
    width: rpxToPx(32),
    height: rpxToPx(32),
    marginRight: rpxToPx(14),
  },
  halo: {
    position: 'absolute',
  },
  dot: {
    position: 'absolute',
    top: rpxToPx(10),
    left: rpxToPx(10),
    width: rpxToPx(12),
    height: rpxToPx(12),
    borderRadius: rpxToPx(6),
    backgroundColor: '#4A9EFF',
    experimental_backgroundImage: 'linear-gradient(to right, #4A9EFF, #7EE8FF)',
  },
  text: {
    color: '#ffffff',
    fontSize: rpxToPx(24),
    fontWeight: '600',
    maxWidth: rpxToPx(520),
  },
});

export default Toast;
