import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Common';
import {
  CoHostLayoutTemplate,
  useCoGuestState,
  useCoHostState,
  useLiveListState,
  useLoginState,
  type LiveInfoParam,
  type StateError,
} from '../../atomic-x';
import { Dialog, Drawer, Icon, Toast, rpxToPx } from '../Common';
import { useCoHostPanelTranslation } from './locales';

export interface CoHostPanelProps {
  visible?: boolean;
  onClose?: () => void;
  liveID?: string;
}

interface ConnectedHost {
  userID: string;
  userName?: string;
  avatarURL?: string;
  liveID?: string;
}

const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');
const DRAWER_HEIGHT = 1000;
const PAGE_SIZE = 20;
const REQUEST_TIMEOUT = 30;
const TIP_DURATION = 2000;
const ERROR_HOST_LINKING = 3;
const ERROR_LIMIT_EXCEEDED = 100404;

const errorCodeOf = (error: unknown) =>
  typeof error === 'object' && error !== null
    ? (error as StateError).code
    : undefined;

export function CoHostPanel({
  visible = false,
  onClose,
  liveID: liveIDProp,
}: CoHostPanelProps) {
  const { t } = useCoHostPanelTranslation();
  const { currentLive, liveList, liveListCursor, fetchLiveList } =
    useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { loginUserInfo } = useLoginState();
  const { applicants, rejectApplication } = useCoGuestState(liveID);
  const {
    connected,
    invitees,
    requestHostConnection,
    cancelHostConnection,
    exitHostConnection,
  } = useCoHostState(liveID);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [tip, setTip] = useState({ seq: 0, title: '', visible: false });
  const userScrolledRef = useRef(false);
  const inviteesRef = useRef(invitees);
  inviteesRef.current = invitees;

  const showTip = useCallback((title: string) => {
    setTip((prev) => ({ seq: prev.seq + 1, title, visible: true }));
  }, []);

  const connectedList = connected as ConnectedHost[];
  const selfID = loginUserInfo?.userID;
  const filteredConnected = useMemo(
    () => (connectedList || []).filter((item) => item?.userID !== selfID),
    [connectedList, selfID]
  );

  const ownerID = currentLive?.liveOwner?.userID;
  const inviteHosts = useMemo(() => {
    const hosts = Array.isArray(liveList) ? liveList : [];
    const connectedLiveIDs = new Set(
      (connectedList || []).map((item) => item?.liveID)
    );
    return hosts.filter(
      (item) =>
        item?.liveOwner?.userID !== ownerID &&
        !connectedLiveIDs.has(item?.liveID)
    );
  }, [liveList, connectedList, ownerID]);

  const inviteeLiveIDs = useMemo(
    () =>
      new Set(
        ((invitees || []) as ConnectedHost[]).map((item) => item?.liveID)
      ),
    [invitees]
  );
  const isHostInviting = (host: LiveInfoParam) =>
    !!host?.liveID && inviteeLiveIDs.has(host.liveID);

  useEffect(() => {
    if (!applicants || (inviteesRef.current || []).length === 0) return;
    applicants.forEach((applicant) => {
      rejectApplication({ liveID, userID: applicant.userID });
    });
  }, [applicants, liveID, rejectApplication]);

  const handleRefresh = () => {
    fetchLiveList({
      cursor: '',
      count: PAGE_SIZE,
      onSuccess: () => showTip(t('ch.refreshDone')),
    });
  };

  const loadMore = () => {
    if (!userScrolledRef.current) return;
    if (!liveListCursor) {
      showTip(t('ch.noMore'));
      return;
    }
    fetchLiveList({ cursor: liveListCursor, count: PAGE_SIZE });
  };

  const cancelLink = (host: LiveInfoParam) => {
    cancelHostConnection({
      liveID,
      toHostLiveID: host.liveID,
      onSuccess: () => showTip(t('ch.inviteCancelled')),
      onError: (error) => {
        console.log('cancelHostConnection fail:', errorCodeOf(error), error);
        showTip(t('ch.cancelInviteFail'));
      },
    });
  };

  const startLink = (host: LiveInfoParam) => {
    if (applicants.length > 0) {
      showTip(t('ch.hasApplicant'));
      return;
    }
    requestHostConnection({
      liveID,
      targetHostLiveID: host.liveID,
      layoutTemplate: CoHostLayoutTemplate.HOST_DYNAMIC_GRID,
      timeout: REQUEST_TIMEOUT,
      extraInfo: '',
      onError: (error) => {
        const code = errorCodeOf(error);
        console.log('requestHostConnection fail:', code, error);
        if (code === ERROR_HOST_LINKING) {
          showTip(t('ch.hostLinking'));
        } else if (code === ERROR_LIMIT_EXCEEDED) {
          showTip(t('ch.limitExceeded'));
        } else {
          showTip(t('ch.linkFailed'));
        }
      },
    });
  };

  const onStartLinkTap = (host: LiveInfoParam) => {
    if (isHostInviting(host)) {
      cancelLink(host);
      return;
    }
    startLink(host);
  };

  const confirmExit = () => {
    exitHostConnection({
      liveID,
      onSuccess: () => onClose?.(),
      onError: (error) => {
        console.log('exitHostConnection fail:', errorCodeOf(error), error);
      },
    });
  };

  const renderAvatar = (url?: string) => (
    <View style={styles.avatarContainer}>
      <Image
        style={styles.avatar}
        resizeMode="cover"
        source={url ? { uri: url } : DEFAULT_AVATAR}
        defaultSource={DEFAULT_AVATAR}
      />
    </View>
  );

  const renderInviteHost = ({ item }: { item: LiveInfoParam }) => {
    const owner = item?.liveOwner;
    const inviting = isHostInviting(item);
    return (
      <View style={styles.item}>
        <View style={styles.info}>
          {renderAvatar(owner?.avatarURL)}
          <View style={styles.itemRight}>
            <Text style={styles.name} numberOfLines={1}>
              {owner?.userName || owner?.userID}
            </Text>
            <Pressable
              style={inviting ? styles.linkWaiting : styles.link}
              onPress={() => onStartLinkTap(item)}
            >
              <Text style={styles.linkText}>
                {inviting ? t('ch.cancelInvite') : t('ch.invite')}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.bottomLine} />
      </View>
    );
  };

  const toast = tip.visible && (
    <Toast
      key={tip.seq}
      visible={tip.visible}
      title={tip.title}
      duration={TIP_DURATION}
      onClose={() => setTip((prev) => ({ ...prev, visible: false }))}
    />
  );

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        height={DRAWER_HEIGHT}
        borderRadius={32}
        overlayOpacity={0.4}
        showHandle={false}
        showGlow={false}
        padding="0"
        overlay={visible && toast}
      >
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.tabItem}>
              <Text style={styles.activeText}>{t('ch.startLink')}</Text>
              {connectedList.length > 0 && (
                <Pressable
                  style={styles.endRight}
                  onPress={() => setConfirmVisible(true)}
                >
                  <Icon name="exit" color="#E6594C" style={styles.endIcon} />
                  <Text style={styles.endText}>{t('ch.disconnect')}</Text>
                </Pressable>
              )}
            </View>
          </View>

          {filteredConnected.length > 0 && (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.titleText}>
                  {t('ch.linking', { count: filteredConnected.length })}
                </Text>
              </View>
              <View style={styles.connectedList}>
                {filteredConnected.map((host) => (
                  <View key={host.userID} style={styles.item}>
                    <View style={styles.info}>
                      {renderAvatar(host.avatarURL)}
                      <View style={styles.itemRight}>
                        <Text style={styles.name} numberOfLines={1}>
                          {host.userName || host.userID}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{t('ch.recommend')}</Text>
            <Text style={styles.titleText} onPress={handleRefresh}>
              {t('ch.refresh')}
            </Text>
          </View>

          <FlatList
            style={styles.list}
            data={inviteHosts}
            keyExtractor={(item, index) =>
              item?.liveOwner?.userID || item?.liveID || String(index)
            }
            renderItem={renderInviteHost}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => {
              userScrolledRef.current = true;
            }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.1}
          />
        </View>
      </Drawer>
      <Dialog
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        message={t('ch.confirmExit')}
        confirmText={t('ch.exitLink')}
        cancelText={t('ch.cancel')}
        onConfirm={confirmExit}
      />
      {!visible && toast}
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 38, 46, 1)',
  },
  header: {
    paddingVertical: rpxToPx(20),
    alignItems: 'center',
  },
  tabItem: {
    marginTop: rpxToPx(20),
    paddingVertical: rpxToPx(20),
    paddingHorizontal: rpxToPx(40),
    width: rpxToPx(750),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeText: {
    fontSize: rpxToPx(32),
    color: 'rgba(255, 255, 255, 0.9)',
  },
  endRight: {
    position: 'absolute',
    right: rpxToPx(50),
    flexDirection: 'row',
    alignItems: 'center',
  },
  endIcon: {
    width: rpxToPx(40),
    height: rpxToPx(40),
  },
  endText: {
    fontSize: rpxToPx(28),
    color: '#E6594C',
    paddingLeft: rpxToPx(10),
  },
  titleRow: {
    width: rpxToPx(800),
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: rpxToPx(80),
    marginBottom: rpxToPx(40),
  },
  titleText: {
    fontSize: rpxToPx(28),
    color: 'rgba(255, 255, 255, 0.9)',
  },
  connectedList: {
    width: rpxToPx(800),
    paddingLeft: rpxToPx(80),
    marginBottom: rpxToPx(40),
  },
  list: {
    flex: 1,
    width: rpxToPx(750),
    paddingHorizontal: rpxToPx(48),
  },
  item: {
    position: 'relative',
    height: rpxToPx(120),
    marginBottom: rpxToPx(32),
    paddingTop: rpxToPx(10),
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rpxToPx(10),
  },
  avatarContainer: {
    width: rpxToPx(80),
    height: rpxToPx(80),
    borderRadius: rpxToPx(40),
    marginRight: rpxToPx(24),
    overflow: 'hidden',
  },
  avatar: {
    width: rpxToPx(80),
    height: rpxToPx(80),
    borderRadius: rpxToPx(40),
  },
  itemRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    width: rpxToPx(300),
    fontSize: rpxToPx(32),
    fontWeight: '500',
    color: '#ffffff',
  },
  link: {
    width: rpxToPx(120),
    height: rpxToPx(40),
    borderRadius: rpxToPx(30),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 102, 229, 1)',
  },
  linkWaiting: {
    width: rpxToPx(120),
    height: rpxToPx(40),
    borderRadius: rpxToPx(30),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(28, 102, 229, 1)',
  },
  linkText: {
    fontSize: rpxToPx(24),
    color: '#ffffff',
  },
  bottomLine: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: rpxToPx(550),
    height: rpxToPx(2),
    backgroundColor: 'rgba(79, 88, 107, 0.3)',
  },
});

export default CoHostPanel;
