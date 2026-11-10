import React, { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import NetInfo from '@react-native-community/netinfo';
import {
  DeviceErrorEnum,
  DeviceStatus,
  Drawer,
  Icon,
  Slider,
  useDeviceState,
  useLiveAudienceState,
  useLiveListState,
  useLiveSummaryState,
  type IconName,
} from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation, type LiveTranslate } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T, LIVE_TOKENS } from '../../../../styles/tokens';
import { rpxToPx, useTopBarOffsetPx, DRAWER_BG, NetworkQuality, VideoQuality, formatClock, toMsTimestamp, toVideoQualityNumber } from '../../../../utils';

export interface LiveStatusPanelProps {
  liveID: string;
  paused?: boolean;
}

type NetworkStatus = 'good' | 'poor' | 'bad' | 'disconnected' | 'checking';
type TabKey = 'data' | 'device';


const DRAWER_HEIGHT = 1050;

const RESOLUTION_BY_QUALITY: Record<number, string> = {
  [VideoQuality.QUALITY_360P]: '360×640',
  [VideoQuality.QUALITY_540P]: '540×960',
  [VideoQuality.QUALITY_720P]: '720×1280',
  [VideoQuality.QUALITY_1080P]: '1080×1920',
};
const BITRATE_BY_QUALITY: Record<number, string> = {
  [VideoQuality.QUALITY_360P]: '800 kbps',
  [VideoQuality.QUALITY_540P]: '1200 kbps',
  [VideoQuality.QUALITY_720P]: '1800 kbps',
  [VideoQuality.QUALITY_1080P]: '2400 kbps',
};
const QUALITY_LABEL_BY_QUALITY: Record<number, string> = {
  [VideoQuality.QUALITY_360P]: '360P',
  [VideoQuality.QUALITY_540P]: '540P',
  [VideoQuality.QUALITY_720P]: '720P',
  [VideoQuality.QUALITY_1080P]: '1080P',
};

const formatCount = (value: number, t: LiveTranslate): string => {
  const v = Math.max(0, Math.floor(Number(value) || 0));
  if (v >= 1000000000) return `${Math.floor(v / 100000000)}${t('common.yiUnit')}+`;
  if (v >= 100000000) {
    const y = v / 100000000;
    return `${y >= 10 ? Math.floor(y) : Math.round(y * 10) / 10}${t('common.yiUnit')}`;
  }
  if (v >= 100000) return `${Math.floor(v / 10000)}${t('common.wanUnit')}+`;
  if (v >= 10000) {
    const w = v / 10000;
    return `${w >= 10 ? Math.floor(w) : Math.round(w * 10) / 10}${t('common.wanUnit')}`;
  }
  return String(v);
};

const metricValueFontSize = (text: string): number => {
  const base = 40;
  const cjk = (text.match(/[一-龥]/g) || []).length;
  const estimated = cjk * base + (text.length - cjk) * base * 0.6;
  const maxWidth = 170;
  if (estimated <= maxWidth) return rpxToPx(base);
  return rpxToPx(Math.max(24, Math.floor((base * maxWidth) / estimated)));
};

const formatNetworkMetric = (value: unknown, suffix: string): string => {
  if (value === undefined || value === null || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '--';
  return `${Math.round(n)}${suffix}`;
};

const toCount = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));

export const LiveStatusPanel = memo(function LiveStatusPanel({ liveID, paused = false }: LiveStatusPanelProps) {
  const { t } = useLiveTranslation();
  const topBarOffset = useTopBarOffsetPx();
  const { audienceList, audienceCount } = useLiveAudienceState(liveID);
  const { currentLive } = useLiveListState();
  const {
    cameraStatus,
    cameraLastError,
    microphoneStatus,
    microphoneLastError,
    captureVolume,
    setCaptureVolume,
    networkInfo,
    localVideoQuality,
  } = useDeviceState();
  const { summaryData } = useLiveSummaryState(liveID);

  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('data');
  const [liveDuration, setLiveDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [systemNetworkConnected, setSystemNetworkConnected] = useState(true);
  const liveStartAtRef = useRef(0);
  const pauseStartAtRef = useRef(0);

  useEffect(() => {
    setVolume(Math.max(0, Math.round(Number(captureVolume) || 0)));
  }, [captureVolume]);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setSystemNetworkConnected(!(state.isConnected === false || !state.type || state.type === 'none'));
      }),
    []
  );

  useEffect(() => {
    if (liveStartAtRef.current > 0) return;
    liveStartAtRef.current = toMsTimestamp(currentLive?.createTime);
  }, [currentLive?.createTime]);

  useEffect(() => {
    if (paused) {
      pauseStartAtRef.current = Date.now();
      return undefined;
    }
    if (pauseStartAtRef.current > 0) {
      liveStartAtRef.current += Date.now() - pauseStartAtRef.current;
      pauseStartAtRef.current = 0;
    }
    const timer = setInterval(() => {
      setLiveDuration(Math.floor(Math.max(0, (Date.now() - liveStartAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  const qualityNumber = toVideoQualityNumber(localVideoQuality);
  const videoQualityLabel = QUALITY_LABEL_BY_QUALITY[qualityNumber] || '--';
  const videoResolutionText = RESOLUTION_BY_QUALITY[qualityNumber] || '--';
  const videoBitrateText = BITRATE_BY_QUALITY[qualityNumber] || '--';

  const listLength = audienceList?.length || 0;
  const onlineCount = listLength > 100 ? Number(audienceCount) || 0 : listLength;
  const summary = (summaryData || {}) as Record<string, unknown>;
  const giftCoinsText = formatCount(toCount(summary.totalGiftCoins), t);
  const gifterCountText = formatCount(toCount(summary.totalGiftUniqueSenders), t);
  const likeCountText = formatCount(toCount(summary.totalLikesReceived), t);
  const giftCountText = formatCount(toCount(summary.totalGiftsSent), t);
  const messageCountText = formatCount(toCount(summary.totalMessageSent), t);
  const onlineCountText = formatCount(onlineCount, t);

  const quality = Number(networkInfo?.quality);
  let networkStatus: NetworkStatus = 'checking';
  if (!systemNetworkConnected || quality === NetworkQuality.Down) networkStatus = 'disconnected';
  else if (quality === NetworkQuality.Bad || quality === NetworkQuality.VeryBad) networkStatus = 'bad';
  else if (quality === NetworkQuality.Poor) networkStatus = 'poor';
  else if (quality === NetworkQuality.Excellent || quality === NetworkQuality.Good) networkStatus = 'good';

  const NETWORK_VIEW: Record<
    NetworkStatus,
    { trigger: IconName | null; triggerLabel: string; health: IconName; title: string; copy: string }
  > = {
    good: {
      trigger: null,
      triggerLabel: t('liveStatus.title'),
      health: 'statusNetwork',
      title: t('liveStatus.networkExcellent'),
      copy: t('liveStatus.networkCopy'),
    },
    checking: {
      trigger: null,
      triggerLabel: t('liveStatus.title'),
      health: 'statusNetwork',
      title: t('liveStatus.networkCheckingLabel'),
      copy: t('liveStatus.networkCheckingCopy'),
    },
    poor: {
      trigger: 'networkPoor',
      triggerLabel: t('liveStatus.networkPoorLabel'),
      health: 'statusNetworkPoor',
      title: t('liveStatus.networkPoorLabel'),
      copy: t('liveStatus.networkFluctuatingCopy'),
    },
    bad: {
      trigger: 'networkBad',
      triggerLabel: t('liveStatus.networkVeryBadLabel'),
      health: 'statusNetworkBad',
      title: t('liveStatus.networkBadLabel'),
      copy: t('liveStatus.networkSwitchCopy'),
    },
    disconnected: {
      trigger: 'networkDisconnected',
      triggerLabel: t('liveStatus.networkDisconnectedLabel'),
      health: 'statusNetworkDisconnected',
      title: t('liveStatus.networkDisconnectedLabel'),
      copy: t('liveStatus.networkDisconnectedCopy'),
    },
  };
  const network = NETWORK_VIEW[networkStatus];
  const triggerColor =
    networkStatus === 'poor'
      ? T.colorNetPoor
      : networkStatus === 'bad'
        ? T.colorNetVeryPoor
        : networkStatus === 'disconnected'
          ? T.colorNetDisconnected
          : undefined;
  const networkIconStyle =
    networkStatus === 'poor' ? styles.iconWarn : networkStatus === 'bad' || networkStatus === 'disconnected' ? styles.iconDanger : null;
  const networkValueColor =
    networkStatus === 'poor'
      ? T.colorNetMetricWarn
      : networkStatus === 'bad' || networkStatus === 'disconnected'
        ? T.colorNetMetricDanger
        : T.colorBrandLight;

  const isVideoDeviceError = !!cameraLastError && cameraLastError !== DeviceErrorEnum.NO_ERROR;
  const isVideoOff = !isVideoDeviceError && cameraStatus !== DeviceStatus.ON;
  const isVideoStreamError = !isVideoDeviceError && !isVideoOff && quality === NetworkQuality.Down;
  const videoIcon = isVideoStreamError
    ? 'statusVideoError'
    : isVideoDeviceError || isVideoOff
      ? 'statusVideoOff'
      : 'statusVideo';
  const videoIconStyle = isVideoStreamError ? styles.iconDanger : isVideoDeviceError || isVideoOff ? styles.iconWarn : null;
  const videoStateText =
    isVideoDeviceError || isVideoStreamError
      ? t('liveStatus.videoError')
      : isVideoOff
        ? t('liveStatus.videoOff')
        : t('liveStatus.videoNormal');
  const videoStateCopy = isVideoDeviceError
    ? t('liveStatus.videoErrorCopy')
    : isVideoStreamError
      ? t('liveStatus.videoStreamErrorCopy')
      : isVideoOff
        ? t('liveStatus.videoOffCopy')
        : t('liveStatus.videoNormalCopy');

  const isAudioDeviceError = !!microphoneLastError && microphoneLastError !== DeviceErrorEnum.NO_ERROR;
  const isAudioOff = !isAudioDeviceError && (microphoneStatus !== DeviceStatus.ON || volume <= 0);
  const audioIcon = isAudioDeviceError || isAudioOff ? 'statusAudioOff' : 'statusAudio';
  const audioStateText = isAudioDeviceError
    ? t('liveStatus.audioError')
    : isAudioOff
      ? t('liveStatus.audioOff')
      : t('liveStatus.audioNormal');
  const audioStateCopy = isAudioDeviceError
    ? t('liveStatus.audioErrorCopy')
    : isAudioOff
      ? t('liveStatus.audioOffCopy')
      : t('liveStatus.audioNormalCopy');

  const onVolume = (v: number) => {
    const next = Math.max(0, Math.round(Number(v) || 0));
    setVolume(next);
    setCaptureVolume({ volume: next });
  };

  const renderMetric = (label: string, text: string, unit: string, divider: boolean) => (
    <View style={[styles.metric, divider && styles.metricDivider]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { fontSize: metricValueFontSize(text) }]}>{text}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </View>
  );

  const renderTab = (key: TabKey, label: string) => {
    const active = activeTab === key;
    return (
      <Pressable style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(key)}>
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <Pressable style={[styles.trigger, { top: topBarOffset + rpxToPx(124) }]} onPress={() => setVisible(true)}>
        {network.trigger != null && (
          <Icon
            name={network.trigger}
            style={[styles.triggerNetwork, { width: rpxToPx(networkStatus === 'poor' ? 26 : 34) }]}
          />
        )}
        <Text style={[styles.triggerLabel, triggerColor ? { color: triggerColor } : null]}>{network.triggerLabel}</Text>
        <View style={[styles.triggerChevron, triggerColor ? { borderColor: triggerColor } : null]} />
      </Pressable>

      <Drawer
        visible={visible}
        onClose={() => setVisible(false)}
        height={DRAWER_HEIGHT}
        overlayOpacity={0.4}
        bgImage={DRAWER_BG}
        bgImageHeight={DRAWER_HEIGHT}
        padding="20rpx 36rpx 48rpx"
      >
        <View style={styles.heading}>
          <Text style={styles.headingTitle}>{t('liveStatus.title')}</Text>
          <View style={styles.timer}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{formatClock(liveDuration)}</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {renderTab('data', t('liveStatus.realtimeData'))}
          {renderTab('device', t('liveStatus.deviceStatus'))}
        </View>

        {activeTab === 'data' ? (
          <View style={styles.page}>
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.cardHeadingTitle}>{t('liveStatus.realtimeData')}</Text>
                <Text style={styles.cardHeadingTag}>{t('liveStatus.sessionTotal')}</Text>
              </View>
              <View style={styles.dataRow}>
                {renderMetric(t('liveStatus.giftScore'), giftCoinsText, t('common.pointUnit'), true)}
                {renderMetric(t('liveStatus.gifters'), gifterCountText, t('common.personUnit'), true)}
                {renderMetric(t('liveStatus.giftCount'), giftCountText, t('common.countUnit'), true)}
              </View>
              <View style={styles.dataRow}>
                {renderMetric(t('liveStatus.onlineCount'), onlineCountText, t('common.personUnit'), false)}
                {renderMetric(t('liveStatus.likeCount'), likeCountText, t('common.timeUnit'), false)}
                {renderMetric(t('liveStatus.commenterCount'), messageCountText, t('common.messageUnit'), false)}
              </View>
            </View>
            <View style={styles.tipCard}>
              <Text style={styles.tipIcon}>↗</Text>
              <View style={styles.tipCopy}>
                <Text style={styles.tipTitle}>{t('liveStatus.updating')}</Text>
                <Text style={styles.tipSub}>{t('liveStatus.updatingCopy')}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.page}>
            <View style={styles.healthList}>
              <View style={styles.healthItem}>
                <View style={[styles.healthIcon, videoIconStyle]}>
                  <Icon name={videoIcon} style={styles.healthIconImg} />
                </View>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthTitle}>{videoStateText}</Text>
                  <Text style={styles.healthSub}>{videoStateCopy}</Text>
                </View>
                <Text style={styles.healthValue}>{videoQualityLabel}</Text>
              </View>

              <View style={[styles.healthItem, styles.audioItem]}>
                <View style={[styles.healthIcon, (isAudioDeviceError || isAudioOff) && styles.iconWarn]}>
                  <Icon name={audioIcon} style={styles.healthIconImg} />
                </View>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthTitle}>{audioStateText}</Text>
                  <Text style={styles.healthSub}>{audioStateCopy}</Text>
                  <View style={styles.volumeRow}>
                    <Slider
                      value={volume}
                      min={0}
                      max={100}
                      trackWidth={540}
                      activeColor={LIVE_TOKENS.colorBrandLight}
                      inactiveColor={LIVE_TOKENS.darkSurface16}
                      onChange={onVolume}
                      onChangeEnd={onVolume}
                    />
                    <Text style={styles.volumeValue}>{volume}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.healthItem, styles.healthItemLast]}>
                <View style={[styles.healthIcon, networkIconStyle]}>
                  <Icon name={network.health} style={styles.healthIconImg} />
                </View>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthTitle}>{network.title}</Text>
                  <Text style={styles.healthSub}>{network.copy}</Text>
                </View>
              </View>
            </View>

            <View style={styles.networkCard}>
              {[
                { value: formatNetworkMetric(networkInfo?.delay, 'ms'), label: t('liveStatus.roundTripLatency') },
                { value: formatNetworkMetric(networkInfo?.downLoss, '%'), label: t('liveStatus.downstreamLoss') },
                { value: formatNetworkMetric(networkInfo?.upLoss, '%'), label: t('liveStatus.upstreamLoss') },
              ].map((item) => (
                <View key={item.label} style={styles.networkMetric}>
                  <Text style={[styles.networkValue, { color: networkValueColor }]}>{item.value}</Text>
                  <Text style={styles.networkLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.mediaCard}>
              <View style={[styles.mediaColumn, styles.mediaColumnFirst]}>
                <Text style={styles.mediaTitle}>{t('liveStatus.videoInfo')}</Text>
                <View style={styles.mediaRow}>
                  <Text style={styles.mediaKey}>{t('liveStatus.resolution')}</Text>
                  <Text style={styles.mediaValue}>{videoResolutionText}</Text>
                </View>
                <View style={styles.mediaRow}>
                  <Text style={styles.mediaKey}>{t('liveStatus.bitrate')}</Text>
                  <Text style={styles.mediaValue}>{videoBitrateText}</Text>
                </View>
                <View style={styles.mediaRow}>
                  <Text style={styles.mediaKey}>{t('liveStatus.frameRate')}</Text>
                  <Text style={styles.mediaValue}>25 FPS</Text>
                </View>
              </View>
              <View style={styles.mediaColumn}>
                <Text style={styles.mediaTitle}>{t('liveStatus.audioInfo')}</Text>
                <View style={styles.mediaRow}>
                  <Text style={styles.mediaKey}>{t('liveStatus.sampleRate')}</Text>
                  <Text style={styles.mediaValue}>48000 Hz</Text>
                </View>
                <View style={styles.mediaRow}>
                  <Text style={styles.mediaKey}>{t('liveStatus.bitrate')}</Text>
                  <Text style={styles.mediaValue}>64 kbps</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </Drawer>
    </>
  );
});

const CARD_BORDER = {
  borderWidth: rpxToPx(1),
  borderColor: T.darkBorder07,
  backgroundColor: T.darkSurface065,
};

const styles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    right: 0,
    height: rpxToPx(44),
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: rpxToPx(20),
    paddingRight: rpxToPx(18),
    borderTopLeftRadius: rpxToPx(22),
    borderBottomLeftRadius: rpxToPx(22),
    backgroundColor: T.darkBgOverlay22,
  },
  triggerNetwork: {
    height: rpxToPx(28),
    marginRight: rpxToPx(10),
  },
  triggerLabel: {
    fontSize: rpxToPx(24),
    fontWeight: '500',
    color: T.darkText96,
    marginRight: rpxToPx(10),
  },
  triggerChevron: {
    width: rpxToPx(11),
    height: rpxToPx(11),
    borderTopWidth: rpxToPx(2),
    borderRightWidth: rpxToPx(2),
    borderColor: T.darkBorder90,
    transform: [{ rotate: '45deg' }],
    opacity: 0.86,
  },
  heading: {
    width: rpxToPx(678),
    height: rpxToPx(56),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingTitle: {
    fontSize: rpxToPx(36),
    fontWeight: '600',
    color: T.darkTextPrimary,
    marginLeft: rpxToPx(16),
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDot: {
    width: rpxToPx(10),
    height: rpxToPx(10),
    borderRadius: rpxToPx(5),
    backgroundColor: T.colorBrandLight,
    marginRight: rpxToPx(10),
  },
  timerText: {
    fontSize: rpxToPx(22),
    color: T.darkText90,
  },
  tabs: {
    width: rpxToPx(678),
    marginTop: rpxToPx(20),
    marginBottom: rpxToPx(16),
    padding: rpxToPx(6),
    flexDirection: 'row',
    borderRadius: rpxToPx(24),
    backgroundColor: T.darkSurface06,
  },
  tab: {
    flex: 1,
    height: rpxToPx(64),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: rpxToPx(18),
  },
  tabActive: {
    backgroundColor: T.colorBrandTabActive,
    borderWidth: rpxToPx(1),
    borderColor: T.colorBrandTabLine,
  },
  tabText: {
    fontSize: rpxToPx(26),
    fontWeight: '500',
    color: T.darkText50,
  },
  tabTextActive: {
    color: T.darkTextPrimary,
  },
  page: {
    width: rpxToPx(678),
    flexDirection: 'column',
  },
  card: {
    ...CARD_BORDER,
    width: rpxToPx(678),
    paddingTop: rpxToPx(32),
    paddingHorizontal: rpxToPx(24),
    paddingBottom: rpxToPx(20),
    borderRadius: rpxToPx(32),
    flexDirection: 'column',
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: rpxToPx(6),
  },
  cardHeadingTitle: {
    fontSize: rpxToPx(30),
    fontWeight: '600',
    color: T.darkText94,
  },
  cardHeadingTag: {
    fontSize: rpxToPx(20),
    color: T.darkText38,
  },
  dataRow: {
    flexDirection: 'row',
  },
  metric: {
    flex: 1,
    paddingTop: rpxToPx(28),
    paddingHorizontal: rpxToPx(8),
    paddingBottom: rpxToPx(24),
    flexDirection: 'column',
  },
  metricDivider: {
    borderBottomWidth: rpxToPx(1),
    borderBottomColor: T.darkBorder065,
  },
  metricLabel: {
    fontSize: rpxToPx(22),
    color: T.darkText50,
    marginBottom: rpxToPx(12),
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  metricValue: {
    fontWeight: '600',
    color: T.darkText96,
    lineHeight: rpxToPx(40),
  },
  metricUnit: {
    fontSize: rpxToPx(18),
    color: T.darkText36,
    marginLeft: rpxToPx(6),
    marginBottom: rpxToPx(4),
  },
  tipCard: {
    ...CARD_BORDER,
    width: rpxToPx(678),
    marginTop: rpxToPx(20),
    paddingVertical: rpxToPx(22),
    paddingHorizontal: rpxToPx(24),
    borderRadius: rpxToPx(28),
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipIcon: {
    width: rpxToPx(56),
    height: rpxToPx(56),
    borderRadius: rpxToPx(18),
    overflow: 'hidden',
    backgroundColor: T.colorBrandTintSoft,
    color: T.colorBrandLight,
    fontSize: rpxToPx(32),
    textAlign: 'center',
    lineHeight: rpxToPx(56),
    marginRight: rpxToPx(20),
  },
  tipCopy: {
    flex: 1,
    flexDirection: 'column',
  },
  tipTitle: {
    fontSize: rpxToPx(24),
    fontWeight: '600',
    color: T.darkText82,
  },
  tipSub: {
    fontSize: rpxToPx(20),
    color: T.darkText38,
    marginTop: rpxToPx(4),
  },
  healthList: {
    width: rpxToPx(678),
    paddingTop: rpxToPx(6),
    paddingHorizontal: rpxToPx(6),
    flexDirection: 'column',
  },
  healthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: rpxToPx(100),
    borderBottomWidth: rpxToPx(1),
    borderBottomColor: T.darkBorder065,
  },
  healthItemLast: {
    borderBottomWidth: 0,
  },
  healthIcon: {
    width: rpxToPx(54),
    height: rpxToPx(54),
    borderRadius: rpxToPx(18),
    borderWidth: rpxToPx(1),
    borderColor: T.colorBrandIconLine,
    backgroundColor: T.colorBrandIconSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWarn: {
    borderColor: T.colorNetWarnLine,
    backgroundColor: T.colorNetWarnSoft,
  },
  iconDanger: {
    borderColor: T.colorNetDangerLine,
    backgroundColor: T.colorNetDangerSoft,
  },
  healthIconImg: {
    width: rpxToPx(36),
    height: rpxToPx(36),
  },
  healthCopy: {
    flex: 1,
    marginLeft: rpxToPx(18),
    flexDirection: 'column',
  },
  healthTitle: {
    fontSize: rpxToPx(26),
    fontWeight: '600',
    color: T.darkText90,
  },
  healthSub: {
    fontSize: rpxToPx(20),
    color: T.darkText38,
    marginTop: rpxToPx(4),
  },
  healthValue: {
    fontSize: rpxToPx(22),
    color: T.darkText42,
  },
  audioItem: {
    alignItems: 'flex-start',
    minHeight: rpxToPx(136),
    paddingTop: rpxToPx(16),
    paddingBottom: rpxToPx(12),
  },
  volumeRow: {
    marginTop: rpxToPx(8),
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeValue: {
    width: rpxToPx(52),
    fontSize: rpxToPx(20),
    color: T.darkText50,
    textAlign: 'right',
  },
  networkCard: {
    ...CARD_BORDER,
    width: rpxToPx(678),
    marginTop: rpxToPx(12),
    paddingVertical: rpxToPx(16),
    paddingHorizontal: rpxToPx(8),
    borderRadius: rpxToPx(28),
    flexDirection: 'row',
  },
  networkMetric: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
  },
  networkValue: {
    fontSize: rpxToPx(36),
    fontWeight: '600',
  },
  networkLabel: {
    fontSize: rpxToPx(18),
    color: T.darkText42,
    marginTop: rpxToPx(8),
  },
  mediaCard: {
    ...CARD_BORDER,
    width: rpxToPx(678),
    marginTop: rpxToPx(12),
    padding: rpxToPx(20),
    borderRadius: rpxToPx(28),
    flexDirection: 'row',
  },
  mediaColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  mediaColumnFirst: {
    marginRight: rpxToPx(36),
  },
  mediaTitle: {
    fontSize: rpxToPx(22),
    fontWeight: '600',
    color: T.darkText82,
  },
  mediaRow: {
    marginTop: rpxToPx(10),
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaKey: {
    width: rpxToPx(100),
    fontSize: rpxToPx(18),
    color: T.darkText34,
  },
  mediaValue: {
    fontSize: rpxToPx(18),
    color: T.darkText68,
  },
});

export default LiveStatusPanel;
