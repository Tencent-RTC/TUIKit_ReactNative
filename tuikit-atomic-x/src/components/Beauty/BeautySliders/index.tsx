import { StyleSheet, View } from 'react-native';
import { Text } from '../../Common';
import { useBaseBeautyState } from '../../../atomic-x';
import { rpxToPx } from '../../Common';
import { Slider } from '../../Common/Slider';
import { useBeautyTranslation } from '../locales';

export interface BeautySlidersProps {
  trackWidth?: number;
}

export function BeautySliders({ trackWidth = 320 }: BeautySlidersProps) {
  const { t } = useBeautyTranslation();
  const {
    smoothLevel,
    whitenessLevel,
    ruddyLevel,
    setSmoothLevel,
    setWhitenessLevel,
    setRuddyLevel,
  } = useBaseBeautyState();

  const onSmooth = (v: number) => {
    setSmoothLevel({ smoothLevel: v });
  };
  const onWhiteness = (v: number) => {
    setWhitenessLevel({ whitenessLevel: v });
  };
  const onRuddy = (v: number) => {
    setRuddyLevel({ ruddyLevel: v });
  };

  const rows = [
    {
      key: 'smooth',
      label: t('smoothing'),
      value: smoothLevel,
      onChange: onSmooth,
    },
    {
      key: 'whiteness',
      label: t('whitening'),
      value: whitenessLevel,
      onChange: onWhiteness,
    },
    { key: 'ruddy', label: t('rosy'), value: ruddyLevel, onChange: onRuddy },
  ];

  return (
    <View style={styles.rows}>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <View style={styles.slider}>
            <Slider
              value={row.value}
              min={0}
              max={9}
              trackWidth={trackWidth}
              onChange={row.onChange}
              onChangeEnd={row.onChange}
            />
          </View>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: rpxToPx(12),
    height: rpxToPx(60),
  },
  label: {
    width: rpxToPx(88),
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: rpxToPx(26),
  },
  slider: {
    marginHorizontal: rpxToPx(20),
  },
  value: {
    width: rpxToPx(40),
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: rpxToPx(24),
    textAlign: 'right',
  },
});

export default BeautySliders;
