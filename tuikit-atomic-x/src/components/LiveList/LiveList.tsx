import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../Common';
import type { ListRenderItem } from 'react-native';
import {
  useDeviceState,
  useLiveListState,
  useLoginState,
} from '../../atomic-x';
import type { LiveInfoParam } from '../../atomic-x';
import { Toast, rpxToPx } from '../Common';
import { useLiveListTranslation } from './locales';

export interface LiveListProps {
  onEnterPlayer?: (liveID: string) => void;
  onEnterPusher?: (liveID: string) => void;
}

const PAGE_COUNT = 20;
const TOAST_DURATION = 2000;
const DEFAULT_COVER_URL =
  'https://web.sdk.qcloud.com/trtc/live/web/assets/defaultCoverLive.png';
const DEFAULT_AVATAR = require('../../static/assets/live/default-avatar.png');

export function LiveList({ onEnterPlayer, onEnterPusher }: LiveListProps) {
  const { t } = useLiveListTranslation();
  const { liveList, liveListCursor, fetchLiveList, joinLive } =
    useLiveListState();
  const { openLocalCamera, openLocalMicrophone, isFrontCamera } =
    useDeviceState();
  const { loginUserInfo } = useLoginState();

  const [inputLiveId, setInputLiveId] = useState('');
  const [brokenCovers, setBrokenCovers] = useState<Set<string>>(
    () => new Set()
  );
  const [toast, setToast] = useState({ visible: false, title: '', seq: 0 });

  const showToast = useCallback((title: string) => {
    setToast((prev) => ({ visible: true, title, seq: prev.seq + 1 }));
  }, []);

  useEffect(() => {
    fetchLiveList({ cursor: '', count: PAGE_COUNT });
  }, [fetchLiveList]);

  const filteredLiveList = useMemo(() => {
    const keyword = inputLiveId.trim().toLowerCase();
    if (!keyword) return liveList;
    return liveList.filter((item) => {
      const id = (item?.liveID || '').toLowerCase();
      const name = (item?.liveName || '').toLowerCase();
      const ownerName = (
        item?.liveOwner?.userName ||
        item?.liveOwner?.userID ||
        ''
      ).toLowerCase();
      return (
        id.includes(keyword) ||
        name.includes(keyword) ||
        ownerName.includes(keyword)
      );
    });
  }, [inputLiveId, liveList]);

  const groupedLiveList = useMemo(() => {
    const groups: LiveInfoParam[][] = [];
    for (let i = 0; i < filteredLiveList.length; i += 2) {
      groups.push(filteredLiveList.slice(i, i + 2));
    }
    return groups;
  }, [filteredLiveList]);

  const hasNoResults = !!inputLiveId.trim() && filteredLiveList.length === 0;

  const formatViewerCount = (count = 0) =>
    count >= 10000 ? `${(count / 10000).toFixed(1)}${t('wan')}` : String(count);

  const handleJoinLive = (live: LiveInfoParam) => {
    try {
      if (
        live.liveOwner?.userID &&
        live.liveOwner.userID === loginUserInfo?.userID
      ) {
        joinLive({
          liveID: live.liveID,
          onSuccess: () => {
            openLocalCamera({ isFront: isFrontCamera });
            openLocalMicrophone();
            onEnterPusher?.(live.liveID);
          },
        });
        return;
      }
      onEnterPlayer?.(live.liveID);
    } catch (error) {
      console.error('join live failed:', error);
      showToast(t('joinFail'));
    }
  };

  const loadMore = () => {
    if (liveList.length === 0) return;
    if (!liveListCursor) {
      showToast(t('noMore'));
      return;
    }
    fetchLiveList({ cursor: liveListCursor, count: PAGE_COUNT });
  };

  const handleCoverError = (liveID: string) => {
    setBrokenCovers((prev) => {
      if (prev.has(liveID)) return prev;
      const next = new Set(prev);
      next.add(liveID);
      return next;
    });
  };

  const renderRow: ListRenderItem<LiveInfoParam[]> = ({ item: row }) => (
    <View style={styles.liveRow}>
      {row.map((live) => {
        const coverURL =
          live.coverURL && !brokenCovers.has(live.liveID)
            ? live.coverURL
            : DEFAULT_COVER_URL;
        const avatarURL = live.liveOwner?.avatarURL;
        return (
          <Pressable
            key={live.liveID}
            style={styles.liveCard}
            onPress={() => handleJoinLive(live)}
          >
            <Image
              source={{ uri: coverURL }}
              style={styles.coverImage}
              resizeMode="cover"
              onError={() => handleCoverError(live.liveID)}
            />
            <View style={styles.liveStatus}>
              <View style={styles.barContainer}>
                <View style={[styles.bar, styles.bar1]} />
                <View style={[styles.bar, styles.bar2]} />
                <View style={[styles.bar, styles.bar3]} />
              </View>
              <Text style={styles.viewerCount}>
                {t('viewers', {
                  count: formatViewerCount(live.totalViewerCount),
                })}
              </Text>
            </View>
            <View style={styles.infoOverlay}>
              <Text style={styles.liveTitle} numberOfLines={1}>
                {live.liveName}
              </Text>
              <View style={styles.liveOwner}>
                <Image
                  source={avatarURL ? { uri: avatarURL } : DEFAULT_AVATAR}
                  style={styles.ownerAvatar}
                  resizeMode="cover"
                />
                <Text style={styles.ownerName} numberOfLines={1}>
                  {live.liveOwner?.userName || live.liveOwner?.userID}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.quickJoin}>
        <TextInput
          value={inputLiveId}
          onChangeText={setInputLiveId}
          style={styles.quickJoinInput}
          placeholder={t('searchPlaceholder')}
          returnKeyType="done"
          onSubmitEditing={() => showToast(t('searchDone'))}
          maxLength={64}
        />
      </View>

      {hasNoResults ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('empty')}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listContent}
          data={groupedLiveList}
          keyExtractor={(row, rowIndex) =>
            `row-${rowIndex}-${row[0]?.liveID || 'empty'}`
          }
          renderItem={renderRow}
          onEndReached={loadMore}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Toast
        key={toast.seq}
        visible={toast.visible}
        title={toast.title}
        duration={TOAST_DURATION}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const CARD_WIDTH = rpxToPx(334);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: rpxToPx(750),
    backgroundColor: '#FFFFFF',
  },
  quickJoin: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: rpxToPx(32),
    marginBottom: rpxToPx(24),
    marginLeft: rpxToPx(32),
  },
  quickJoinInput: {
    flex: 1,
    height: rpxToPx(64),
    borderWidth: rpxToPx(1),
    borderColor: '#e0e0e0',
    borderRadius: rpxToPx(999),
    paddingVertical: rpxToPx(10),
    paddingHorizontal: rpxToPx(20),
    marginTop: rpxToPx(20),
    fontSize: rpxToPx(28),
    backgroundColor: '#fff',
  },
  listContent: {
    width: rpxToPx(750),
  },
  liveRow: {
    flexDirection: 'row',
    paddingHorizontal: rpxToPx(32),
    marginBottom: rpxToPx(24),
    justifyContent: 'space-between',
  },
  liveCard: {
    position: 'relative',
    width: CARD_WIDTH,
    height: rpxToPx(500),
    borderRadius: rpxToPx(16),
    backgroundColor: '#ffffff',
  },
  coverImage: {
    width: CARD_WIDTH,
    height: rpxToPx(400),
    borderRadius: rpxToPx(16),
  },
  liveStatus: {
    position: 'absolute',
    top: rpxToPx(24),
    left: rpxToPx(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  barContainer: {
    width: rpxToPx(16),
    height: rpxToPx(16),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: rpxToPx(8),
  },
  bar: {
    width: rpxToPx(4),
    backgroundColor: '#5AD69E',
  },
  bar1: {
    height: rpxToPx(10),
    marginRight: rpxToPx(2),
  },
  bar2: {
    height: rpxToPx(16),
    marginRight: rpxToPx(2),
  },
  bar3: {
    height: rpxToPx(6),
  },
  viewerCount: {
    color: '#ffffff',
    fontSize: rpxToPx(24),
  },
  infoOverlay: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: CARD_WIDTH,
    paddingVertical: rpxToPx(16),
    paddingHorizontal: rpxToPx(20),
    backgroundColor: 'rgba(240, 242, 247, 1)',
    borderBottomLeftRadius: rpxToPx(16),
    borderBottomRightRadius: rpxToPx(16),
  },
  liveTitle: {
    fontSize: rpxToPx(32),
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.9)',
    marginBottom: rpxToPx(8),
    maxWidth: rpxToPx(400),
  },
  liveOwner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerAvatar: {
    width: rpxToPx(40),
    height: rpxToPx(40),
    borderRadius: rpxToPx(20),
    marginRight: rpxToPx(8),
  },
  ownerName: {
    flex: 1,
    maxWidth: rpxToPx(300),
    fontSize: rpxToPx(24),
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.55)',
  },
  emptyContainer: {
    padding: rpxToPx(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: rpxToPx(16),
    fontSize: rpxToPx(28),
    color: '#666666',
  },
});

export default LiveList;
