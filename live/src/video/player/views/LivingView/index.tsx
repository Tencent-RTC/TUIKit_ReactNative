import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BarrageList,
  CoGuestControlBar,
  CoGuestRequestPanel,
  DeviceStatus,
  DeviceStatusCode,
  FloatingGiftCombo,
  GiftEntryBanner,
  GiftPicker,
  LiveAudienceList,
  heightPercentToRpx,
  useCoGuestState,
  useCoHostState,
  useLiveAudienceState,
  useLiveListState,
  useLiveSeatState,
  useLoginState,
  Icon,
  type BarrageGiftData,
  type CoGuestLocalStatus,
  type FloatingGiftComboRef,
  type GiftEntryBannerRef,
  type GiftSentPayload,
  type StreamUserInfo,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import {
  ActionSheet,
  AnchorInfoBar,
  AudienceEntryBanner,
  BarrageInput,
  type ActionSheetSelectEvent,
  type AudienceEntryBannerRef,
  type AudienceEntryUser,
} from '../../../../common';
import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx, useStableCallback, useTopBarOffsetPx } from '../../../../utils';
import { AudienceListEntry } from '../../components/AudienceListEntry';
import { BottomToolbar } from '../../components/BottomToolbar';


const AUDIO_ONLY_TEMPLATE = 200;
const BARRAGE_LIST_H_RPX = 380;
const BARRAGE_BOTTOM_GAP_PX = 84;
const CO_GUEST_BAR_GAP_RPX = 216;
const AUDIENCE_ENTRY_OFFSET_RPX = 64;
const FREEZE_RELEASE_MS = 800;
const LISTENER_ID = 'VideoPlayerLivingView';

export type ShowTip = (title: string, position?: 'center' | 'top') => void;

export interface LivingViewProps {
  liveID: string;
  templateLayout: number;
  currentLoginUserId: string;
  guestStatus: CoGuestLocalStatus;
  onGuestStatusChange: (status: CoGuestLocalStatus) => void;
  onTip: ShowTip;
  onReceiveGift: (giftData: BarrageGiftData, count: number) => void;
  onBack: () => void;
}

export interface LivingViewRef {
  openCoGuestRequestFromSeat: (payload: StreamUserInfo) => void;
}

const safeJsonParse = (value: unknown): any => {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseAudienceEventUser = (eventData: unknown): AudienceEntryUser => {
  const parsed = safeJsonParse(eventData);
  let user = parsed?.audience ?? parsed?.userInfo ?? parsed;
  if (typeof user === 'string') user = safeJsonParse(user);
  user = user ?? {};
  return {
    userID: user?.userID || user?.userId || '',
    userName: user?.userName || user?.nameCard || user?.userID || user?.userId || '',
    level: Number(user?.level) || 0,
  };
};

const isCameraOn = (status: unknown) => status === DeviceStatus.ON || status === DeviceStatusCode.ON;

export const LivingView = forwardRef<LivingViewRef, LivingViewProps>(function LivingView(
  {
    liveID,
    templateLayout,
    currentLoginUserId,
    guestStatus,
    onGuestStatusChange,
    onTip,
    onReceiveGift,
    onBack,
  },
  ref,
) {
  const { t } = useLiveTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const [layoutHeight, setLayoutHeight] = useState(0);
  const windowHeight = layoutHeight || screenHeight;
  const insets = useSafeAreaInsets();
  const topOffsetPx = useTopBarOffsetPx();
  const { loginUserInfo } = useLoginState();
  const { currentLive } = useLiveListState();
  const { seatList } = useLiveSeatState(liveID);
  const { audienceList, messageBannedUserList, addAudienceListener, removeAudienceListener } =
    useLiveAudienceState(liveID);
  const { disconnect, connected, cancelApplication } = useCoGuestState(liveID);
  const { connected: hostConnected } = useCoHostState(liveID);

  const [isShowAudienceList, setIsShowAudienceList] = useState(false);
  const [isShowCoGuestRequestPanel, setIsShowCoGuestRequestPanel] = useState(false);
  const [isCoGuestControlBarOpen, setIsCoGuestControlBarOpen] = useState(false);
  const [isShowCommentInput, setIsShowCommentInput] = useState(false);
  const [requestPanelInitialDetail, setRequestPanelInitialDetail] = useState(false);
  const [isShowGiftPicker, setIsShowGiftPicker] = useState(false);
  const [isShowCoGuestSheet, setIsShowCoGuestSheet] = useState(false);
  const [coGuestSheetItems, setCoGuestSheetItems] = useState<string[]>([]);
  const [audienceInnerPanelVisible, setAudienceInnerPanelVisible] = useState(false);
  const [isFreezeCamera, setIsFreezeCamera] = useState(false);
  const [seatIndex, setSeatIndex] = useState(-1);

  const entryBannerRef = useRef<GiftEntryBannerRef>(null);
  const floatingComboRef = useRef<FloatingGiftComboRef>(null);
  const audienceEntryBannerRef = useRef<AudienceEntryBannerRef>(null);
  const freezeReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestStatusRef = useRef(guestStatus);
  guestStatusRef.current = guestStatus;

  const myUserID = loginUserInfo?.userID || '';
  const isConnected = guestStatus === 'CONNECTED';
  const micEnabled = templateLayout !== AUDIO_ONLY_TEMPLATE;
  const shouldDisableCoGuestButton = Array.isArray(hostConnected) && hostConnected.length > 0;
  const isSelfCoGuestConnected = (connected || []).some(item => item?.userID === myUserID);

  const nonGiftOverlayVisible = isShowCoGuestSheet || isShowAudienceList || isShowCoGuestRequestPanel;

  const baseBottom = isSelfCoGuestConnected ? rpxToPx(CO_GUEST_BAR_GAP_RPX) : BARRAGE_BOTTOM_GAP_PX;
  const barrageTopPx =
    windowHeight <= 0
      ? -9999
      : Math.max(0, Math.round(windowHeight - baseBottom - rpxToPx(BARRAGE_LIST_H_RPX)));
  const audienceEntryTopPx = barrageTopPx - rpxToPx(AUDIENCE_ENTRY_OFFSET_RPX);
  const safeAreaHeight = windowHeight - insets.top - insets.bottom;
  const giftEntryBottomPx = isShowGiftPicker
    ? rpxToPx(heightPercentToRpx(0.5) + 80 + 16)
    : safeAreaHeight / 8 + rpxToPx(380 + 16);

  const pushAudienceEntry = useCallback((user: AudienceEntryUser) => {
    audienceEntryBannerRef.current?.push(user);
  }, []);

  const onBarrageReceiveGift = (giftData: BarrageGiftData) => {
    if (!giftData) return;
    const senderId = giftData?.sender?.userID || '';
    const isSelf = !!senderId && senderId === myUserID;
    const count = Math.max(1, Math.round(Number(giftData.count) || 1));
    if (!isSelf) {
      const anchor = currentLive?.liveOwner || null;
      entryBannerRef.current?.push({
        gift: giftData.gift,
        sender: giftData.sender,
        recipient: anchor ? { userID: anchor.userID || '', userName: anchor.userName || anchor.userID || '' } : null,
        count,
      });
    }
    onReceiveGift(giftData, count);
  };

  const onSelfGiftSent = (payload: GiftSentPayload) => {
    const gift = payload?.gift;
    if (!gift) return;
    entryBannerRef.current?.push({
      gift: { giftID: gift.giftID, name: gift.name, iconURL: gift.iconURL },
      sender: {
        userID: myUserID || 'self',
        userName: loginUserInfo?.nickname || myUserID,
        avatarURL: loginUserInfo?.avatarURL || '',
      },
      recipient: null,
    });
  };

  const onAdvancedComboStart = (payload: GiftSentPayload) => {
    setIsShowGiftPicker(false);
    floatingComboRef.current?.activate(payload?.gift, payload?.count || 1);
  };

  const showCoGuestRequestPanel = () => {
    if (guestStatusRef.current === 'CONNECTED') {
      setCoGuestSheetItems([t('audience.disconnectCoGuest')]);
      setIsShowCoGuestSheet(true);
    } else {
      setIsShowCoGuestRequestPanel(true);
    }
  };

  const handleCoGuestButtonClick = () => {
    if (shouldDisableCoGuestButton) return;
    setSeatIndex(-1);
    showCoGuestRequestPanel();
  };

  const onCoGuestSheetSelect = ({ tapIndex }: ActionSheetSelectEvent) => {
    if (tapIndex !== 0) return;
    if (guestStatusRef.current === 'CONNECTED') {
      disconnect({ liveID });
      onGuestStatusChange('IDLE');
      return;
    }
    if (guestStatusRef.current === 'USER_APPLYING') {
      cancelApplication({ liveID });
      onGuestStatusChange('IDLE');
    }
  };

  const onCoGuestControlBarOpenDetail = () => {
    setRequestPanelInitialDetail(true);
    setIsFreezeCamera(true);
    setIsShowCoGuestRequestPanel(true);
  };

  const onCoGuestControlBarEnd = () => {
    onGuestStatusChange('IDLE');
    setIsCoGuestControlBarOpen(false);
  };

  const closeCoGuestRequestPanel = () => {
    setIsShowCoGuestRequestPanel(false);
    setRequestPanelInitialDetail(false);
    if (freezeReleaseTimerRef.current) clearTimeout(freezeReleaseTimerRef.current);
    freezeReleaseTimerRef.current = setTimeout(() => {
      freezeReleaseTimerRef.current = null;
      setIsFreezeCamera(false);
    }, FREEZE_RELEASE_MS);
  };

  const onCoGuestDetailBack = () => {
    closeCoGuestRequestPanel();
    setIsCoGuestControlBarOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openCoGuestRequestFromSeat: (payload: StreamUserInfo) => {
      if (payload?.userID) return;
      if (shouldDisableCoGuestButton) return;
      const idx = Number(payload?.seatIndex);
      setSeatIndex(Number.isFinite(idx) && idx >= 0 ? idx : -1);
      showCoGuestRequestPanel();
    },
  }));

  const prevBannedRef = useRef(messageBannedUserList);
  useEffect(() => {
    const wasBanned = (prevBannedRef.current || []).some(u => u?.userID === myUserID);
    const isBanned = (messageBannedUserList || []).some(u => u?.userID === myUserID);
    prevBannedRef.current = messageBannedUserList;
    if (isBanned && !wasBanned) onTip(t('audience.banned'));
    if (!isBanned && wasBanned) onTip(t('audience.unbanned'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageBannedUserList]);

  const seenAudienceIDsRef = useRef(new Set<string>());
  const audienceListInitializedRef = useRef(false);
  useEffect(() => {
    const arr = audienceList || [];
    const ids = new Set(arr.map(u => u?.userID).filter((id): id is string => !!id));
    if (ids.size === 0) {
      seenAudienceIDsRef.current.clear();
      audienceListInitializedRef.current = false;
      return;
    }
    if (audienceListInitializedRef.current) {
      ids.forEach(id => {
        if (seenAudienceIDsRef.current.has(id)) return;
        const user = arr.find(u => u?.userID === id);
        pushAudienceEntry({ userID: id, userName: user?.userName || id, level: Number(user?.level) || 0 });
      });
    }
    audienceListInitializedRef.current = true;
    seenAudienceIDsRef.current = ids;
  }, [audienceList, pushAudienceEntry]);

  useEffect(() => {
    if (isSelfCoGuestConnected) return;
    if (guestStatusRef.current === 'CONNECTED') onGuestStatusChange('IDLE');
    setIsCoGuestControlBarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, myUserID]);

  const selfCameraStatus = (seatList || []).find(s => s?.userInfo?.userID === currentLoginUserId)?.userInfo
    ?.cameraStatus;
  useEffect(() => {
    if (!isShowCoGuestRequestPanel && isCameraOn(selfCameraStatus)) setIsFreezeCamera(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfCameraStatus]);

  useEffect(() => {
    if (!liveID) return undefined;
    addAudienceListener(
      'onAudienceJoined',
      (eventData?: unknown) => pushAudienceEntry(parseAudienceEventUser(eventData)),
      LISTENER_ID,
    );
    return () => removeAudienceListener('onAudienceJoined', LISTENER_ID);
  }, [liveID, addAudienceListener, removeAudienceListener, pushAudienceEntry]);

  useEffect(
    () => () => {
      if (freezeReleaseTimerRef.current) clearTimeout(freezeReleaseTimerRef.current);
    },
    [],
  );

  const isBanned = (messageBannedUserList || []).some(u => u?.userID === myUserID);

  const openCommentInput = () => {
    if (isBanned) {
      onTip(t('audience.banned'));
      return;
    }
    setIsShowCommentInput(true);
  };

  const handleBarrageReceiveGift = useStableCallback(onBarrageReceiveGift);
  const handleSelfGiftSent = useStableCallback(onSelfGiftSent);
  const handleAdvancedComboStart = useStableCallback(onAdvancedComboStart);
  const handleCoGuestTap = useStableCallback(handleCoGuestButtonClick);
  const handleCoGuestSheetSelect = useStableCallback(onCoGuestSheetSelect);
  const handleOpenCoGuestDetail = useStableCallback(onCoGuestControlBarOpenDetail);
  const handleCoGuestControlBarEnd = useStableCallback(onCoGuestControlBarEnd);
  const handleCloseCoGuestRequestPanel = useStableCallback(closeCoGuestRequestPanel);
  const handleCoGuestDetailBack = useStableCallback(onCoGuestDetailBack);
  const openAudienceList = useCallback(() => setIsShowAudienceList(true), []);
  const closeAudienceList = useCallback(() => setIsShowAudienceList(false), []);
  const handleAudienceOverlayChange = useCallback((active?: boolean) => setAudienceInnerPanelVisible(!!active), []);
  const closeCommentInput = useCallback(() => setIsShowCommentInput(false), []);
  const openCoGuestControlBar = useCallback(() => setIsCoGuestControlBarOpen(true), []);
  const closeCoGuestControlBar = useCallback(() => setIsCoGuestControlBarOpen(false), []);
  const openGiftPicker = useCallback(() => setIsShowGiftPicker(true), []);
  const closeGiftPicker = useCallback(() => setIsShowGiftPicker(false), []);

  return (
    <View style={styles.livingView} pointerEvents="box-none" onLayout={e => setLayoutHeight(e.nativeEvent.layout.height)}>
      <View style={[styles.topBar, { top: topOffsetPx }]} pointerEvents="box-none">
        <AnchorInfoBar role="audience" />
        <View style={styles.topBarRight}>
          <AudienceListEntry onAudienceTap={openAudienceList} />
          <Pressable style={styles.topBarClose} onPress={onBack}>
            <Icon name="close" style={styles.topBarCloseIcon} />
          </Pressable>
        </View>
      </View>
      <BarrageList mode="audience" liveID={liveID} topPx={barrageTopPx} onReceiveGift={handleBarrageReceiveGift} />
      <AudienceEntryBanner ref={audienceEntryBannerRef} topPx={audienceEntryTopPx} />
      <View
        style={[styles.footer, isShowCommentInput && styles.hidden]}
        pointerEvents={isShowCommentInput ? 'none' : 'box-none'}
      >
        <Pressable style={styles.commentEntry} onPress={openCommentInput}>
          <Text style={styles.commentEntryPlaceholder} numberOfLines={1}>
            {t('audience.commentPlaceholder')}
          </Text>
        </Pressable>
      </View>
      <BarrageInput
        visible={isShowCommentInput}
        onClose={closeCommentInput}
        liveID={liveID}
        onTip={onTip}
      />
      <View
        style={[styles.actionButtons, isShowCommentInput && styles.hidden]}
        pointerEvents={isShowCommentInput ? 'none' : 'box-none'}
      >
        <BottomToolbar
          micEnabled={micEnabled}
          micConnected={isConnected}
          micDisabled={shouldDisableCoGuestButton}
          onCoGuestTap={handleCoGuestTap}
          onMicConnectedTap={openCoGuestControlBar}
          onGiftTap={openGiftPicker}
        />
      </View>
      {micEnabled && isConnected && (
        <CoGuestControlBar
          visible={isCoGuestControlBarOpen}
          onClose={closeCoGuestControlBar}
          liveID={liveID}
          userID={currentLoginUserId}
          freezeCamera={isFreezeCamera}
          onOpenDetail={handleOpenCoGuestDetail}
          onEnd={handleCoGuestControlBarEnd}
          onTip={onTip}
        />
      )}

      <LiveAudienceList
        visible={isShowAudienceList}
        onClose={closeAudienceList}
        liveID={liveID}
        onOverlayActiveChange={handleAudienceOverlayChange}
      />
      <CoGuestRequestPanel
        visible={isShowCoGuestRequestPanel}
        onClose={handleCloseCoGuestRequestPanel}
        liveID={liveID}
        userID={currentLoginUserId}
        seatIndex={seatIndex}
        initialDetailOpen={requestPanelInitialDetail}
        guestStatus={guestStatus}
        onStatusChange={onGuestStatusChange}
        onBack={handleCoGuestDetailBack}
      />
      <GiftPicker
        visible={isShowGiftPicker}
        onClose={closeGiftPicker}
        onGiftSent={handleSelfGiftSent}
        onAdvancedComboStart={handleAdvancedComboStart}
      />
      <GiftEntryBanner
        ref={entryBannerRef}
        bottomPx={giftEntryBottomPx}
        elevated={isShowGiftPicker}
        hidden={nonGiftOverlayVisible}
      />
      <ActionSheet
        visible={isShowCoGuestSheet}
        itemList={coGuestSheetItems}
        onVisibleChange={setIsShowCoGuestSheet}
        onSelect={handleCoGuestSheetSelect}
      />
      <FloatingGiftCombo ref={floatingComboRef} onComboSend={handleSelfGiftSent} />
    </View>
  );
});

const styles = StyleSheet.create({
  livingView: {
    ...StyleSheet.absoluteFillObject,
  },
  footer: {
    position: 'absolute',
    left: 0,
    bottom: rpxToPx(80),
    paddingLeft: rpxToPx(32),
    width: rpxToPx(686),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  actionButtons: {
    position: 'absolute',
    right: rpxToPx(40),
    bottom: rpxToPx(80),
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: rpxToPx(20),
    paddingHorizontal: rpxToPx(32),
    width: rpxToPx(750),
    zIndex: 1000,
  },
  topBarRight: {
    position: 'absolute',
    right: rpxToPx(32),
    top: rpxToPx(30),
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarClose: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: rpxToPx(52),
    height: rpxToPx(52),
    borderRadius: rpxToPx(26),
    backgroundColor: T.darkBgOverlay22,
  },
  hidden: {
    opacity: 0,
  },
  commentEntry: {
    width: rpxToPx(380),
    height: rpxToPx(72),
    borderRadius: rpxToPx(36),
    backgroundColor: 'rgba(20, 20, 22, 0.54)',
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.055)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rpxToPx(34),
  },
  commentEntryPlaceholder: {
    fontSize: rpxToPx(26),
    color: 'rgba(235, 235, 245, 0.45)',
  },
  topBarCloseIcon: {
    width: rpxToPx(30),
    height: rpxToPx(30),
  },
});

export default LivingView;
