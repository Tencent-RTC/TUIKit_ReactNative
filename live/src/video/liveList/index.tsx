import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, LiveList, Toast, useLiveListState } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../locales';
import { LIVE_STYLE_TOKENS } from '../../styles/tokens';
import { rpxToPx } from '../../utils';

export interface VideoLiveListPageProps {
  onBack?: () => void;
  onEnterPlayer: (liveID: string) => void;
  onEnterPusher: (liveID?: string) => void;
}

const PAGE_COUNT = 20;
const TOAST_DURATION = 2000;
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };


export function VideoLiveListPage({ onBack, onEnterPlayer, onEnterPusher }: VideoLiveListPageProps) {
  const { t } = useLiveTranslation();
  const insets = useSafeAreaInsets();
  const { fetchLiveList } = useLiveListState();
  const [toast, setToast] = useState({ visible: false, title: '', seq: 0 });

  const showToast = useCallback((title: string) => {
    setToast((prev) => ({ visible: true, title, seq: prev.seq + 1 }));
  }, []);

  useEffect(() => {
    if (!onBack) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const handleRefresh = () => {
    fetchLiveList({
      cursor: '',
      count: PAGE_COUNT,
      onSuccess: () => showToast(t('liveList.refreshDone')),
    });
  };

  const handleStartLive = () => onEnterPusher();
  const handleEnterPusher = (liveID: string) => onEnterPusher(liveID);

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + rpxToPx(80) }]}>
        <Pressable
          style={[styles.backButton, { top: insets.top }]}
          hitSlop={HIT_SLOP}
          onPress={() => onBack?.()}
        >
          <Icon name="back" color="#000000" style={styles.backIcon} />
        </Pressable>
        <Text>{t('liveList.title')}</Text>
        <Pressable style={[styles.refreshButton, { top: insets.top }]} hitSlop={HIT_SLOP} onPress={handleRefresh}>
          <Icon name="refresh" color="#000000" style={styles.refreshIcon} />
        </Pressable>
      </View>
      <View style={styles.container}>
        <LiveList onEnterPlayer={onEnterPlayer} onEnterPusher={handleEnterPusher} />
        <View style={[styles.footer, { bottom: rpxToPx(60) + insets.bottom }]} pointerEvents="box-none">
          <Pressable style={styles.createButton} onPress={handleStartLive}>
            <Icon name="createLive" style={styles.createIcon} />
            <Text style={styles.createText}>{t('liveList.startLive')}</Text>
          </Pressable>
        </View>
      </View>
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: LIVE_STYLE_TOKENS.lightBgPage,
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LIVE_STYLE_TOKENS.surfaceWhite,
  },
  backButton: {
    position: 'absolute',
    left: rpxToPx(60),
    bottom: 0,
    justifyContent: 'center',
  },
  backIcon: {
    width: rpxToPx(21),
    height: rpxToPx(34),
  },
  refreshButton: {
    position: 'absolute',
    right: rpxToPx(60),
    bottom: 0,
    justifyContent: 'center',
  },
  refreshIcon: {
    width: rpxToPx(36),
    height: rpxToPx(36),
  },
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: LIVE_STYLE_TOKENS.lightBgPage,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: rpxToPx(25),
    paddingHorizontal: rpxToPx(60),
    borderRadius: 999,
    backgroundColor: LIVE_STYLE_TOKENS.colorBrand,
  },
  createIcon: {
    width: rpxToPx(36),
    height: rpxToPx(36),
    marginRight: rpxToPx(10),
  },
  createText: {
    color: LIVE_STYLE_TOKENS.darkTextPrimary,
    fontSize: rpxToPx(32),
    fontWeight: '700',
  },
});
