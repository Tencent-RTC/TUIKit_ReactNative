import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { pxToRpx, rpxToPx } from '../../../utils/unitUtils';

const GLOW_IMAGE = require('../../../static/assets/live/drawer-glow.png');

const ANIM_DURATION = 320;
const ANIM_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const SHIFT_DURATION = 340;
const SHIFT_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const DRAG_BACK_DURATION = 200;
const OPEN_GUARD_MS = 400;
const PRELOAD_DELAY_MS = 800;
const SAFE_BOTTOM_MIN_RPX = 60;
const DISMISS_THRESHOLD_PX = 88;
const DRAG_ACTIVATE_PX = 16;
const FULL_WIDTH = rpxToPx(750);

interface HostEntry {
  order: number;
  node: React.ReactNode;
}

interface DrawerHostValue {
  set: (key: string, entry: HostEntry) => void;
  remove: (key: string) => void;
  nextOrder: () => number;
}

const DrawerHostContext = createContext<DrawerHostValue | null>(null);

export interface DrawerHostProps {
  children?: React.ReactNode;
}

export function DrawerHost({ children }: DrawerHostProps) {
  const [entries, setEntries] = useState<ReadonlyMap<string, HostEntry>>(
    () => new Map()
  );
  const orderRef = useRef(0);

  const value = useMemo<DrawerHostValue>(
    () => ({
      set: (key, entry) =>
        setEntries((prev) => {
          const current = prev.get(key);
          if (current?.order === entry.order && current.node === entry.node) {
            return prev;
          }
          const next = new Map(prev);
          next.set(key, entry);
          return next;
        }),
      remove: (key) =>
        setEntries((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Map(prev);
          next.delete(key);
          return next;
        }),
      nextOrder: () => {
        orderRef.current += 1;
        return orderRef.current;
      },
    }),
    []
  );

  return (
    <DrawerHostContext.Provider value={value}>
      {children}
      <View style={styles.hostLayer} pointerEvents="box-none">
        {Array.from(entries, ([key, entry]) => (
          <View
            key={key}
            style={[StyleSheet.absoluteFill, { zIndex: entry.order }]}
            pointerEvents="box-none"
          >
            {entry.node}
          </View>
        ))}
      </View>
    </DrawerHostContext.Provider>
  );
}

export interface DrawerProps {
  visible?: boolean;
  onClose?: () => void;
  onOverlayTap?: () => void;
  height?: number;
  borderRadius?: number;
  overlayOpacity?: number;
  bgImage?: string | ImageSourcePropType;
  showHandle?: boolean;
  bgImageHeight?: number;
  padding?: string;
  showGlow?: boolean;
  glowHeight?: number;
  useSafeBottom?: boolean;
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}

export interface DrawerRef {
  animateShift: (shifted: boolean) => void;
}

function parsePadding(padding: string): ViewStyle {
  const values = padding
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const num = parseFloat(token);
      if (Number.isNaN(num)) return 0;
      return token.endsWith('rpx') ? rpxToPx(num) : num;
    });
  const [top = 0, right = top, bottom = top, left = right] = values;
  return {
    paddingTop: top,
    paddingRight: right,
    paddingBottom: bottom,
    paddingLeft: left,
  };
}

export const Drawer = forwardRef<DrawerRef, DrawerProps>(function Drawer(
  {
    visible = false,
    onClose,
    onOverlayTap,
    height = 500,
    borderRadius = 52,
    overlayOpacity = 0.4,
    bgImage = '',
    showHandle = true,
    bgImageHeight = 0,
    padding = '0 32rpx 44rpx 32rpx',
    showGlow = true,
    glowHeight = 160,
    useSafeBottom = false,
    overlay,
    children,
  },
  ref
) {
  const host = useContext(DrawerHostContext);
  const hostKey = useId();
  const insets = useContext(SafeAreaInsetsContext);
  const safeBottomRpx = useMemo(() => {
    if (!useSafeBottom) return 0;
    const insetRpx = Math.round(pxToRpx(insets?.bottom ?? 0));
    return Math.max(insetRpx, SAFE_BOTTOM_MIN_RPX);
  }, [useSafeBottom, insets?.bottom]);

  const totalHeightRpx = height + safeBottomRpx;
  const glowOffsetRpx = showGlow ? glowHeight / 2 : 0;
  const wrapperHeightPx = rpxToPx(totalHeightRpx + glowOffsetRpx);

  const [modalVisible, setModalVisible] = useState(visible);
  const [preloaded, setPreloaded] = useState(false);
  const translateY = useRef(new Animated.Value(wrapperHeightPx)).current;
  const overlayProgress = useRef(new Animated.Value(0)).current;
  const shiftX = useRef(new Animated.Value(0)).current;
  const openedAtRef = useRef(0);
  const hostOrderRef = useRef(0);
  const hostOrderedRef = useRef(false);
  const hostMountedRef = useRef(false);

  const modalShownRef = useRef(false);
  const openFrameRef = useRef<number | null>(null);

  const latest = useRef({
    visible,
    onClose,
    totalHeightRpx,
    wrapperHeightPx,
    preloaded,
  });
  latest.current = {
    visible,
    onClose,
    totalHeightRpx,
    wrapperHeightPx,
    preloaded,
  };

  const inHost = !!host && (preloaded || visible);

  useEffect(() => {
    if (!host || preloaded) return;
    if (visible) {
      setPreloaded(true);
      return;
    }
    const timer = setTimeout(() => setPreloaded(true), PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [host, preloaded, visible]);

  const cancelOpenFrame = useCallback(() => {
    if (openFrameRef.current != null) {
      cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
  }, []);

  const animateOpen = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIM_DURATION,
        easing: ANIM_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(overlayProgress, {
        toValue: 1,
        duration: ANIM_DURATION,
        easing: CSS_EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, overlayProgress]);

  const startOpen = useCallback(() => {
    cancelOpenFrame();
    openedAtRef.current = Date.now();
    openFrameRef.current = requestAnimationFrame(() => {
      openFrameRef.current = null;
      if (!latest.current.visible) return;
      animateOpen();
    });
  }, [cancelOpenFrame, animateOpen]);

  const handleModalShow = useCallback(() => {
    modalShownRef.current = true;
    startOpen();
  }, [startOpen]);

  useEffect(() => cancelOpenFrame, [cancelOpenFrame]);

  useEffect(() => {
    translateY.stopAnimation();
    overlayProgress.stopAnimation();
    cancelOpenFrame();
    if (visible) {
      openedAtRef.current = Date.now();
      if (host && latest.current.preloaded) {
        animateOpen();
      } else if (host || modalShownRef.current) {
        startOpen();
      } else {
        translateY.setValue(latest.current.wrapperHeightPx);
        overlayProgress.setValue(0);
        setModalVisible(true);
      }
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: latest.current.wrapperHeightPx,
        duration: ANIM_DURATION,
        easing: ANIM_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(overlayProgress, {
        toValue: 0,
        duration: ANIM_DURATION,
        easing: CSS_EASE,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (host || !finished || latest.current.visible) return;
      modalShownRef.current = false;
      setModalVisible(false);
    });
  }, [
    visible,
    host,
    translateY,
    overlayProgress,
    cancelOpenFrame,
    startOpen,
    animateOpen,
  ]);

  useEffect(() => {
    if (!latest.current.visible) translateY.setValue(wrapperHeightPx);
  }, [wrapperHeightPx, translateY]);

  useEffect(() => {
    if (!host || !visible) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        latest.current.onClose?.();
        return true;
      }
    );
    return () => subscription.remove();
  }, [host, visible]);

  useImperativeHandle(
    ref,
    () => ({
      animateShift: (shifted: boolean) => {
        Animated.timing(shiftX, {
          toValue: shifted ? -FULL_WIDTH : 0,
          duration: SHIFT_DURATION,
          easing: SHIFT_EASING,
          useNativeDriver: true,
        }).start();
      },
    }),
    [shiftX]
  );

  const handleOverlayTap = useCallback(() => {
    if (Date.now() - openedAtRef.current < OPEN_GUARD_MS) return;
    onOverlayTap?.();
    onClose?.();
  }, [onOverlayTap, onClose]);

  const handleRequestClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const dragRef = useRef({ active: false, offset: 0 });
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.visible,
      onMoveShouldSetPanResponder: () => latest.current.visible,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragRef.current = { active: false, offset: 0 };
      },
      onPanResponderMove: (_, gesture) => {
        if (!latest.current.visible) return;
        const fingerDelta = gesture.dy;
        if (!dragRef.current.active) {
          if (fingerDelta < DRAG_ACTIVATE_PX) return;
          dragRef.current.active = true;
        }
        dragRef.current.offset = Math.max(0, fingerDelta);
        translateY.setValue(Math.round(dragRef.current.offset));
      },
      onPanResponderRelease: () => finishDrag(),
      onPanResponderTerminate: () => finishDrag(),
    })
  ).current;

  function finishDrag() {
    if (!dragRef.current.active) return;
    const threshold = Math.min(
      DISMISS_THRESHOLD_PX,
      Math.round(rpxToPx(latest.current.totalHeightRpx) / 3)
    );
    const dismiss = dragRef.current.offset >= threshold;
    dragRef.current = { active: false, offset: 0 };
    if (dismiss) {
      latest.current.onClose?.();
      return;
    }
    Animated.timing(translateY, {
      toValue: 0,
      duration: DRAG_BACK_DURATION,
      easing: CSS_EASE_OUT,
      useNativeDriver: true,
    }).start();
  }

  const contentPadding = useMemo(() => parsePadding(padding), [padding]);
  const bgSource: ImageSourcePropType | null =
    typeof bgImage === 'string' ? (bgImage ? { uri: bgImage } : null) : bgImage;
  const radius = rpxToPx(borderRadius);
  const topRadius = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
  };

  const sheet = (
    <View style={styles.container} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View
        style={[
          styles.mask,
          {
            backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
            opacity: overlayProgress,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleOverlayTap} />
      </Animated.View>
      <Animated.View
        style={[
          styles.wrapper,
          { height: wrapperHeightPx, transform: [{ translateY }] },
        ]}
      >
        <Animated.View
          style={[
            styles.wrapper,
            { height: wrapperHeightPx, transform: [{ translateX: shiftX }] },
          ]}
        >
          {showGlow && (
            <Image
              source={GLOW_IMAGE}
              resizeMode="stretch"
              style={[
                styles.glow,
                {
                  bottom: rpxToPx(height - glowHeight / 2),
                  height: rpxToPx(glowHeight),
                },
              ]}
            />
          )}
          <View
            style={[
              styles.drawer,
              topRadius,
              { height: rpxToPx(totalHeightRpx) },
            ]}
          >
            {bgSource && (
              <Image
                source={bgSource}
                resizeMode="stretch"
                style={[
                  styles.bgImage,
                  topRadius,
                  {
                    height: rpxToPx(bgImageHeight > 0 ? bgImageHeight : height),
                  },
                ]}
              />
            )}
            <View style={[styles.content, contentPadding]}>
              {showHandle && (
                <View style={styles.handle} {...handlePanResponder.panHandlers}>
                  <View style={styles.handleBar} />
                </View>
              )}
              {children}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
      {overlay}
    </View>
  );

  useLayoutEffect(() => {
    if (!host || !inHost) return;
    if (!visible && !hostOrderedRef.current && hostMountedRef.current) return;
    if (visible && !hostOrderedRef.current) {
      hostOrderRef.current = host.nextOrder();
    }
    hostOrderedRef.current = visible;
    hostMountedRef.current = true;
    host.set(hostKey, { order: hostOrderRef.current, node: sheet });
  });

  useEffect(() => {
    if (!host) return;
    return () => host.remove(hostKey);
  }, [host, hostKey]);

  if (host) return null;

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      statusBarTranslucent
      onShow={handleModalShow}
      onRequestClose={handleRequestClose}
    >
      {sheet}
    </Modal>
  );
});

const styles = StyleSheet.create({
  hostLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9000,
    elevation: 9000,
  },
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: FULL_WIDTH,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: FULL_WIDTH,
    backgroundColor: '#0a090e',
    overflow: 'hidden',
    flexDirection: 'column',
    alignItems: 'center',
  },
  bgImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FULL_WIDTH,
  },
  content: {
    position: 'relative',
    flex: 1,
    width: FULL_WIDTH,
    flexDirection: 'column',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    left: 0,
    width: FULL_WIDTH,
  },
  handle: {
    width: FULL_WIDTH,
    height: rpxToPx(56),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: rpxToPx(4),
    marginBottom: rpxToPx(16),
  },
  handleBar: {
    width: rpxToPx(72),
    height: rpxToPx(8),
    borderRadius: rpxToPx(4),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default Drawer;
