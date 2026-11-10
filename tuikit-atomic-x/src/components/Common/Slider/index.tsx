import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { rpxToPx } from '../../../utils/unitUtils';

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  trackWidth?: number;
  trackHeight?: number;
  thumbSize?: number;
  hitHeight?: number;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  disabled?: boolean;
  throttleMs?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
}

const ECHO_WINDOW_MS = 600;
const DRAG_RELEASE_DELAY_MS = 200;

const clampRatio = (value: number, min: number, max: number) => {
  const range = Math.max(1, max - min);
  return Math.max(0, Math.min(1, (value - min) / range));
};

const sliderOffsets = (
  raw: number,
  min: number,
  max: number,
  trackWidth: number,
  thumbSize: number
) => {
  const fillRpx = clampRatio(raw, min, max) * trackWidth;
  return {
    fill: rpxToPx(fillRpx),
    thumb: rpxToPx(
      Math.max(0, Math.min(trackWidth - thumbSize, fillRpx - thumbSize / 2))
    ),
  };
};

export function Slider({
  value = 0,
  min = 0,
  max = 9,
  trackWidth = 320,
  trackHeight = 8,
  thumbSize = 20,
  hitHeight = 60,
  activeColor = '#4A9EFF',
  inactiveColor = 'rgba(255, 255, 255, 0.14)',
  thumbColor = '#ffffff',
  disabled = false,
  throttleMs = 50,
  onChange,
  onChangeEnd,
}: SliderProps) {
  const [{ fillWidth, thumbLeft }] = useState(() => {
    const offsets = sliderOffsets(value, min, max, trackWidth, thumbSize);
    return {
      fillWidth: new Animated.Value(offsets.fill),
      thumbLeft: new Animated.Value(offsets.thumb),
    };
  });
  const placeRef = useRef<(raw: number) => void>(() => {});

  const propsRef = useRef({
    min,
    max,
    trackWidth,
    thumbSize,
    disabled,
    throttleMs,
    onChange,
    onChangeEnd,
  });
  propsRef.current = {
    min,
    max,
    trackWidth,
    thumbSize,
    disabled,
    throttleMs,
    onChange,
    onChangeEnd,
  };

  const state = useRef({
    dragging: false,
    startValue: value,
    rawFloat: value,
    display: value,
    lastEmittedValue: value,
    releaseAt: 0,
    pendingValue: null as number | null,
    throttleTimer: null as ReturnType<typeof setTimeout> | null,
    releaseTimer: null as ReturnType<typeof setTimeout> | null,
  }).current;

  placeRef.current = (raw: number) => {
    const p = propsRef.current;
    const offsets = sliderOffsets(raw, p.min, p.max, p.trackWidth, p.thumbSize);
    fillWidth.setValue(offsets.fill);
    thumbLeft.setValue(offsets.thumb);
  };

  useEffect(() => {
    if (state.dragging) return;
    if (
      value === state.lastEmittedValue &&
      Date.now() - state.releaseAt < ECHO_WINDOW_MS
    )
      return;
    state.display = value;
    state.rawFloat = value;
    placeRef.current(value);
  });

  useEffect(
    () => () => {
      if (state.throttleTimer) clearTimeout(state.throttleTimer);
      if (state.releaseTimer) clearTimeout(state.releaseTimer);
    },
    [state]
  );

  const emitInputThrottled = (v: number) => {
    if (state.throttleTimer != null) {
      state.pendingValue = v;
      return;
    }
    state.lastEmittedValue = v;
    propsRef.current.onChange?.(v);
    state.throttleTimer = setTimeout(() => {
      state.throttleTimer = null;
      const tail = state.pendingValue;
      state.pendingValue = null;
      if (tail != null && tail !== state.lastEmittedValue) {
        state.lastEmittedValue = tail;
        propsRef.current.onChange?.(tail);
      }
    }, propsRef.current.throttleMs);
  };

  const emitInputImmediate = (v: number) => {
    if (state.throttleTimer != null) {
      clearTimeout(state.throttleTimer);
      state.throttleTimer = null;
    }
    state.pendingValue = null;
    state.lastEmittedValue = v;
    propsRef.current.onChange?.(v);
  };

  const finishDrag = () => {
    if (!state.dragging) return;
    emitInputImmediate(state.display);
    propsRef.current.onChangeEnd?.(state.display);
    state.releaseAt = Date.now();
    if (state.releaseTimer) clearTimeout(state.releaseTimer);
    state.releaseTimer = setTimeout(() => {
      state.releaseTimer = null;
      state.dragging = false;
    }, DRAG_RELEASE_DELAY_MS);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        if (state.releaseTimer) {
          clearTimeout(state.releaseTimer);
          state.releaseTimer = null;
        }
        state.dragging = true;
        state.startValue = state.rawFloat;
      },
      onPanResponderMove: (_, gesture) => {
        if (!state.dragging) return;
        const p = propsRef.current;
        const range = Math.max(1, p.max - p.min);
        const deltaValue = (gesture.dx / rpxToPx(p.trackWidth)) * range;
        const raw = Math.max(
          p.min,
          Math.min(p.max, state.startValue + deltaValue)
        );
        const next = Math.max(p.min, Math.min(p.max, Math.round(raw)));
        state.rawFloat = raw;
        placeRef.current(raw);
        if (next !== state.display) {
          state.display = next;
          emitInputThrottled(next);
        }
      },
      onPanResponderRelease: finishDrag,
      onPanResponderTerminate: finishDrag,
    })
  ).current;

  const trackRadius = rpxToPx(4);

  return (
    <View
      style={[
        styles.hit,
        { width: rpxToPx(trackWidth), height: rpxToPx(hitHeight) },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.track,
          {
            width: rpxToPx(trackWidth),
            height: rpxToPx(trackHeight),
            borderRadius: trackRadius,
            backgroundColor: inactiveColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillWidth,
              height: rpxToPx(trackHeight),
              borderRadius: trackRadius,
              backgroundColor: activeColor,
            },
          ]}
        />
      </View>
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX: thumbLeft }],
            top: rpxToPx(Math.round((hitHeight - thumbSize) / 2)),
            width: rpxToPx(thumbSize),
            height: rpxToPx(thumbSize),
            borderRadius: rpxToPx(thumbSize / 2),
            backgroundColor: thumbColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    position: 'relative',
    justifyContent: 'center',
  },
  track: {
    position: 'relative',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    position: 'absolute',
    left: 0,
  },
});

export default Slider;
