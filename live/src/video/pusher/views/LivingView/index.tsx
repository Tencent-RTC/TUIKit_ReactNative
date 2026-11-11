import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudienceActionPanel,
  BarrageList,
  CoGuestPanel,
  CoHostStatus,
  DeviceStatus,
  GiftEntryBanner,
  LiveAudienceList,
  UserInfoPanel,
  Icon,
  useCoGuestState,
  getDeviceState,
  useCoHostState,
  useDeviceActions,
  useLiveAudienceState,
  useLiveListState,
  useLiveSeatState,
  useLoginState,
  type AudienceUserInfo,
  type BarrageGiftData,
  type BarrageMessage,
  type GiftEntryBannerRef,
  type UserInfoPanelUser,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import {
  AnchorInfoBar,
  AudienceEntryBanner,
  BarrageInput,
  type AudienceEntryBannerRef,
  type AudienceEntryUser,
} from '../../../../common';
import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import {
  rpxToPx,
  useStableCallback,
  useTopBarOffsetPx,
  normalizeAvatarURL,
  parseMaybeJson,
  pusherSession,
  setPusherPaused,
} from '../../../../utils';
import { AudienceListEntry } from '../../components/AudienceListEntry';
import { EndConfirmPanel, type EndConfirmPanelRef } from '../../components/EndConfirmPanel';
import { LiveStatusPanel } from '../../components/LiveStatusPanel';
import { MoreOperatePanel } from '../../components/MoreOperatePanel';
import { PauseOverlay } from '../../components/PauseOverlay';

export interface LivingViewProps {
  liveID: string;
  onTip?: (title: string) => void;
  onEnded?: (pausedSeconds: number) => void;
  onReceiveGift?: (giftData: BarrageGiftData) => void;
}

const DEFAULT_AVATAR = require('../../../../static/assets/live/default-avatar.png');

type HostUser = { userID?: string; userName?: string; avatarURL?: string; liveID?: string; [key: string]: unknown };

const LISTENER_ID = 'VideoPusherLivingView';
const BARRAGE_LIST_HEIGHT_RPX = 380;
const BARRAGE_BOTTOM_GAP = 84;
const APPLICANT_AVATAR_SIZE = 80;
const APPLICANT_AVATAR_OFFSET = APPLICANT_AVATAR_SIZE * (1 - 0.6);

const parseAudienceEventUser = (eventData: unknown): AudienceEntryUser => {
  const parsed = parseMaybeJson<Record<string, unknown>>(eventData);
  const raw = parsed?.audience ?? parsed?.userInfo ?? parsed;
  const user = (parseMaybeJson<Record<string, unknown>>(raw) || {}) as Record<string, unknown>;
  const userID = String(user.userID || user.userId || '');
  return {
    userID,
    userName: String(user.userName || user.nameCard || userID),
    level: Number(user.level) || 0,
  };
};

export function LivingView({ liveID: liveIDProp, onTip, onEnded, onReceiveGift }: LivingViewProps) {
  const { t } = useLiveTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [layoutHeight, setLayoutHeight] = useState(0);
  const windowHeight = layoutHeight || screenHeight;
  const topOffsetPx = useTopBarOffsetPx();

  const { loginUserInfo } = useLoginState();
  const { currentLive, addLiveListListener, removeLiveListListener } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const {
    addCoHostListener,
    removeCoHostListener,
    acceptHostConnection,
    rejectHostConnection,
    coHostStatus,
    invitees,
  } = useCoHostState(liveID);
  const { applicants, rejectApplication, connected } = useCoGuestState(liveID);
  const { audienceList, messageBannedUserList, addAudienceListener, removeAudienceListener } =
    useLiveAudienceState(liveID);
  const { closeLocalCamera, openLocalCamera } = useDeviceActions();
  const { muteMicrophone, unmuteMicrophone } = useLiveSeatState(liveID);

  const [isShowUserInfoPanel, setIsShowUserInfoPanel] = useState(false);
  const [isShowAudienceList, setIsShowAudienceList] = useState(false);
  const [isShowCoGuestPanel, setIsShowCoGuestPanel] = useState(false);
  const [isShowAudienceActionPanel, setIsShowAudienceActionPanel] = useState(false);
  const [isShowMoreOperatePanel, setIsShowMoreOperatePanel] = useState(false);
  const [isShowCommentInput, setIsShowCommentInput] = useState(false);
  const [isShowCoGuestPanelAvatar, setIsShowCoGuestPanelAvatar] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [selectedAudience, setSelectedAudience] = useState<AudienceUserInfo | null>(null);
  const [clickUserInfo, setClickUserInfo] = useState<UserInfoPanelUser | null>(null);
  const [failedApplicantAvatars, setFailedApplicantAvatars] = useState<Record<string, boolean>>({});
  const [inviter, setInviter] = useState<HostUser | null>(null);
  const [audienceInnerPanelVisible, setAudienceInnerPanelVisible] = useState(false);
  const [endLiveOverlayVisible, setEndLiveOverlayVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedSeconds, setPausedSeconds] = useState(0);

  const endConfirmPanelRef = useRef<EndConfirmPanelRef>(null);
  const audienceEntryBannerRef = useRef<AudienceEntryBannerRef>(null);
  const giftEntryBannerRef = useRef<GiftEntryBannerRef>(null);
  const pauseRef = useRef({ timer: null as ReturnType<typeof setInterval> | null, startAt: 0, accumulatedMs: 0, micWasOn: false });

  const applicantList = useMemo(() => applicants || [], [applicants]);
  const currentUserID = loginUserInfo?.userID;
  const hasCoGuestApplication = applicantList.length > 0 && !isShowCoGuestPanel;

  const barrageListHeight = rpxToPx(BARRAGE_LIST_HEIGHT_RPX);
  const barrageTopPx = Math.max(0, Math.round(windowHeight - BARRAGE_BOTTOM_GAP - barrageListHeight));
  const safeAreaHeight = windowHeight - insets.top - insets.bottom;
  const giftEntryBottomPx = safeAreaHeight / 8 + rpxToPx(380 + 16);
  const audienceEntryTopPx = barrageTopPx - rpxToPx(64);
  const anyOverlayVisible =
    isShowAudienceList ||
    isShowAudienceActionPanel ||
    isShowCoGuestPanel ||
    isShowMoreOperatePanel ||
    isShowUserInfoPanel ||
    endLiveOverlayVisible ||
    !!inviter ||
    audienceInnerPanelVisible;

  const latest = useRef({ isPaused, applicantList, connected, isShowCoGuestPanelAvatar, onTip, onEnded });
  latest.current = { isPaused, applicantList, connected, isShowCoGuestPanelAvatar, onTip, onEnded };

  const showTip = useCallback((title: string) => latest.current.onTip?.(title), []);

  const stopPauseTimer = () => {
    const p = pauseRef.current;
    if (p.timer != null) {
      clearInterval(p.timer);
      p.timer = null;
    }
  };

  const pauseLive = () => {
    if (isPaused) return;
    const p = pauseRef.current;
    p.startAt = Date.now();
    setIsPaused(true);
    setPausedSeconds(0);
    setIsShowMoreOperatePanel(false);
    p.micWasOn = getDeviceState().microphoneStatus === DeviceStatus.ON;
    closeLocalCamera();
    if (p.micWasOn) muteMicrophone({ liveID });
    p.timer = setInterval(() => {
      setPausedSeconds(Math.floor((Date.now() - p.startAt) / 1000));
    }, 1000);
    setPusherPaused(true);
  };

  const resumeLive = () => {
    if (!isPaused) return;
    const p = pauseRef.current;
    p.accumulatedMs += Date.now() - p.startAt;
    stopPauseTimer();
    p.startAt = 0;
    setPausedSeconds(0);
    setIsPaused(false);
    openLocalCamera({ isFront: getDeviceState().isFrontCamera ?? true });
    if (p.micWasOn) {
      p.micWasOn = false;
      if (pusherSession.selfMuted) {
        muteMicrophone({ liveID });
      } else {
        unmuteMicrophone({ liveID });
      }
    }
    setPusherPaused(false);
  };

  const handleLiveEnded = useCallback(() => {
    const p = pauseRef.current;
    if (latest.current.isPaused) {
      p.accumulatedMs += Date.now() - p.startAt;
      stopPauseTimer();
      p.startAt = 0;
      setPausedSeconds(0);
      setIsPaused(false);
    }
    latest.current.onEnded?.(Math.floor(p.accumulatedMs / 1000));
  }, []);

  useEffect(() => () => stopPauseTimer(), []);

  const pushAudienceEntry = useCallback((user: AudienceEntryUser) => {
    if (latest.current.isPaused || !user.userID) return;
    audienceEntryBannerRef.current?.push(user);
  }, []);

  const showCoGuestPanel = (tab = 'requests') => {
    setActiveTab(tab);
    setIsShowCoGuestPanel(true);
  };

  const audienceOperator = (message: BarrageMessage) => {
    const senderID = message?.sender?.userID;
    if (senderID && senderID === currentLive?.liveOwner?.userID) return;
    if (senderID === currentUserID) {
      showTip(t('anchor.cannotFollowSelf'));
      return;
    }
    const target = (audienceList || []).find((audience) => audience.userID === senderID);
    if (!target) {
      setClickUserInfo((message?.sender as UserInfoPanelUser) || null);
      setIsShowUserInfoPanel(true);
    } else {
      setSelectedAudience(target as AudienceUserInfo);
      setIsShowAudienceActionPanel(true);
    }
  };

  const handleBarrageReceiveGift = (giftData: BarrageGiftData) => {
    if (!giftData) return;
    const count = Math.max(1, Math.round(Number(giftData.count) || 1));
    const anchor = currentLive?.liveOwner;
    giftEntryBannerRef.current?.push({
      gift: giftData.gift,
      sender: giftData.sender,
      recipient: anchor
        ? { userID: anchor.userID || '', userName: anchor.userName || anchor.userID || '' }
        : null,
      count,
    });
    onReceiveGift?.(giftData);
  };

  const handleInviteReject = () => {
    if (inviter?.liveID) rejectHostConnection({ liveID, fromHostLiveID: inviter.liveID });
    setIsShowCoGuestPanelAvatar(true);
    setInviter(null);
  };

  const handleInviteAccept = () => {
    if (inviter?.liveID) acceptHostConnection({ liveID, fromHostLiveID: inviter.liveID });
    setInviter(null);
  };

  useEffect(() => {
    if (!liveID) return undefined;
    const onCoHostRequestAccepted = () => showTip(t('anchor.linkAccepted'));
    const onCoHostRequestRejected = () => showTip(t('anchor.linkRejected'));
    const onCoHostRequestTimeout = () => {
      showTip(t('anchor.linkTimeout'));
      setIsShowCoGuestPanelAvatar(true);
      setInviter(null);
    };
    const onCoHostRequestReceived = (event: unknown) => {
      const state = latest.current;
      if (state.isShowCoGuestPanelAvatar && state.applicantList.length === 0) {
        setIsShowCoGuestPanelAvatar(false);
      }
      const res = parseMaybeJson<Record<string, unknown>>(event) || {};
      const from = parseMaybeJson<HostUser>(res.inviter);
      if (!from) return;
      if ((state.connected || []).length > 1 || state.applicantList.length > 0) {
        if (from.liveID) rejectHostConnection({ liveID, fromHostLiveID: String(from.liveID) });
        return;
      }
      setInviter(from);
    };
    const onAudienceJoined = (event: unknown) => pushAudienceEntry(parseAudienceEventUser(event));

    addLiveListListener('onLiveEnded', handleLiveEnded, LISTENER_ID);
    addCoHostListener('onCoHostRequestAccepted', onCoHostRequestAccepted, liveID, LISTENER_ID);
    addCoHostListener('onCoHostRequestRejected', onCoHostRequestRejected, liveID, LISTENER_ID);
    addCoHostListener('onCoHostRequestTimeout', onCoHostRequestTimeout, liveID, LISTENER_ID);
    addCoHostListener('onCoHostRequestReceived', onCoHostRequestReceived, liveID, LISTENER_ID);
    addAudienceListener('onAudienceJoined', onAudienceJoined, LISTENER_ID);
    return () => {
      removeLiveListListener('onLiveEnded', handleLiveEnded, LISTENER_ID);
      removeCoHostListener('onCoHostRequestAccepted', liveID, LISTENER_ID);
      removeCoHostListener('onCoHostRequestRejected', liveID, LISTENER_ID);
      removeCoHostListener('onCoHostRequestTimeout', liveID, LISTENER_ID);
      removeCoHostListener('onCoHostRequestReceived', liveID, LISTENER_ID);
      removeAudienceListener('onAudienceJoined', LISTENER_ID);
    };
  }, [
    liveID,
    t,
    showTip,
    handleLiveEnded,
    pushAudienceEntry,
    rejectHostConnection,
    addLiveListListener,
    removeLiveListListener,
    addCoHostListener,
    removeCoHostListener,
    addAudienceListener,
    removeAudienceListener,
  ]);

  const seenAudienceRef = useRef<{ ids: Set<string>; initialized: boolean }>({ ids: new Set(), initialized: false });
  useEffect(() => {
    const arr = audienceList || [];
    const ids = new Set(arr.map((u) => u?.userID).filter(Boolean) as string[]);
    const seen = seenAudienceRef.current;
    if (ids.size === 0) {
      seen.ids.clear();
      seen.initialized = false;
      return;
    }
    if (!seen.initialized) {
      seen.ids = ids;
      seen.initialized = true;
      return;
    }
    ids.forEach((id) => {
      if (!seen.ids.has(id)) {
        const user = arr.find((u) => u?.userID === id);
        pushAudienceEntry({ userID: id, userName: user?.userName || id, level: Number(user?.level) || 0 });
      }
    });
    seen.ids = ids;
  }, [audienceList, pushAudienceEntry]);

  const isBanned = (messageBannedUserList || []).some((u) => u?.userID === (currentUserID || ''));
  const wasBannedRef = useRef(isBanned);
  useEffect(() => {
    if (isBanned && !wasBannedRef.current) showTip(t('anchor.banned'));
    if (!isBanned && wasBannedRef.current) showTip(t('anchor.unbanned'));
    wasBannedRef.current = isBanned;
  }, [isBanned, showTip, t]);

  const rejectAllApplicants = useCallback(() => {
    latest.current.applicantList.forEach((applicant) => {
      rejectApplication({ liveID, userID: applicant.userID });
    });
  }, [liveID, rejectApplication]);

  const applicantKey = applicantList.map((a) => a.userID).join(',');
  useEffect(() => {
    if (!isShowCoGuestPanelAvatar) rejectAllApplicants();
  }, [applicantKey, isShowCoGuestPanelAvatar, rejectAllApplicants]);

  useEffect(() => {
    if (coHostStatus === CoHostStatus.DISCONNECTED) setIsShowCoGuestPanelAvatar(true);
  }, [coHostStatus]);

  const inviteeKey = (invitees || []).map((i) => i.userID).join(',');
  const inviteeKeyRef = useRef(inviteeKey);
  useEffect(() => {
    if (inviteeKeyRef.current === inviteeKey) return;
    inviteeKeyRef.current = inviteeKey;
    rejectAllApplicants();
  }, [inviteeKey, rejectAllApplicants]);

  const applicantAvatar = (applicant: HostUser) => {
    const url = normalizeAvatarURL(applicant?.avatarURL || applicant?.avatarUrl);
    if (!url || (applicant?.userID && failedApplicantAvatars[applicant.userID])) return DEFAULT_AVATAR;
    return { uri: url };
  };

  const avatarCount = Math.min(applicantList.length, 3);

  const onPause = useStableCallback(pauseLive);
  const onResume = useStableCallback(resumeLive);
  const onBarrageItemTap = useStableCallback(audienceOperator);
  const onBarrageReceiveGift = useStableCallback(handleBarrageReceiveGift);
  const onFanClubTap = useCallback(() => showTip(t('anchor.fanClubComingSoon')), [showTip, t]);
  const openAudienceList = useCallback(() => setIsShowAudienceList(true), []);
  const closeAudienceList = useCallback(() => setIsShowAudienceList(false), []);
  const closeAudienceActionPanel = useCallback(() => setIsShowAudienceActionPanel(false), []);
  const closeCoGuestPanel = useCallback(() => setIsShowCoGuestPanel(false), []);
  const closeMoreOperatePanel = useCallback(() => setIsShowMoreOperatePanel(false), []);
  const openCommentInput = useCallback(() => setIsShowCommentInput(true), []);
  const closeCommentInput = useCallback(() => setIsShowCommentInput(false), []);
  const closeUserInfoPanel = useCallback(() => setIsShowUserInfoPanel(false), []);

  return (
    <View style={styles.view} pointerEvents="box-none" onLayout={e => setLayoutHeight(e.nativeEvent.layout.height)}>
      <View style={[styles.topBar, { top: topOffsetPx }]} pointerEvents="box-none">
        <AnchorInfoBar role="anchor" liveID={liveID} onFanClubTap={onFanClubTap} />
        <View style={styles.topBarRight}>
          <AudienceListEntry liveID={liveID} onAudienceTap={openAudienceList} />
          <Pressable style={styles.close} onPress={() => endConfirmPanelRef.current?.requestEnd()}>
            <Icon name="close" style={styles.closeIcon} />
          </Pressable>
        </View>
      </View>

      {!!liveID && <LiveStatusPanel liveID={liveID} paused={isPaused} />}

      {applicantList.length > 0 && isShowCoGuestPanelAvatar && (
        <Pressable style={styles.guestRequest} onPress={() => showCoGuestPanel('requests')}>
          <View
            style={[
              styles.avatarOverlay,
              {
                width: rpxToPx(APPLICANT_AVATAR_SIZE + (avatarCount - 1) * APPLICANT_AVATAR_OFFSET),
                height: rpxToPx(APPLICANT_AVATAR_SIZE),
              },
            ]}
          >
            {applicantList.slice(0, 2).map((applicant, index) => (
              <Image
                key={applicant.userID || index}
                style={[styles.guestRequestImg, { left: rpxToPx(index * APPLICANT_AVATAR_OFFSET) }]}
                source={applicantAvatar(applicant)}
                resizeMode="cover"
                onError={() =>
                  applicant.userID && setFailedApplicantAvatars((prev) => ({ ...prev, [applicant.userID]: true }))
                }
              />
            ))}
            {applicantList.length >= 3 && (
              <Icon name="moreDots" style={[styles.guestRequestImg, { left: rpxToPx(2 * APPLICANT_AVATAR_OFFSET) }]} />
            )}
          </View>
          <Text style={styles.guestRequestText}>{t('anchor.applyCoGuest', { count: applicantList.length })}</Text>
        </Pressable>
      )}

      <BarrageList
        mode="anchor"
        liveID={liveID}
        topPx={barrageTopPx}
        onItemTap={onBarrageItemTap}
        onReceiveGift={onBarrageReceiveGift}
      />
      <AudienceEntryBanner ref={audienceEntryBannerRef} topPx={audienceEntryTopPx} />
      <GiftEntryBanner ref={giftEntryBannerRef} bottomPx={giftEntryBottomPx} hidden={anyOverlayVisible} />

      <View style={styles.bottomPanel} pointerEvents="box-none">
        <Pressable style={styles.actionItem} onPress={() => showCoGuestPanel('requests')}>
          <Icon name="coGuest" style={styles.actionIcon} />
          {hasCoGuestApplication && <View style={styles.requestDot} />}
          <Text style={styles.actionText}>{t('anchor.linkAudience')}</Text>
        </Pressable>
        <Pressable style={styles.actionItem} onPress={() => setIsShowMoreOperatePanel(true)}>
          <Icon name="moreGrid" style={[styles.actionIcon, styles.moreIcon]} />
          <Text style={styles.actionText}>{t('anchor.more')}</Text>
        </Pressable>
      </View>

      <LiveAudienceList
        visible={isShowAudienceList}
        onClose={closeAudienceList}
        liveID={liveID}
        onOverlayActiveChange={setAudienceInnerPanelVisible}
      />
      {!!liveID && (
        <>
          <AudienceActionPanel
            visible={isShowAudienceActionPanel}
            onClose={closeAudienceActionPanel}
            userInfo={selectedAudience}
            liveID={liveID}
            onTip={showTip}
          />
          <CoGuestPanel
            visible={isShowCoGuestPanel}
            onClose={closeCoGuestPanel}
            liveID={liveID}
            activeTab={activeTab}
          />
          <MoreOperatePanel
            visible={isShowMoreOperatePanel}
            onClose={closeMoreOperatePanel}
            liveID={liveID}
            onTip={showTip}
            onPause={onPause}
            onComment={openCommentInput}
          />
          <BarrageInput
            visible={isShowCommentInput}
            onClose={closeCommentInput}
            liveID={liveID}
            onTip={showTip}
          />
        </>
      )}
      <PauseOverlay visible={isPaused} seconds={pausedSeconds} onResume={onResume} />
      {!!liveID && (
        <>
          <UserInfoPanel
            visible={isShowUserInfoPanel}
            onClose={closeUserInfoPanel}
            userInfo={clickUserInfo}
            isShowAnchor={false}
          />
          <EndConfirmPanel
            ref={endConfirmPanelRef}
            liveID={liveID}
            onEnded={handleLiveEnded}
            onOverlayActiveChange={setEndLiveOverlayVisible}
          />
        </>
      )}
      <Modal
        transparent
        visible={!!inviter}
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.inviteOverlay}>
          <View style={styles.inviteModal}>
            <View style={styles.inviteContent}>
              <Text style={styles.inviteText}>
                {` ${t('anchor.linkInvite', { name: String(inviter?.userName || inviter?.userID || '') })}`}
              </Text>
            </View>
            <View style={styles.inviteActions}>
              <Pressable style={styles.inviteBtn} onPress={handleInviteReject}>
                <Text style={styles.inviteBtnReject}>{t('anchor.reject')}</Text>
              </Pressable>
              <Pressable style={[styles.inviteBtn, styles.inviteBtnConfirm]} onPress={handleInviteAccept}>
                <Text style={styles.inviteBtnAccept}>{t('anchor.accept')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  view: {
    ...StyleSheet.absoluteFillObject,
  },
  inviteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.mask,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteModal: {
    width: rpxToPx(500),
    backgroundColor: T.surfaceWhite,
    borderRadius: rpxToPx(20),
    boxShadow: `0 ${rpxToPx(4)}px ${rpxToPx(16)}px ${T.maskLight}`,
    alignItems: 'center',
  },
  inviteContent: {
    alignItems: 'center',
    marginTop: rpxToPx(40),
  },
  inviteText: {
    color: T.colorBlack,
    fontSize: rpxToPx(32),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: rpxToPx(40),
    marginBottom: rpxToPx(30),
    maxWidth: rpxToPx(400),
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: rpxToPx(2),
    borderTopColor: T.darkTextSoft,
    width: rpxToPx(500),
  },
  inviteBtn: {
    width: rpxToPx(250),
    padding: rpxToPx(28),
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteBtnConfirm: {
    borderLeftWidth: rpxToPx(2),
    borderLeftColor: T.darkTextSoft,
  },
  inviteBtnReject: {
    fontSize: rpxToPx(32),
    fontWeight: 'bold',
    color: T.darkTextMuted,
  },
  inviteBtnAccept: {
    fontSize: rpxToPx(32),
    fontWeight: 'bold',
    color: T.colorBrandDeep,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    width: rpxToPx(750),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: rpxToPx(20),
    paddingHorizontal: rpxToPx(32),
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  close: {
    width: rpxToPx(52),
    height: rpxToPx(52),
    marginLeft: rpxToPx(8),
    borderRadius: rpxToPx(26),
    backgroundColor: T.darkBgOverlay22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: rpxToPx(30),
    height: rpxToPx(30),
  },
  guestRequest: {
    position: 'absolute',
    top: rpxToPx(280),
    right: rpxToPx(30),
    width: rpxToPx(200),
    height: rpxToPx(200),
    borderRadius: rpxToPx(40),
    backgroundColor: T.darkBgControlSolid,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlay: {
    position: 'relative',
  },
  guestRequestImg: {
    position: 'absolute',
    top: 0,
    width: rpxToPx(APPLICANT_AVATAR_SIZE),
    height: rpxToPx(APPLICANT_AVATAR_SIZE),
    borderRadius: rpxToPx(APPLICANT_AVATAR_SIZE / 2),
  },
  guestRequestText: {
    marginTop: rpxToPx(30),
    fontSize: rpxToPx(24),
    color: T.darkTextPrimary,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: rpxToPx(40),
    left: rpxToPx(24),
    right: rpxToPx(24),
    paddingHorizontal: rpxToPx(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionItem: {
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  actionIcon: {
    width: rpxToPx(68),
    height: rpxToPx(52),
    marginBottom: rpxToPx(6),
  },
  moreIcon: {
    width: rpxToPx(56),
    height: rpxToPx(56),
  },
  actionText: {
    textAlign: 'center',
    color: T.darkText90,
    fontSize: rpxToPx(22),
  },
  requestDot: {
    position: 'absolute',
    top: 0,
    right: rpxToPx(2),
    width: rpxToPx(12),
    height: rpxToPx(12),
    borderRadius: rpxToPx(6),
    backgroundColor: T.colorDangerSolid,
  },
});

export default LivingView;
