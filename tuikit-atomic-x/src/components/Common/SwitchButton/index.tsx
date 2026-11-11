import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { rpxToPx } from '../../../utils/unitUtils';

export interface SwitchButtonProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
}

const TRACK_WIDTH = 88;
const TRACK_HEIGHT = 44;
const THUMB_SIZE = 36;
const THUMB_INSET = 4;
const TRAVEL = rpxToPx(TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2);
const TRANSITION_MS = 150;
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const TRACK_OFF = 'rgba(79, 88, 107, 0.3)';
const TRACK_ON = '#007AFF';

export function SwitchButton({ value = false, onChange }: SwitchButtonProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: TRANSITION_MS,
      easing: CSS_EASE_OUT,
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_OFF, TRACK_ON],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  return (
    <Pressable
      onPress={() => onChange?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View
          style={[styles.thumb, { transform: [{ translateX }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    width: rpxToPx(TRACK_WIDTH),
    height: rpxToPx(TRACK_HEIGHT),
    borderRadius: rpxToPx(TRACK_HEIGHT / 2),
  },
  thumb: {
    position: 'absolute',
    top: rpxToPx(THUMB_INSET),
    left: rpxToPx(THUMB_INSET),
    width: rpxToPx(THUMB_SIZE),
    height: rpxToPx(THUMB_SIZE),
    borderRadius: rpxToPx(THUMB_SIZE / 2),
    backgroundColor: '#FFFFFF',
  },
});

export default SwitchButton;
