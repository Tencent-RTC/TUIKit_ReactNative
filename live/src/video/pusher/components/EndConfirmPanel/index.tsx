import React, { memo, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import {
  CoHostStatus,
  Drawer,
  useCoHostState,
  useLiveAudienceState,
  useLiveListState,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import { ActionSheet, type ActionSheetSelectEvent } from '../../../../common';
import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx, DRAWER_BG } from '../../../../utils';

export interface EndConfirmPanelProps {
  liveID?: string;
  onEnded?: () => void;
  onOverlayActiveChange?: (active: boolean) => void;
}

export interface EndConfirmPanelRef {
  requestEnd: () => void;
}

export const EndConfirmPanel = memo(forwardRef<EndConfirmPanelRef, EndConfirmPanelProps>(function EndConfirmPanel(
  { liveID: liveIDProp, onEnded, onOverlayActiveChange },
  ref,
) {
  const { t } = useLiveTranslation();
  const { endLive, currentLive } = useLiveListState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { coHostStatus, exitHostConnection } = useCoHostState(liveID);
  const { audienceList, audienceCount } = useLiveAudienceState(liveID);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTitle, setSheetTitle] = useState('');
  const [sheetItems, setSheetItems] = useState<string[]>([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const endingRef = useRef(false);

  const listLength = audienceList?.length || 0;
  const viewerCount = listLength > 100 ? audienceCount : listLength;
  const hasViewer = (viewerCount || 0) > 0;
  const drawerHeight = hasViewer ? 490 : 424;

  useImperativeHandle(
    ref,
    () => ({
      requestEnd: () => {
        if (coHostStatus === CoHostStatus.CONNECTED) {
          setSheetItems([t('anchor.disconnectLink'), t('anchor.closeLive')]);
          setSheetTitle(t('anchor.linkEndingTip'));
          setSheetVisible(true);
        } else {
          setConfirmVisible(true);
        }
      },
    }),
    [coHostStatus, t],
  );

  const overlayActive = sheetVisible || confirmVisible;
  const overlayCallbackRef = useRef(onOverlayActiveChange);
  overlayCallbackRef.current = onOverlayActiveChange;
  useEffect(() => {
    overlayCallbackRef.current?.(overlayActive);
  }, [overlayActive]);

  const handleConfirmEnd = () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setConfirmVisible(false);
    endLive({
      onSuccess: () => onEnded?.(),
      onError: (error) => {
        endingRef.current = false;
        console.error('[EndConfirmPanel] endLive failed:', error);
      },
    });
  };

  const handleSheetSelect = ({ tapIndex }: ActionSheetSelectEvent) => {
    if (coHostStatus === CoHostStatus.CONNECTED && tapIndex === 0) {
      exitHostConnection({ liveID });
      return;
    }
    handleConfirmEnd();
  };

  return (
    <>
      <ActionSheet
        visible={sheetVisible}
        title={sheetTitle}
        itemList={sheetItems}
        onVisibleChange={setSheetVisible}
        onSelect={handleSheetSelect}
      />
      <Drawer
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        height={drawerHeight}
        overlayOpacity={0.4}
        bgImage={DRAWER_BG}
        bgImageHeight={drawerHeight}
        padding="20rpx 48rpx 96rpx 48rpx"
        showHandle
      >
        <View style={styles.text}>
          {hasViewer ? (
            <>
              <View style={styles.viewers}>
                <Text style={styles.viewersText}>{t('anchor.endConfirmHasPrefix')}</Text>
                <Text style={styles.viewersCount}>{viewerCount}</Text>
                <Text style={styles.viewersText}>{t('anchor.endConfirmWatchingSuffix')}</Text>
              </View>
              <Text style={styles.question}>{t('anchor.endConfirmQuestion')}</Text>
            </>
          ) : (
            <Text style={styles.empty}>{t('anchor.endConfirmEmpty')}</Text>
          )}
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => setConfirmVisible(false)}>
            <Text style={[styles.btnText, styles.btnSecondaryText]}>{t('anchor.endConfirmContinue')}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleConfirmEnd}>
            <Text style={[styles.btnText, styles.btnDangerText]}>{t('anchor.endConfirmEnd')}</Text>
          </Pressable>
        </View>
      </Drawer>
    </>
  );
}));

const styles = StyleSheet.create({
  text: {
    marginTop: rpxToPx(40),
    marginBottom: rpxToPx(80),
    paddingHorizontal: rpxToPx(8),
    alignItems: 'center',
  },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewersText: {
    color: T.darkText76,
    fontSize: rpxToPx(28),
    lineHeight: rpxToPx(44),
    fontWeight: '400',
  },
  viewersCount: {
    marginHorizontal: rpxToPx(4),
    color: T.colorBrandTextStrong,
    fontSize: rpxToPx(46),
    lineHeight: rpxToPx(46),
    fontWeight: '700',
    textAlign: 'center',
  },
  question: {
    marginTop: rpxToPx(20),
    color: T.darkText94,
    fontSize: rpxToPx(30),
    lineHeight: rpxToPx(46),
    fontWeight: '600',
  },
  empty: {
    color: T.darkText85,
    fontSize: rpxToPx(28),
    lineHeight: rpxToPx(44),
    fontWeight: '400',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: rpxToPx(8),
  },
  btn: {
    width: rpxToPx(216),
    height: rpxToPx(88),
    borderRadius: rpxToPx(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    marginRight: rpxToPx(48),
    backgroundColor: T.darkSurface10,
  },
  btnDanger: {
    backgroundColor: T.colorDangerDeep,
  },
  btnText: {
    fontSize: rpxToPx(30),
    fontWeight: '500',
  },
  btnSecondaryText: {
    color: T.darkText92,
  },
  btnDangerText: {
    color: T.darkText94,
  },
});

export default EndConfirmPanel;
