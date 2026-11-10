import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type SummaryData } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation, type LiveTranslate } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx, formatClock } from '../../../../utils';

export interface LiveSummaryViewProps {
  summary?: SummaryData | null;
  liveDuration?: number;
  startTime?: number;
  endedAt?: number;
  pausedSeconds?: number;
  onClose?: () => void;
}

const SUMMARY_BG = require('../../../../static/images/live/background/summary-bg.png');

const STATS = [
  { key: 'gifts', valueKey: 'totalGiftsSent', labelKey: 'anchor.summaryGifts', unitKey: 'anchor.unitItems', color: T.colorStatGift, soft: 'rgba(240, 188, 95, 0.085)' },
  { key: 'coins', valueKey: 'totalGiftCoins', labelKey: 'anchor.summaryGiftCoins', unitKey: 'anchor.unitCoins', color: T.colorStatCoin, soft: 'rgba(255, 110, 157, 0.085)' },
  { key: 'viewers', valueKey: 'totalViewers', labelKey: 'anchor.summaryViewers', unitKey: 'anchor.unitPeople', color: T.colorStatViewer, soft: 'rgba(105, 168, 255, 0.085)' },
  { key: 'comments', valueKey: 'totalMessageSent', labelKey: 'anchor.summaryComments', unitKey: 'anchor.unitMessages', color: T.colorStatComment, soft: 'rgba(190, 131, 255, 0.085)' },
  { key: 'senders', valueKey: 'totalGiftUniqueSenders', labelKey: 'anchor.summaryGiftSenders', unitKey: 'anchor.unitPeople', color: T.colorStatSender, soft: 'rgba(87, 213, 191, 0.085)' },
  { key: 'likes', valueKey: 'totalLikesReceived', labelKey: 'anchor.summaryLikes', unitKey: 'anchor.unitTimes', color: T.colorStatLike, soft: 'rgba(255, 123, 114, 0.085)' },
];

const formatCount = (value: number, t: LiveTranslate) => {
  const n = Number(value) || 0;
  return n >= 10000 ? `${(n / 10000).toFixed(1)}${t('common.wanUnit')}` : `${n}`;
};

const formatHHmm = (ms: number) => {
  const v = Number(ms) || 0;
  if (v <= 0) return '--:--';
  const d = new Date(v);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function LiveSummaryView({
  summary = null,
  liveDuration = 0,
  startTime = 0,
  endedAt = 0,
  pausedSeconds = 0,
  onClose,
}: LiveSummaryViewProps) {
  const { t } = useLiveTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const items = STATS.map((item) => {
    const raw = Number((summary as Record<string, unknown> | null)?.[item.valueKey]) || 0;
    const value = item.key === 'viewers' ? raw - 1 : raw;
    return { ...item, value: summary ? Math.max(0, value) : null };
  });
  const rows = [items.slice(0, 2), items.slice(2, 4), items.slice(4, 6)];

  return (
    <View style={styles.page}>
      <Image style={[styles.pageBg, { height: screenHeight }]} source={SUMMARY_BG} resizeMode="stretch" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.back} onPress={onClose}>
            <Icon name="summaryBack" style={styles.backIcon} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('anchor.summaryTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroRing}>
            <View style={styles.heroMark}>
              <View style={styles.heroCheck} />
            </View>
          </View>
          <Text style={styles.heroEnded}>{t('anchor.liveEnded')}</Text>
          <Text style={styles.heroTimeRange}>{`${formatHHmm(startTime)} ~ ${formatHHmm(endedAt)}`}</Text>
          <Text style={styles.heroDurationLabel}>{t('anchor.summaryDuration')}</Text>
          <Text style={styles.heroDuration}>{formatClock(liveDuration)}</Text>
          {pausedSeconds > 0 && (
            <View style={styles.heroPause}>
              <Text style={styles.heroPauseLabel}>{t('anchor.pausedDuration')}</Text>
              <Text style={styles.heroPauseValue}>{formatClock(pausedSeconds)}</Text>
            </View>
          )}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('anchor.sessionData')}</Text>
        </View>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((item) => (
              <View key={item.key} style={[styles.stat, { backgroundColor: item.soft }]}>
                <View style={[styles.statMark, { backgroundColor: item.color }]} />
                <Text style={styles.statLabel}>{t(item.labelKey)}</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{item.value === null ? '--' : formatCount(item.value, t)}</Text>
                  <Text style={styles.statUnit}>{t(item.unitKey)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={{ height: insets.bottom + rpxToPx(40) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.darkBgSummary,
    flexDirection: 'column',
  },
  pageBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: rpxToPx(750),
  },
  header: {
    width: rpxToPx(750),
  },
  headerRow: {
    width: rpxToPx(750),
    height: rpxToPx(116),
    paddingHorizontal: rpxToPx(24),
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: rpxToPx(76),
    height: rpxToPx(76),
    borderRadius: rpxToPx(38),
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: rpxToPx(42),
    height: rpxToPx(42),
  },
  headerTitle: {
    flex: 1,
    color: T.darkText90,
    fontSize: rpxToPx(30),
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: rpxToPx(76),
    height: rpxToPx(76),
  },
  scroll: {
    flex: 1,
    width: rpxToPx(750),
  },
  hero: {
    width: rpxToPx(686),
    marginTop: rpxToPx(20),
    marginLeft: rpxToPx(32),
    paddingTop: rpxToPx(38),
    paddingHorizontal: rpxToPx(24),
    paddingBottom: rpxToPx(36),
    borderRadius: rpxToPx(44),
    borderWidth: rpxToPx(1),
    borderColor: T.darkBorder085,
    backgroundColor: 'rgba(74, 158, 255, 0.09)',
    alignItems: 'center',
    flexDirection: 'column',
  },
  heroRing: {
    width: rpxToPx(120),
    height: rpxToPx(120),
    borderRadius: rpxToPx(60),
    backgroundColor: 'rgba(74, 158, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMark: {
    width: rpxToPx(96),
    height: rpxToPx(96),
    borderRadius: rpxToPx(48),
    backgroundColor: T.colorSummaryMark,
    borderWidth: rpxToPx(1),
    borderColor: T.colorBrandLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCheck: {
    width: rpxToPx(36),
    height: rpxToPx(18),
    borderLeftWidth: rpxToPx(4),
    borderBottomWidth: rpxToPx(4),
    borderColor: T.darkBorderSolid,
    transform: [{ translateY: -rpxToPx(4) }, { rotate: '-45deg' }],
  },
  heroEnded: {
    marginTop: rpxToPx(26),
    color: T.darkText95,
    fontSize: rpxToPx(38),
    fontWeight: '700',
  },
  heroTimeRange: {
    marginTop: rpxToPx(12),
    color: T.darkText45,
    fontSize: rpxToPx(22),
  },
  heroDurationLabel: {
    marginTop: rpxToPx(34),
    color: T.darkText48,
    fontSize: rpxToPx(20),
    fontWeight: '600',
  },
  heroDuration: {
    marginTop: rpxToPx(10),
    color: T.colorBrandTextStrong,
    fontSize: rpxToPx(60),
    fontWeight: '700',
    letterSpacing: rpxToPx(3),
  },
  heroPause: {
    marginTop: rpxToPx(24),
    paddingVertical: rpxToPx(10),
    paddingHorizontal: rpxToPx(18),
    borderRadius: rpxToPx(40),
    borderWidth: rpxToPx(1),
    borderColor: T.darkBorder07,
    backgroundColor: T.darkSurface045,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPauseLabel: {
    color: T.darkText50,
    fontSize: rpxToPx(20),
  },
  heroPauseValue: {
    marginLeft: rpxToPx(10),
    color: T.darkText62,
    fontSize: rpxToPx(20),
    fontWeight: '600',
  },
  section: {
    width: rpxToPx(686),
    marginTop: rpxToPx(40),
    marginLeft: rpxToPx(32),
  },
  sectionTitle: {
    color: T.darkText90,
    fontSize: rpxToPx(30),
    fontWeight: '600',
  },
  gridRow: {
    width: rpxToPx(686),
    marginTop: rpxToPx(20),
    marginLeft: rpxToPx(32),
    flexDirection: 'row',
  },
  stat: {
    width: rpxToPx(333),
    minHeight: rpxToPx(176),
    marginRight: rpxToPx(20),
    padding: rpxToPx(26),
    borderRadius: rpxToPx(32),
    borderWidth: rpxToPx(1),
    borderColor: T.darkBorder065,
    flexDirection: 'column',
  },
  statMark: {
    width: rpxToPx(32),
    height: rpxToPx(8),
    borderRadius: rpxToPx(4),
  },
  statLabel: {
    marginTop: rpxToPx(18),
    color: T.darkText46,
    fontSize: rpxToPx(20),
    fontWeight: '600',
  },
  statValueRow: {
    marginTop: rpxToPx(8),
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statValue: {
    color: T.darkText94,
    fontSize: rpxToPx(46),
    fontWeight: '700',
  },
  statUnit: {
    marginLeft: rpxToPx(8),
    marginBottom: rpxToPx(8),
    color: T.darkText38,
    fontSize: rpxToPx(18),
  },
});

export default LiveSummaryView;
