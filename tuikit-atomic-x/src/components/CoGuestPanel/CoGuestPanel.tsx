import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Common';
import {
  LiveInfoModifyFlag,
  useCoGuestState,
  useLiveListState,
  useLiveSeatState,
  useLoginState,
} from '../../atomic-x';
import { Drawer, Icon, Toast, rpxToPx, type IconName } from '../Common';
import { useCoGuestPanelTranslation } from './locales';

export interface CoGuestPanelProps {
  visible?: boolean;
  onClose?: () => void;
  liveID?: string;
  activeTab?: string;
}

interface AudienceItem {
  userID: string;
  userName?: string;
  avatarURL?: string;
}

interface LayoutOption {
  id: number;
  key: string;
  guestCapacity: number;
  icon: IconName;
}

const DRAWER_BG = require('../../static/assets/live/drawer-bg.png');
const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');

const LAYOUTS: LayoutOption[] = [
  {
    id: 601,
    key: 'layout_floating',
    guestCapacity: 6,
    icon: 'layoutFloating',
  },
  {
    id: 600,
    key: 'layout_grid2',
    guestCapacity: 8,
    icon: 'layoutGrid2',
  },
  {
    id: 801,
    key: 'layout_fixed',
    guestCapacity: 6,
    icon: 'layoutFixed',
  },
  {
    id: 800,
    key: 'layout_grid9',
    guestCapacity: 8,
    icon: 'layoutGrid9',
  },
];
const LAYOUT_ROWS = [LAYOUTS.slice(0, 2), LAYOUTS.slice(2, 4)];
const LAYOUT_ACTIVE_COLOR = '#8ECFFF';
const DEFAULT_TEMPLATE_ID = 600;
const LAYOUT_SWITCH_COOLDOWN_MS = 5000;

const HANDLE_H = 76;
const HEADER_H = 72;
const BOTTOM_BASE_H = 32;
const CARD_GAP = 24;
const SECTION_PAD_H = 64;
const SECTION_TITLE_H = 54;
const LAYOUT_GRID_H = 208;
const ROW_H = 132;
const EMPTY_H = 184;
const MAX_ROWS = 3;
const TIP_DURATION = 2000;

const listContentH = (count: number) =>
  count > 0 ? Math.min(count, MAX_ROWS) * ROW_H : EMPTY_H;

export const CoGuestPanel = memo(function CoGuestPanel({
  visible = false,
  onClose,
  liveID: liveIDProp,
}: CoGuestPanelProps) {
  const { t } = useCoGuestPanelTranslation();
  const { currentLive, updateLiveInfo } = useLiveListState();
  const { loginUserInfo } = useLoginState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const {
    connected,
    invitees,
    applicants,
    candidates,
    acceptApplication,
    rejectApplication,
    inviteToSeat,
  } = useCoGuestState(liveID);
  const { kickUserOutOfSeat } = useLiveSeatState(liveID);

  const [selectedTemplateID, setSelectedTemplateID] =
    useState(DEFAULT_TEMPLATE_ID);
  const layoutUpdatingRef = useRef(false);
  const lastLayoutSwitchAtRef = useRef(0);
  const pendingUserIDsRef = useRef(new Set<string>());
  const [failedAvatarIDs, setFailedAvatarIDs] = useState<
    Record<string, boolean>
  >({});
  const [tipVisible, setTipVisible] = useState(false);
  const [tipSeq, setTipSeq] = useState(0);
  const [tipTitle, setTipTitle] = useState('');

  const showTip = useCallback((title: string) => {
    setTipTitle(title);
    setTipSeq((seq) => seq + 1);
    setTipVisible(true);
  }, []);

  const templateIDRef = useRef(currentLive?.seatLayoutTemplateID);
  templateIDRef.current = currentLive?.seatLayoutTemplateID;
  useEffect(() => {
    if (visible) {
      setSelectedTemplateID(
        Number(templateIDRef.current) || DEFAULT_TEMPLATE_ID
      );
    }
  }, [visible]);

  const anchorUserID =
    currentLive?.liveOwner?.userID || loginUserInfo?.userID || '';
  const connectedGuests = (connected || []).filter(
    (user) => user?.userID !== anchorUserID
  ) as AudienceItem[];
  const connectedCount = connectedGuests.length;
  const guestCapacity =
    LAYOUTS.find((opt) => opt.id === selectedTemplateID)?.guestCapacity ?? 8;
  const isLayoutFull = connectedCount >= guestCapacity;
  const applicantList = (applicants || []) as AudienceItem[];
  const applicantCount = applicantList.length;
  const availableList = (candidates || []) as AudienceItem[];
  const availableCount = availableList.length;

  const layoutCardH = SECTION_PAD_H + SECTION_TITLE_H + LAYOUT_GRID_H;
  const connectedCardH =
    SECTION_PAD_H + SECTION_TITLE_H + listContentH(connectedCount);
  const applicantsCardH =
    applicantCount > 0
      ? SECTION_PAD_H + SECTION_TITLE_H + listContentH(applicantCount)
      : 0;
  const availableCardH =
    availableCount > 0
      ? SECTION_PAD_H + SECTION_TITLE_H + listContentH(availableCount)
      : 0;
  const cardCount =
    2 + (applicantCount > 0 ? 1 : 0) + (availableCount > 0 ? 1 : 0);
  const drawerHeight =
    HANDLE_H +
    HEADER_H +
    BOTTOM_BASE_H +
    layoutCardH +
    connectedCardH +
    applicantsCardH +
    availableCardH +
    CARD_GAP * cardCount;

  const selectLayout = (templateID: number) => {
    if (templateID === selectedTemplateID || layoutUpdatingRef.current) return;
    // Rapid layout switches make the server re-mix repeatedly, and the old engine then shows black frames for other seats.
    const now = Date.now();
    if (now - lastLayoutSwitchAtRef.current < LAYOUT_SWITCH_COOLDOWN_MS) {
      showTip(t('layout_switch_limit'));
      return;
    }
    lastLayoutSwitchAtRef.current = now;
    const prev = selectedTemplateID;
    layoutUpdatingRef.current = true;
    setSelectedTemplateID(templateID);
    updateLiveInfo({
      liveInfo: { liveID, seatLayoutTemplateID: templateID },
      modifyFlagList: [LiveInfoModifyFlag.SEAT_LAYOUT_TEMPLATE_ID],
      onSuccess: () => {
        layoutUpdatingRef.current = false;
      },
      onError: (error) => {
        layoutUpdatingRef.current = false;
        lastLayoutSwitchAtRef.current = 0;
        setSelectedTemplateID(prev);
        console.error('updateLiveInfo fail', error);
        showTip(t('layout_change_failed'));
      },
    });
  };

  const isInvited = (audience: AudienceItem) =>
    !!audience?.userID &&
    (invitees || []).some((user) => user?.userID === audience.userID);

  const handleAccept = (audience: AudienceItem) => {
    const userID = audience?.userID;
    if (!userID || pendingUserIDsRef.current.has(userID)) return;
    if (isLayoutFull) {
      showTip(t('capacity_full', { capacity: guestCapacity }));
      return;
    }
    pendingUserIDsRef.current.add(userID);
    acceptApplication({
      liveID,
      userID,
      onSuccess: () => {
        pendingUserIDsRef.current.delete(userID);
      },
      onError: (error) => {
        pendingUserIDsRef.current.delete(userID);
        console.error('acceptApplication fail', error);
        showTip(t('handle_request_failed'));
      },
    });
  };

  const handleReject = (audience: AudienceItem) => {
    const userID = audience?.userID;
    if (!userID) return;
    rejectApplication({
      liveID,
      userID,
      onError: (error) => {
        console.error('rejectApplication fail', error);
        showTip(t('handle_request_failed'));
      },
    });
  };

  const handleInvite = (audience: AudienceItem) => {
    if (!audience?.userID || isInvited(audience)) return;
    if (isLayoutFull) {
      showTip(t('capacity_full', { capacity: guestCapacity }));
      return;
    }
    inviteToSeat({
      liveID,
      inviteeID: audience.userID,
      seatIndex: -1,
      timeout: 30,
      onError: (error) => {
        console.error('inviteToSeat fail', error);
        showTip(t('handle_request_failed'));
      },
    });
  };

  const handleEndConnection = (audience: AudienceItem) => {
    if (!audience?.userID) return;
    kickUserOutOfSeat({
      liveID,
      userID: audience.userID,
      onError: (error) => {
        console.error('kickUserOutOfSeat fail', error);
      },
    });
  };

  const avatarOf = (audience: AudienceItem) =>
    failedAvatarIDs[audience.userID] || !audience.avatarURL
      ? DEFAULT_AVATAR
      : { uri: audience.avatarURL };
  const onAvatarError = (userID: string) => {
    if (!userID) return;
    setFailedAvatarIDs((prev) =>
      prev[userID] ? prev : { ...prev, [userID]: true }
    );
  };

  const renderRows = (
    list: AudienceItem[],
    renderActions: (audience: AudienceItem) => ReactNode
  ) => (
    <ScrollView
      style={[
        styles.listScroll,
        { height: rpxToPx(listContentH(list.length)) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {list.map((audience, index) => (
        <View
          key={audience.userID}
          style={[styles.audienceRow, index > 0 && styles.rowDivider]}
        >
          <View style={styles.audienceIdentity}>
            <View style={styles.avatarWrap}>
              <Image
                style={styles.avatar}
                source={avatarOf(audience)}
                resizeMode="cover"
                onError={() => onAvatarError(audience.userID)}
              />
            </View>
            <Text style={styles.audienceName} numberOfLines={1}>
              {audience.userName || audience.userID}
            </Text>
          </View>
          <View style={styles.audienceActions}>{renderActions(audience)}</View>
        </View>
      ))}
    </ScrollView>
  );

  const tip = tipVisible && (
    <Toast
      key={tipSeq}
      visible={tipVisible}
      onClose={() => setTipVisible(false)}
      title={tipTitle}
      duration={TIP_DURATION}
    />
  );

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        height={drawerHeight}
        overlayOpacity={0.4}
        bgImage={DRAWER_BG}
        bgImageHeight={drawerHeight}
        padding="0 32rpx 32rpx 32rpx"
        overlay={visible && tip}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{t('manage_tab')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('layout_title')}</Text>
          <View style={styles.layoutGrid}>
            {LAYOUT_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.layoutRow}>
                {row.map((opt) => {
                  const active = selectedTemplateID === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      style={[
                        styles.layoutOption,
                        active && styles.layoutOptionActive,
                      ]}
                      onPress={() => selectLayout(opt.id)}
                    >
                      <Icon
                        name={opt.icon}
                        color={active ? LAYOUT_ACTIVE_COLOR : undefined}
                        style={styles.layoutIcon}
                      />
                      <Text
                        style={[
                          styles.layoutLabel,
                          active && styles.layoutLabelActive,
                        ]}
                        numberOfLines={2}
                      >
                        {t(opt.key)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {connectedCount > 0
              ? t('connected_viewers_count', { count: connectedCount })
              : t('connected_viewers')}
          </Text>
          {connectedCount > 0 ? (
            renderRows(connectedGuests, (audience) => (
              <Pressable
                style={[styles.rowBtn, styles.rowBtnDanger]}
                onPress={() => handleEndConnection(audience)}
              >
                <Text style={[styles.rowBtnText, styles.dangerText]}>
                  {t('end')}
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.listEmpty}>
              <Text style={styles.listEmptyText}>{t('no_participants')}</Text>
            </View>
          )}
        </View>

        {applicantCount > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('applicants_count', { count: applicantCount })}
            </Text>
            {renderRows(applicantList, (audience) => (
              <>
                <Pressable
                  style={styles.rowBtn}
                  onPress={() => handleAccept(audience)}
                >
                  <Text style={styles.rowBtnText}>{t('agree')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.rowBtn, styles.rowBtnDanger]}
                  onPress={() => handleReject(audience)}
                >
                  <Text style={[styles.rowBtnText, styles.dangerText]}>
                    {t('reject')}
                  </Text>
                </Pressable>
              </>
            ))}
          </View>
        )}

        {availableCount > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('available_count', { count: availableCount })}
            </Text>
            {renderRows(availableList, (audience) => {
              const invited = isInvited(audience);
              return (
                <Pressable
                  style={[styles.rowBtn, invited && styles.rowBtnDisabled]}
                  onPress={() => handleInvite(audience)}
                >
                  <Text
                    style={[styles.rowBtnText, invited && styles.disabledText]}
                  >
                    {invited ? t('invited') : t('invite')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Drawer>
      {!visible && tip}
    </>
  );
});

const styles = StyleSheet.create({
  panelHeader: {
    width: rpxToPx(686),
    height: rpxToPx(40),
    marginBottom: rpxToPx(32),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: rpxToPx(30),
    fontWeight: '600',
  },
  card: {
    width: rpxToPx(686),
    marginBottom: rpxToPx(24),
    padding: rpxToPx(32),
    borderRadius: rpxToPx(32),
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: rpxToPx(1),
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'column',
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: rpxToPx(24),
    fontWeight: '600',
    marginBottom: rpxToPx(24),
  },
  layoutGrid: {
    width: rpxToPx(622),
    flexDirection: 'column',
  },
  layoutRow: {
    width: rpxToPx(622),
    height: rpxToPx(96),
    marginBottom: rpxToPx(16),
    flexDirection: 'row',
  },
  layoutOption: {
    width: rpxToPx(303),
    height: rpxToPx(96),
    marginRight: rpxToPx(16),
    borderRadius: rpxToPx(24),
    borderWidth: rpxToPx(1),
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: rpxToPx(24),
    paddingRight: rpxToPx(24),
  },
  layoutOptionActive: {
    borderColor: 'rgba(74, 158, 255, 0.8)',
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
  },
  layoutIcon: {
    width: rpxToPx(40),
    height: rpxToPx(40),
    marginRight: rpxToPx(16),
  },
  layoutLabel: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: rpxToPx(26),
  },
  layoutLabelActive: {
    color: '#8ecfff',
    fontWeight: '600',
  },
  listScroll: {
    width: rpxToPx(622),
  },
  audienceRow: {
    width: rpxToPx(622),
    height: rpxToPx(132),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowDivider: {
    borderTopWidth: rpxToPx(1),
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  audienceIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: rpxToPx(68),
    height: rpxToPx(68),
    marginRight: rpxToPx(20),
    borderRadius: rpxToPx(34),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: rpxToPx(1),
    borderColor: 'rgba(74, 158, 255, 0.22)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: rpxToPx(68),
    height: rpxToPx(68),
    borderRadius: rpxToPx(34),
  },
  audienceName: {
    flex: 1,
    fontSize: rpxToPx(26),
    color: 'rgba(255, 255, 255, 0.88)',
  },
  audienceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: rpxToPx(16),
  },
  rowBtn: {
    width: rpxToPx(136),
    height: rpxToPx(72),
    marginLeft: rpxToPx(16),
    borderRadius: rpxToPx(20),
    backgroundColor: 'rgba(74, 158, 255, 0.18)',
    borderWidth: rpxToPx(1),
    borderColor: 'rgba(74, 158, 255, 0.42)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBtnDanger: {
    backgroundColor: 'rgba(255, 79, 86, 0.1)',
    borderColor: 'rgba(255, 79, 86, 0.22)',
  },
  rowBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  rowBtnText: {
    color: '#ffffff',
    fontSize: rpxToPx(24),
  },
  dangerText: {
    color: '#ff7076',
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  listEmpty: {
    width: rpxToPx(622),
    minHeight: rpxToPx(184),
    justifyContent: 'center',
    alignItems: 'center',
  },
  listEmptyText: {
    color: 'rgba(255, 255, 255, 0.52)',
    fontSize: rpxToPx(28),
  },
});

export default CoGuestPanel;
