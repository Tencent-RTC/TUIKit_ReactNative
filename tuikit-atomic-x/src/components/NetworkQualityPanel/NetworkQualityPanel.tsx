import { StyleSheet, View } from 'react-native';
import { Text } from '../Common';
import { useDeviceState } from '../../atomic-x';
import { Drawer, rpxToPx } from '../Common';
import { useNetworkQualityPanelTranslation } from './locales';

export interface NetworkQualityPanelProps {
  visible?: boolean;
  onClose?: () => void;
}

const DRAWER_HEIGHT = 360;
const RTT_THRESHOLD = 100;
const LOSS_THRESHOLD = 0.1;
const COLOR_RED = 'rgba(230, 89, 76, 1)';
const COLOR_GREEN = 'rgba(56, 166, 115, 1)';

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function NetworkQualityPanel({
  visible = false,
  onClose,
}: NetworkQualityPanelProps) {
  const { t } = useNetworkQualityPanelTranslation();
  const { networkInfo } = useDeviceState();

  const delay = toNumber(networkInfo?.delay);
  const downLoss = toNumber(networkInfo?.downLoss);
  const upLoss = toNumber(networkInfo?.upLoss);

  const metrics = [
    {
      key: 'rtt',
      value: `${delay}ms`,
      bad: delay > RTT_THRESHOLD,
      label: t('nq.rtt'),
    },
    {
      key: 'downLoss',
      value: `${downLoss}%`,
      bad: downLoss > LOSS_THRESHOLD,
      label: t('nq.downLoss'),
    },
    {
      key: 'upLoss',
      value: `${upLoss}%`,
      bad: upLoss > LOSS_THRESHOLD,
      label: t('nq.upLoss'),
    },
  ];

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={DRAWER_HEIGHT}
      borderRadius={32}
      overlayOpacity={0.4}
      showHandle={false}
      showGlow={false}
      padding="0"
    >
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('nq.title')}</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <View key={metric.key} style={styles.metricItem}>
                <Text
                  style={[
                    styles.metricValue,
                    { color: metric.bad ? COLOR_RED : COLOR_GREEN },
                  ]}
                >
                  {metric.value}
                </Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(34, 38, 46, 1)',
  },
  header: {
    paddingTop: rpxToPx(40),
    paddingBottom: rpxToPx(20),
    alignItems: 'center',
  },
  title: {
    fontSize: rpxToPx(32),
    color: '#ffffff',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: rpxToPx(48),
    paddingTop: rpxToPx(20),
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: rpxToPx(16),
    paddingVertical: rpxToPx(32),
    paddingHorizontal: rpxToPx(24),
    backgroundColor: 'rgba(43, 44, 48, 1)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: rpxToPx(32),
    fontWeight: '500',
    marginBottom: rpxToPx(12),
  },
  metricLabel: {
    fontSize: rpxToPx(26),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});

export default NetworkQualityPanel;
