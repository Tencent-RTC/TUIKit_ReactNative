import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from '../Common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DeviceStatus,
  useCoGuestState,
  useCoHostState,
  useDeviceState,
  useLiveListState,
  useLiveSeatState,
  useLoginState,
  type SeatInfo,
} from '../../atomic-x';
import { Icon, rpxToPx } from '../Common';
import {
  LiveCoreViewNative,
  type LiveCoreViewNativeRef,
} from '../../native/LiveCoreViewNative';
import {
  LiveStreamActionPanel,
  getDisplayName,
  isDeviceOff,
  type StreamUserInfo,
} from './LiveStreamActionPanel';
import { useLiveStreamViewTranslation } from './locales';

const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');
const NO_VIDEO_GRADIENT = 'linear-gradient(to bottom right, #1a2e45, #080f1f)';
const NO_VIDEO_PATCH_COLOR = '#111f32';

type Rect = { left: number; top: number; right: number; bottom: number };

const subtractRects = (base: Rect[], holes: Rect[]): Rect[] =>
  holes.reduce((rects, h) => {
    const next: Rect[] = [];
    rects.forEach((r) => {
      if (
        h.right <= r.left ||
        h.left >= r.right ||
        h.bottom <= r.top ||
        h.top >= r.bottom
      ) {
        next.push(r);
        return;
      }
      const top = Math.max(r.top, h.top);
      const bottom = Math.min(r.bottom, h.bottom);
      if (h.top > r.top)
        next.push({ left: r.left, top: r.top, right: r.right, bottom: h.top });
      if (h.bottom < r.bottom)
        next.push({
          left: r.left,
          top: h.bottom,
          right: r.right,
          bottom: r.bottom,
        });
      if (h.left > r.left)
        next.push({ left: r.left, top, right: h.left, bottom });
      if (h.right < r.right)
        next.push({ left: h.right, top, right: r.right, bottom });
    });
    return next.filter((r) => r.right > r.left && r.bottom > r.top);
  }, base);
const SUSPEND_IN_BACKGROUND = 1;

const MASK_SETTLE_MS = 400;
const MASK_FORCE_CHECK_MS = 3000;
const MASK_FORCE_ATTEMPTS = 2;
const FLOAT_EDGE_GAP = 12;
const BOTTOM_PANEL_HEIGHT = Platform.OS === 'ios' ? 60 : 80;
const TEMPLATE_DYNAMIC_GRID = 600;
const TEMPLATE_GRID_9 = 800;
const TEMPLATE_FLOAT_7 = 801;

export interface LiveStreamViewProps {
  liveID?: string;
  isAnchor?: boolean;
  templateLayout?: number;
  isLiving?: boolean;
  currentLoginUserId?: string;
  enableClickPanel?: boolean;
  onStreamViewClick?: (payload: StreamUserInfo) => void;
  onActionPanelVisibleChange?: (visible: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

export interface LiveStreamViewRef {
  setLocalVideoMuteImage: (
    bigImage: ImageSourcePropType,
    smallImage: ImageSourcePropType
  ) => void;
  streamViewClick: (target?: Partial<SeatInfo> | null) => void;
}

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

function toRegion(seat: SeatInfo | undefined | null): Region | null {
  const r = seat?.region;
  if (!r) return null;
  return { x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h) };
}

function avatarSource(url: unknown) {
  return typeof url === 'string' && url ? { uri: url } : DEFAULT_AVATAR;
}

export const LiveStreamView = forwardRef<
  LiveStreamViewRef,
  LiveStreamViewProps
>(function LiveStreamView(
  {
    liveID: liveIDProp = '',
    isAnchor = true,
    templateLayout,
    isLiving = false,
    currentLoginUserId,
    enableClickPanel = false,
    onStreamViewClick,
    onActionPanelVisibleChange,
    style,
  },
  ref
) {
  const { t } = useLiveStreamViewTranslation();
  const windowSize = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { loginUserInfo } = useLoginState();
  const { currentLive } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { connected: coHostConnected } = useCoHostState(liveID);
  const { cameraStatus } = useDeviceState();
  const { connected: audienceConnected } = useCoGuestState(liveID);
  const { seatList: rawSeatList, canvas } = useLiveSeatState(liveID);
  const seatList = useMemo(() => rawSeatList || [], [rawSeatList]);

  const safeAreaWidth = windowSize.width - insets.left - insets.right;
  const [layoutHeight, setLayoutHeight] = useState(windowSize.height);
  const pageHeight = layoutHeight || windowSize.height;
  const safeAreaBottom = pageHeight - insets.bottom;
  const viewWidthPx = Math.max(
    windowSize.width || 0,
    Dimensions.get('screen').width || 0
  );
  const dispWidth = isAnchor ? safeAreaWidth : viewWidthPx;
  const containerHeight = isAnchor ? safeAreaBottom : pageHeight;
  const streamViewHeight = isAnchor
    ? safeAreaBottom - BOTTOM_PANEL_HEIGHT
    : pageHeight;

  // adjustResize shrinks the page while the keyboard is up; keep the stream at its full height so
  // the video and seat overlays don't jump up under the comment input.
  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height <= 0 || Keyboard.isVisible()) return;
    setLayoutHeight(height);
  }, []);

  // Derived during render so the canvas and seatList committed together are drawn in the same frame.
  const effCanvasRef = useRef<{ w: number; h: number } | null>(null);
  const effCanvas = useMemo(() => {
    const w = Number(canvas?.w);
    const h = Number(canvas?.h);
    const prev = effCanvasRef.current;
    if (!w || !h) return prev;
    return prev && prev.w === w && prev.h === h ? prev : { w, h };
  }, [canvas]);
  effCanvasRef.current = effCanvas;

  const [showLoadingMask, setShowLoadingMask] = useState(true);
  const maskStateRef = useRef({ showLoadingMask, effCanvas });
  maskStateRef.current = { showLoadingMask, effCanvas };

  // Reset the reveal debounce on every canvas / seat-count / height change while
  // entering, so the cover→fit layout flip of the SDK stays hidden under the mask.
  useEffect(() => {
    if (!showLoadingMask || !effCanvas) return undefined;
    const timer = setTimeout(() => setShowLoadingMask(false), MASK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [showLoadingMask, effCanvas, seatList, streamViewHeight]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const forceReveal = (attempt: number) => {
      const { showLoadingMask: masked, effCanvas: ready } =
        maskStateRef.current;
      if (!masked) return;
      if (ready || attempt >= MASK_FORCE_ATTEMPTS) {
        setShowLoadingMask(false);
        return;
      }
      timer = setTimeout(() => forceReveal(attempt + 1), MASK_FORCE_CHECK_MS);
    };
    timer = setTimeout(() => forceReveal(0), MASK_FORCE_CHECK_MS);
    return () => clearTimeout(timer);
  }, []);

  const isSelfOnSeat = useMemo(() => {
    if (!currentLoginUserId) return false;
    return seatList.some((s) => s?.userInfo?.userID === currentLoginUserId);
  }, [seatList, currentLoginUserId]);

  const tpl = Number(templateLayout);
  const isFullscreenFloatTemplate = tpl === 601 || tpl === 605;
  const isGridTemplate = tpl === TEMPLATE_GRID_9;
  const isGridLayout = tpl === TEMPLATE_GRID_9 || tpl === TEMPLATE_FLOAT_7;

  const isMainHostSeat = useCallback(
    (seat: SeatInfo) => {
      const r = toRegion(seat);
      return !!effCanvas && !!r && r.w === effCanvas.w && r.h === effCanvas.h;
    },
    [effCanvas]
  );

  const seatOwnerID = String(currentLive?.liveOwner?.userID || '');
  const hasGuests = audienceConnected.length > 0;
  const showsSeatOverlay = (seat: SeatInfo) => {
    const userID = String(seat.userInfo?.userID || '');
    if (!userID) return false;
    const hostSeat = seatOwnerID
      ? userID === seatOwnerID
      : isMainHostSeat(seat);
    if (!isAnchor) return !hostSeat;
    if (hostSeat) {
      return (
        tpl === TEMPLATE_GRID_9 ||
        (tpl === TEMPLATE_DYNAMIC_GRID && hasGuests)
      );
    }
    return hasGuests;
  };

  // Later siblings draw on top, so the full-canvas host seat renders first and stays under the floating seats.
  const renderSeatList = useMemo(() => {
    if (!isFullscreenFloatTemplate || seatList.length <= 1) return seatList;
    return [
      ...seatList.filter((s) => isMainHostSeat(s)),
      ...seatList.filter((s) => !isMainHostSeat(s)),
    ];
  }, [seatList, isFullscreenFloatTemplate, isMainHostSeat]);

  const isFillMode = useMemo(() => {
    const c = effCanvas;
    if (!c) return false;
    if (c.w > c.h) return false;
    if (seatList.length <= 1) return true;
    if (isFullscreenFloatTemplate) return true;
    return seatList.some((s) => isMainHostSeat(s));
  }, [effCanvas, seatList, isFullscreenFloatTemplate, isMainHostSeat]);

  const scale = useMemo(() => {
    const c = effCanvas;
    if (!c) return 1;
    const sW = dispWidth / c.w;
    const sH = streamViewHeight / c.h;
    return isFillMode ? Math.max(sW, sH) : Math.min(sW, sH);
  }, [effCanvas, dispWidth, streamViewHeight, isFillMode]);

  const videoLeftOffset =
    isFillMode && effCanvas ? (dispWidth - effCanvas.w * scale) / 2 : 0;
  const videoTopOffset =
    isFillMode && effCanvas ? (streamViewHeight - effCanvas.h * scale) / 2 : 0;

  const gridEdges = useMemo(() => {
    const lefts: number[] = [];
    const tops: number[] = [];
    let maxRight = 0;
    let maxBottom = 0;
    seatList.forEach((seat) => {
      const r = toRegion(seat);
      if (!r) return;
      const l = Math.round(r.x * scale + videoLeftOffset);
      const tp = Math.round(r.y * scale + videoTopOffset);
      if (!lefts.includes(l)) lefts.push(l);
      if (!tops.includes(tp)) tops.push(tp);
      maxRight = Math.max(
        maxRight,
        Math.round((r.x + r.w) * scale + videoLeftOffset)
      );
      maxBottom = Math.max(
        maxBottom,
        Math.round((r.y + r.h) * scale + videoTopOffset)
      );
    });
    lefts.sort((a, b) => a - b);
    tops.sort((a, b) => a - b);
    return { lefts, tops, maxRight, maxBottom };
  }, [seatList, scale, videoLeftOffset, videoTopOffset]);

  const isRightAlignedFloat = useCallback(
    (seat: SeatInfo) =>
      isFullscreenFloatTemplate && isSelfOnSeat && !isMainHostSeat(seat),
    [isFullscreenFloatTemplate, isSelfOnSeat, isMainHostSeat]
  );

  const calcTop = (seat: SeatInfo) => {
    const r = toRegion(seat);
    if (!r) return 1;
    return Math.round(r.y * scale + videoTopOffset);
  };

  const calcLeft = (seat: SeatInfo) => {
    const r = toRegion(seat);
    if (!r) return 0;
    if (isRightAlignedFloat(seat)) {
      return Math.round(dispWidth - Math.round(r.w * scale) - FLOAT_EDGE_GAP);
    }
    return Math.round(r.x * scale + videoLeftOffset);
  };

  // Grid cells take the next column/row edge as their far edge so neighbours tile
  // exactly; the SDK regions overlap or gap by ±1px and would hide the 1rpx dividers.
  const calcWidth = (seat: SeatInfo) => {
    const r = toRegion(seat);
    if (!r) return 0;
    const left = Math.round(r.x * scale + videoLeftOffset);
    if (isGridTemplate) {
      const next = gridEdges.lefts.find((l) => l > left);
      return (next ?? gridEdges.maxRight) - left;
    }
    if (isRightAlignedFloat(seat)) return Math.round(r.w * scale);
    return Math.round((r.x + r.w) * scale + videoLeftOffset) - left;
  };

  const calcHeight = (seat: SeatInfo) => {
    const r = toRegion(seat);
    if (!r) return 0;
    const top = Math.round(r.y * scale + videoTopOffset);
    if (isGridTemplate) {
      const next = gridEdges.tops.find((v) => v > top);
      return (next ?? gridEdges.maxBottom) - top;
    }
    return Math.round((r.y + r.h) * scale + videoTopOffset) - top;
  };

  const [isShowClickPanel, setIsShowClickPanel] = useState(false);
  const [clickUserInfo, setClickUserInfo] = useState<StreamUserInfo>({});

  const panelVisibleRef = useRef(isShowClickPanel);
  useEffect(() => {
    if (panelVisibleRef.current === isShowClickPanel) return;
    panelVisibleRef.current = isShowClickPanel;
    onActionPanelVisibleChange?.(isShowClickPanel);
  }, [isShowClickPanel, onActionPanelVisibleChange]);

  const openPanel = useCallback(
    (user: StreamUserInfo) => {
      if (!enableClickPanel) return;
      setClickUserInfo(user);
      setIsShowClickPanel(true);
    },
    [enableClickPanel]
  );

  const streamViewClick = useCallback(
    (target?: Partial<SeatInfo> | null) => {
      if (!isLiving) return;
      const seatUser = target?.userInfo as StreamUserInfo | null | undefined;
      if (!isAnchor && !seatUser && !target?.region) return;

      if (isAnchor) {
        if (onStreamViewClick) {
          if (!seatUser?.userID) return;
          const selfID = loginUserInfo?.userID || currentLoginUserId;
          if (seatUser.userID === selfID) return;
          onStreamViewClick({ ...seatUser, seatIndex: target?.index });
          return;
        }
        if (seatUser) {
          const user = { ...seatUser, seatIndex: target?.index };
          if (!user.userID) return;
          if (audienceConnected.length > 1 && coHostConnected.length === 0) {
            openPanel(user);
          }
          if (
            coHostConnected.length > 0 &&
            user.userID === loginUserInfo?.userID
          ) {
            openPanel(user);
          }
        } else {
          openPanel({
            ...(loginUserInfo || {}),
            userID: loginUserInfo?.userID,
            userName: loginUserInfo?.nickname,
          });
        }
        return;
      }

      if (!seatUser?.userID) return;
      if (seatUser.userID === currentLoginUserId) return;
      onStreamViewClick?.({ ...(seatUser || {}), seatIndex: target?.index });
    },
    [
      isLiving,
      isAnchor,
      audienceConnected.length,
      coHostConnected.length,
      loginUserInfo,
      currentLoginUserId,
      onStreamViewClick,
      openPanel,
    ]
  );

  const coreViewRef = useRef<LiveCoreViewNativeRef>(null);
  useImperativeHandle(
    ref,
    () => ({
      setLocalVideoMuteImage: (bigImage, smallImage) =>
        coreViewRef.current?.setLocalVideoMuteImage(bigImage, smallImage),
      streamViewClick,
    }),
    [streamViewClick]
  );

  const renderInfoCapsule = (seat: SeatInfo) => {
    const r = toRegion(seat);
    return (
      <View style={styles.participantInfoContainer}>
        {isDeviceOff(seat.userInfo?.microphoneStatus) && (
          <Icon name="micOff" style={styles.micIcon} />
        )}
        <Text
          style={[
            styles.participantName,
            { maxWidth: (r?.w ?? 0) * scale * 0.85 },
          ]}
          numberOfLines={1}
        >
          {getDisplayName(seat.userInfo as StreamUserInfo | null)}
        </Text>
      </View>
    );
  };

  // The seat snapshot can lag behind the local preview, so the own seat reads the local camera status.
  const showsNoVideo = (seat: SeatInfo) => {
    const info = seat.userInfo;
    const userID = String(info?.userID || '');
    if (!userID) return false;
    if (Number(info?.userSuspendStatus) === SUSPEND_IN_BACKGROUND) return true;
    const selfID = String(loginUserInfo?.userID || currentLoginUserId || '');
    const status =
      selfID && userID === selfID ? cameraStatus : info?.cameraStatus;
    return isDeviceOff(status);
  };

  const noVideoBackground = (seat: SeatInfo): ViewStyle =>
    showsNoVideo(seat)
      ? { experimental_backgroundImage: NO_VIDEO_GRADIENT }
      : {};

  // The full-canvas host cell lies under the floating seats; painting it whole would cover their native video,
  // so only the area outside seats that are showing video is painted.
  const hostNoVideoPatches = (hostSeat: SeatInfo): ViewStyle[] => {
    if (!showsNoVideo(hostSeat)) return [];
    const left = calcLeft(hostSeat);
    const top = calcTop(hostSeat);
    const width = calcWidth(hostSeat);
    const height = calcHeight(hostSeat);
    const holes = seatList
      .filter((s) => s !== hostSeat && !!s.userInfo?.userID && !showsNoVideo(s))
      .map((s) => {
        const l = calcLeft(s) - left;
        const tp = calcTop(s) - top;
        return {
          left: l,
          top: tp,
          right: l + calcWidth(s),
          bottom: tp + calcHeight(s),
        };
      })
      .filter(
        (h) =>
          h.left >= 0 && h.top >= 0 && h.right <= width && h.bottom <= height
      );
    return subtractRects(
      [{ left: 0, top: 0, right: width, bottom: height }],
      holes
    ).map((r) => ({
      position: 'absolute',
      left: r.left,
      top: r.top,
      width: r.right - r.left,
      height: r.bottom - r.top,
      backgroundColor: NO_VIDEO_PATCH_COLOR,
    }));
  };

  const seatAvatarSize = (seat: SeatInfo): ImageStyle => {
    const shortSide = Math.min(calcWidth(seat), calcHeight(seat));
    let size = 63;
    if (shortSide <= 110) size = 42;
    else if (shortSide <= 140) size = 30;
    else if (shortSide > 250) size = 67;
    return { width: size, height: size, borderRadius: size / 2 };
  };

  const renderCenteredAvatar = (seat: SeatInfo) => (
    <View style={styles.videoContainer}>
      <Image
        style={[styles.participantVideo, seatAvatarSize(seat)]}
        source={avatarSource(seat.userInfo?.avatarURL)}
        resizeMode="cover"
      />
    </View>
  );

  const renderSingleCell = (seat: SeatInfo, colIndex: number) => {
    const noVideo = showsNoVideo(seat);
    const cellStyle: ViewStyle = {
      left: calcLeft(seat),
      top: calcTop(seat),
      ...noVideoBackground(seat),
    };
    return (
      <Pressable
        key={String(colIndex)}
        onPress={() => streamViewClick(seat)}
        style={[styles.gridContentCell, styles.roundedCell, cellStyle]}
      >
        <View
          style={[
            styles.singleInner,
            { width: calcWidth(seat), height: calcHeight(seat) },
          ]}
        >
          {noVideo && (
            <Image
              style={[styles.participantVideo, seatAvatarSize(seat)]}
              source={avatarSource(seat.userInfo?.avatarURL)}
              resizeMode="cover"
            />
          )}
        </View>
      </Pressable>
    );
  };

  const renderMultiCell = (seat: SeatInfo, colIndex: number) => {
    // A full-canvas host cell lies under the other seats; painting it would cover their native video.
    const isHostCanvasSeat = isMainHostSeat(seat);
    const cameraOff =
      isDeviceOff(seat.userInfo?.cameraStatus) && !isHostCanvasSeat;
    const noVideo = showsNoVideo(seat) && !isHostCanvasSeat;
    const width = calcWidth(seat);
    const height = calcHeight(seat);
    const divider = rpxToPx(1);
    const hasUser = !!seat.userInfo?.userID;
    const cellStyle: ViewStyle = {
      left: calcLeft(seat),
      top: calcTop(seat),
      width,
      height,
      ...(isHostCanvasSeat ? {} : noVideoBackground(seat)),
    };
    const sideDividers: ViewStyle = {
      borderLeftWidth: isAnchor && tpl === TEMPLATE_GRID_9 ? divider : 0,
      borderRightWidth: !isAnchor && tpl === TEMPLATE_GRID_9 ? divider : 0,
    };
    if (isGridLayout && cameraOff) {
      Object.assign(cellStyle, sideDividers, {
        borderBottomWidth: isAnchor ? 0 : divider,
      });
    }
    const waitStyle: ViewStyle = {
      ...sideDividers,
      width,
      height,
      borderBottomWidth: divider,
    };
    const compact = Math.min(width, height) <= 110;
    const plusHeight = compact ? 32 : 30;
    const plusBar = compact ? 18 : 16;
    const plusThickness = compact ? 1.4 : 1.2;
    const showsJoinInvite = height >= plusHeight + 3 + 14;

    return (
      <Pressable
        key={String(seat.index ?? colIndex)}
        onPress={() => streamViewClick(seat)}
        style={[styles.gridContentCell, styles.dividerColor, cellStyle]}
      >
        {isHostCanvasSeat &&
          hostNoVideoPatches(seat).map((patch, i) => (
            <View key={`bg-${i}`} pointerEvents="none" style={patch} />
          ))}
        {isGridLayout ? (
          <>
            {hasUser && noVideo && renderCenteredAvatar(seat)}
            {showsSeatOverlay(seat) && renderInfoCapsule(seat)}
            {!hasUser && (
              <View
                style={[
                  styles.participantWaitContainer,
                  styles.dividerColor,
                  waitStyle,
                ]}
              >
                <View style={[styles.joinPlus, { height: plusHeight }]}>
                  <View
                    style={[
                      styles.joinPlusBar,
                      { width: plusBar, height: plusThickness },
                    ]}
                  />
                  <View
                    style={[
                      styles.joinPlusBar,
                      { width: plusThickness, height: plusBar },
                    ]}
                  />
                </View>
                {showsJoinInvite && (
                  <Text style={styles.participantJoinContent}>
                    {isAnchor ? t('sv.inviteToSeat') : t('sv.applyCoGuest')}
                  </Text>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            {cameraOff && renderCenteredAvatar(seat)}
            {showsSeatOverlay(seat) && renderInfoCapsule(seat)}
          </>
        )}
      </Pressable>
    );
  };

  const showAnchorDefaultAvatar =
    isAnchor &&
    (cameraStatus ?? DeviceStatus.OFF) === DeviceStatus.OFF &&
    seatList.length === 1 &&
    isLiving;
  const clickedUserID = clickUserInfo.userID;
  const panelIsSelf = isAnchor
    ? clickedUserID === loginUserInfo?.userID
    : clickedUserID === currentLoginUserId;

  return (
    <View style={[styles.container, style]} onLayout={handleContainerLayout}>
      <View
        style={[
          styles.content,
          !isAnchor && styles.audienceContent,
          { width: dispWidth, height: containerHeight },
        ]}
      >
        <Pressable
          style={[
            styles.background,
            { width: dispWidth, height: streamViewHeight },
          ]}
          onPress={() => streamViewClick(null)}
        >
          <LiveCoreViewNative
            ref={coreViewRef}
            liveId={liveID}
            coreViewType={isAnchor ? 'pushView' : 'playView'}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        {showAnchorDefaultAvatar && (
          <View
            pointerEvents="none"
            style={[styles.defaultAvatar, { top: streamViewHeight / 2 }]}
          >
            <Image
              style={styles.defaultAvatarImage}
              source={avatarSource(loginUserInfo?.avatarURL)}
            />
          </View>
        )}

        {!isAnchor && showLoadingMask && (
          <View
            style={[
              styles.loadingMask,
              { width: dispWidth, height: streamViewHeight },
            ]}
          />
        )}

        {!!effCanvas &&
          !isAnchor &&
          seatList.length === 1 &&
          seatList.map(renderSingleCell)}

        {!!effCanvas &&
          seatList.length > 1 &&
          renderSeatList.map(renderMultiCell)}

        {!!effCanvas &&
          isGridLayout &&
          seatList.length > 1 &&
          gridEdges.lefts.length > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.stageFrame,
                {
                  left: gridEdges.lefts[0] ?? 0,
                  top: gridEdges.tops[0] ?? 0,
                  width: gridEdges.maxRight - (gridEdges.lefts[0] ?? 0),
                  height: gridEdges.maxBottom - (gridEdges.tops[0] ?? 0),
                },
              ]}
            />
          )}
      </View>

      {enableClickPanel && (
        <LiveStreamActionPanel
          visible={isShowClickPanel}
          onClose={() => setIsShowClickPanel(false)}
          liveID={liveID}
          userInfo={clickUserInfo}
          isAnchorMode={isAnchor}
          isSelf={panelIsSelf}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'rgba(15, 16, 20, 0.5)',
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    top: 0,
    left: 0,
  },
  audienceContent: {
    backgroundColor: '#000',
  },
  background: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  loadingMask: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: '#000',
    zIndex: 1,
  },
  defaultAvatar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  defaultAvatarImage: {
    width: rpxToPx(96),
    height: rpxToPx(96),
    borderRadius: 99,
  },
  gridContentCell: {
    position: 'absolute',
    overflow: 'hidden',
  },
  roundedCell: {
    borderRadius: rpxToPx(24),
  },
  dividerColor: {
    borderColor: '#000',
  },
  stageFrame: {
    position: 'absolute',
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  singleInner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantVideo: {
    width: rpxToPx(80),
    height: rpxToPx(80),
    borderRadius: rpxToPx(80),
  },
  participantInfoContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 38, 46, 0.4)',
    borderRadius: rpxToPx(100),
    paddingVertical: rpxToPx(4),
    paddingHorizontal: rpxToPx(16),
    left: rpxToPx(6),
    bottom: rpxToPx(6),
  },
  micIcon: {
    width: rpxToPx(24),
    height: rpxToPx(24),
  },
  participantName: {
    fontSize: rpxToPx(24),
    fontWeight: '500',
    color: '#ffffff',
    marginLeft: rpxToPx(4),
  },
  participantWaitContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2024',
  },
  joinPlus: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinPlusBar: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
  },
  participantJoinContent: {
    fontSize: rpxToPx(20),
    fontWeight: '400',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.48)',
    marginTop: rpxToPx(6),
  },
});
