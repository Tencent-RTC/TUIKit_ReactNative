import React, { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@tencentcloud/react-native-tuikit-atomic-x';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BeautyPanel,
  Icon,
  getLiveErrorMessage,
  ensureMediaPermission as requestMediaPermission,
  getBaseBeautyState,
  getDeviceState,
  useBaseBeautyActions,
  useDeviceActions,
  useLiveListState,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T, LIVE_TOKENS, livePlaceholderStyle } from '../../../../styles/tokens';
import { rpxToPx, VideoQuality, errorCodeOf, toVideoQualityParam } from '../../../../utils';
import { BeforeLiveSettingsPanel } from '../../components/BeforeLiveSettingsPanel';
import { CountdownOverlay } from '../../components/CountdownOverlay';
import { CoverPickerPanel, PRESET_COVER_URLS } from '../../components/CoverPickerPanel';

export interface BeforeLiveViewProps {
  liveID: string;
  templateLayout: number;
  onBack?: () => void;
  onTip?: (title: string) => void;
  onStarted?: () => void;
}

const START_BG = require('../../../../static/images/live/background/start-btn-bg.png');
const START_DOT = require('../../../../static/images/live/icon/start-dot.png');

const DEFAULT_COVER_URL = PRESET_COVER_URLS[0]!;
const TITLE_MAX_BYTES = 100;
const BOTTOM_PANEL_HEIGHT = Platform.OS === 'ios' ? 60 : 80;
const PLACEHOLDER = livePlaceholderStyle(LIVE_TOKENS.darkText50);

const getByteLength = (str: string): number => {
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) len += 1;
    else if (code <= 0x7ff) len += 2;
    else if (code <= 0xffff) len += 3;
    else len += 4;
  }
  return len;
};

export function BeforeLiveView({ liveID, templateLayout, onBack, onTip, onStarted }: BeforeLiveViewProps) {
  const { t } = useLiveTranslation();
  const insets = useSafeAreaInsets();
  const { createLive, fetchLiveList } = useLiveListState();
  const { openLocalCamera, openLocalMicrophone, switchCamera, updateVideoQuality } = useDeviceActions();
  const { setSmoothLevel, setWhitenessLevel, setRuddyLevel } = useBaseBeautyActions();

  const [coverURL, setCoverURL] = useState(DEFAULT_COVER_URL);
  const [liveTitle, setLiveTitle] = useState(() => t('anchor.defaultTitle'));
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isShowMorePanel, setIsShowMorePanel] = useState(false);
  const [isShowCoverPicker, setIsShowCoverPicker] = useState(false);
  const [isShowBeautyPanel, setIsShowBeautyPanel] = useState(false);
  const titleInputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const btnHeightPx = rpxToPx(104);
  const videoBottomGap = insets.bottom + BOTTOM_PANEL_HEIGHT;
  const startBtnBottomPx = Math.max(0, Math.round((videoBottomGap - btnHeightPx) / 2));

  const concealed = countdownVisible || isStarting;
  const actionConcealed = concealed || isShowBeautyPanel;

  const ensureMediaPermission = async (): Promise<boolean> => {
    const cameraResult = await requestMediaPermission('camera');
    const micResult = await requestMediaPermission('microphone');
    const cameraDenied = cameraResult === -1;
    const micDenied = micResult === -1;
    if (cameraDenied && micDenied) {
      onTip?.(t('anchor.bothPermissionDenied'));
      return false;
    }
    if (cameraDenied) {
      onTip?.(t('anchor.cameraPermissionDenied'));
      return false;
    }
    if (micDenied) {
      onTip?.(t('anchor.micPermissionDenied'));
      return false;
    }
    return cameraResult === 1 && micResult === 1;
  };

  useEffect(() => {
    updateVideoQuality({ quality: toVideoQualityParam(VideoQuality.QUALITY_720P) });
    ensureMediaPermission().then(permitted => {
      if (!permitted) return;
      openLocalCamera({ isFront: true });
      openLocalMicrophone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLive = async () => {
    const permitted = await ensureMediaPermission();
    if (!permitted) return;
    setCountdownVisible(true);
  };

  const handleChangeTitle = (value: string) => {
    if (getByteLength(value) <= TITLE_MAX_BYTES) {
      setLiveTitle(value);
      return;
    }
    onTip?.(t('voice.titleLimit'));
  };

  const doStartLive = async () => {
    setIsStarting(true);
    const permitted = await ensureMediaPermission();
    if (!permitted) {
      setIsStarting(false);
      return;
    }
    const beautySnapshot = getBaseBeautyState();
    createLive({
      liveInfo: {
        liveID,
        liveName: liveTitle.trim() || t('anchor.defaultTitle'),
        coverURL,
        isSeatEnabled: true,
        seatMode: 'APPLY',
        maxSeatCount: 0,
        isPublicVisible: true,
        keepOwnerOnSeat: true,
        seatLayoutTemplateID: templateLayout,
      },
      onSuccess: () => {
        onStarted?.();
        fetchLiveList({ cursor: '', count: 20 });
        openLocalCamera({ isFront: getDeviceState().isFrontCamera ?? true });
        openLocalMicrophone();
        if (beautySnapshot.smoothLevel > 0) setSmoothLevel({ smoothLevel: beautySnapshot.smoothLevel });
        if (beautySnapshot.whitenessLevel > 0) setWhitenessLevel({ whitenessLevel: beautySnapshot.whitenessLevel });
        if (beautySnapshot.ruddyLevel > 0) setRuddyLevel({ ruddyLevel: beautySnapshot.ruddyLevel });
      },
      onError: (error) => {
        setIsStarting(false);
        console.error('[BeforeLiveView] createLive failed:', error);
        onTip?.(`${t('anchor.createFailed')}: ${getLiveErrorMessage(errorCodeOf(error))}`);
      },
    });
  };

  return (
    <View style={styles.view} onStartShouldSetResponder={() => true} onResponderRelease={Keyboard.dismiss}>
      {!concealed && (
        <>
          <Pressable
            style={styles.back}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onBack}
          >
            <Icon name="back" style={styles.backImage} />
          </Pressable>
          <View style={styles.header}>
            <Pressable style={styles.coverBtn} onPress={() => setIsShowCoverPicker(true)}>
              <Image
                style={styles.coverThumb}
                source={{ uri: coverURL }}
                resizeMode="cover"
                onError={() => setCoverURL(DEFAULT_COVER_URL)}
              />
              <Text style={styles.coverLabel}>{t('anchor.editCover')}</Text>
            </Pressable>
            <TextInput
              ref={titleInputRef}
              style={styles.title}
              value={liveTitle}
              onChangeText={handleChangeTitle}
              placeholder={t('anchor.defaultTitle')}
              placeholderTextColor={PLACEHOLDER.placeholderTextColor}
              selectionColor={LIVE_TOKENS.colorTextInverse}
              numberOfLines={1}
            />
            <Pressable onPress={() => titleInputRef.current?.focus()}>
              <Text style={styles.topic}>{t('anchor.editTopic')}</Text>
            </Pressable>
          </View>
        </>
      )}
      {!actionConcealed && (
        <>
          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={() => setIsShowBeautyPanel(true)}>
              <View style={styles.actionIcon}>
                <Icon name="beauty" style={styles.actionImg} />
              </View>
              <Text style={styles.actionLabel}>{t('anchor.beauty')}</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => switchCamera({ isFront: !getDeviceState().isFrontCamera })}>
              <View style={styles.actionIcon}>
                <Icon name="flip" style={styles.actionImg} />
              </View>
              <Text style={styles.actionLabel}>{t('anchor.flipCamera')}</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => setIsShowMorePanel(true)}>
              <View style={styles.actionIcon}>
                <Icon name="grid" style={styles.actionImg} />
              </View>
              <Text style={styles.actionLabel}>{t('anchor.more')}</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.startBtn, { bottom: startBtnBottomPx }]}
            onPress={startLive}
          >
            <Image style={styles.startBtnBg} source={START_BG} resizeMode="stretch" />
            <View style={styles.startBtnRing} />
            <Image style={styles.startDot} source={START_DOT} resizeMode="contain" />
            <Text style={styles.startBtnText}>{t('anchor.startLive')}</Text>
          </Pressable>
        </>
      )}
      <BeautyPanel visible={isShowBeautyPanel} onClose={() => setIsShowBeautyPanel(false)} />
      <CountdownOverlay visible={countdownVisible} onVisibleChange={setCountdownVisible} onFinished={doStartLive} />
      <CoverPickerPanel
        visible={isShowCoverPicker}
        onClose={() => setIsShowCoverPicker(false)}
        selectedURL={coverURL}
        onSelect={setCoverURL}
      />
      <BeforeLiveSettingsPanel visible={isShowMorePanel} onClose={() => setIsShowMorePanel(false)} onTip={onTip} />
    </View>
  );
}

const styles = StyleSheet.create({
  view: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.mask01,
  },
  back: {
    position: 'absolute',
    top: rpxToPx(130),
    left: rpxToPx(60),
    zIndex: 1000,
    width: rpxToPx(60),
    height: rpxToPx(60),
  },
  backImage: {
    width: rpxToPx(20),
    height: rpxToPx(35),
  },
  header: {
    position: 'absolute',
    top: rpxToPx(264),
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'center',
  },
  coverBtn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  coverThumb: {
    width: rpxToPx(116),
    height: rpxToPx(116),
    borderRadius: rpxToPx(28),
  },
  coverLabel: {
    marginTop: rpxToPx(24),
    fontSize: rpxToPx(20),
    color: T.darkTextPrimary,
  },
  title: {
    marginTop: rpxToPx(40),
    width: rpxToPx(590),
    fontSize: rpxToPx(40),
    fontWeight: '600',
    color: T.darkTextPrimary,
    textAlign: 'center',
    paddingVertical: 0,
  },
  topic: {
    marginTop: rpxToPx(8),
    paddingVertical: rpxToPx(16),
    paddingHorizontal: rpxToPx(32),
    fontSize: rpxToPx(24),
    color: T.darkText70,
  },
  actions: {
    position: 'absolute',
    bottom: rpxToPx(252),
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  action: {
    width: rpxToPx(136),
    marginHorizontal: rpxToPx(32),
    flexDirection: 'column',
    alignItems: 'center',
  },
  actionIcon: {
    width: rpxToPx(104),
    height: rpxToPx(104),
    borderRadius: rpxToPx(52),
    backgroundColor: T.darkBgFloat50,
    borderWidth: rpxToPx(2),
    borderColor: T.darkBorder10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rpxToPx(14),
  },
  actionImg: {
    width: rpxToPx(58),
    height: rpxToPx(58),
  },
  actionLabel: {
    fontSize: rpxToPx(22),
    fontWeight: '600',
    color: T.darkTextPrimary,
  },
  startBtn: {
    position: 'absolute',
    left: rpxToPx(40),
    width: rpxToPx(670),
    height: rpxToPx(104),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpxToPx(670),
    height: rpxToPx(104),
  },
  startBtnRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpxToPx(670),
    height: rpxToPx(102),
    borderRadius: rpxToPx(52),
    borderWidth: rpxToPx(3),
    borderColor: T.colorBrandLight,
  },
  startDot: {
    width: rpxToPx(48),
    height: rpxToPx(48),
    marginRight: rpxToPx(12),
  },
  startBtnText: {
    fontSize: rpxToPx(32),
    fontWeight: '600',
    color: T.darkTextPrimary,
  },
});

export default BeforeLiveView;
