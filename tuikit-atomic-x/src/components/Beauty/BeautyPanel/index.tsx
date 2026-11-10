import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../Common';
import { useBaseBeautyState, type BeautyType } from '../../../atomic-x';
import {
  Drawer,
  Icon,
  SwitchButton,
  rpxToPx,
  type IconName,
} from '../../Common';
import { Slider } from '../../Common/Slider';
import { useBeautyTranslation } from '../locales';

export interface BeautyPanelProps {
  visible?: boolean;
  onClose?: () => void;
}

type BeautyLevels = Record<BeautyType, number>;

const TABS: Array<{
  key: BeautyType;
  labelKey: string;
  icon: IconName;
}> = [
  {
    key: 'smooth',
    labelKey: 'smoothing',
    icon: 'beautySmooth',
  },
  {
    key: 'whiteness',
    labelKey: 'whitening',
    icon: 'beautyWhiten',
  },
  {
    key: 'ruddy',
    labelKey: 'rosy',
    icon: 'beautyRosy',
  },
];

const DRAWER_BG = require('../../../static/assets/live/drawer-bg.png');
const DRAWER_HEIGHT = 440;

export function BeautyPanel({ visible = false, onClose }: BeautyPanelProps) {
  const { t } = useBeautyTranslation();
  const {
    smoothLevel,
    whitenessLevel,
    ruddyLevel,
    setSmoothLevel,
    setWhitenessLevel,
    setRuddyLevel,
  } = useBaseBeautyState();

  const [levels, setLevels] = useState<BeautyLevels>({
    smooth: smoothLevel,
    whiteness: whitenessLevel,
    ruddy: ruddyLevel,
  });
  const [activeKey, setActiveKey] = useState<BeautyType>('smooth');
  const [beautyOn, setBeautyOn] = useState(true);
  const savedLevelsRef = useRef<BeautyLevels>({
    smooth: smoothLevel,
    whiteness: whitenessLevel,
    ruddy: ruddyLevel,
  });

  useEffect(() => {
    setLevels({
      smooth: smoothLevel,
      whiteness: whitenessLevel,
      ruddy: ruddyLevel,
    });
  }, [smoothLevel, whitenessLevel, ruddyLevel]);

  useEffect(() => {
    if (visible) setActiveKey('smooth');
  }, [visible]);

  const activeTab = TABS.find((tab) => tab.key === activeKey) ?? TABS[0]!;
  const activeLevel = beautyOn
    ? levels[activeKey]
    : savedLevelsRef.current[activeKey];

  const applyLevel = (key: BeautyType, value: number) => {
    setLevels((prev) => ({ ...prev, [key]: value }));
    if (key === 'smooth') {
      setSmoothLevel({ smoothLevel: value });
    } else if (key === 'whiteness') {
      setWhitenessLevel({ whitenessLevel: value });
    } else {
      setRuddyLevel({ ruddyLevel: value });
    }
  };

  const onLevel = (v: number) => {
    if (beautyOn) applyLevel(activeKey, v);
  };

  const setEnabled = (enabled: boolean) => {
    if (enabled === beautyOn) return;
    if (!enabled) {
      savedLevelsRef.current = { ...levels };
      applyLevel('smooth', 0);
      applyLevel('whiteness', 0);
      applyLevel('ruddy', 0);
    } else {
      const saved = savedLevelsRef.current;
      applyLevel('smooth', saved.smooth);
      applyLevel('whiteness', saved.whiteness);
      applyLevel('ruddy', saved.ruddy);
    }
    setBeautyOn(enabled);
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={DRAWER_HEIGHT}
      overlayOpacity={0.4}
      bgImage={DRAWER_BG}
      bgImageHeight={DRAWER_HEIGHT}
      padding="0 40rpx 0 40rpx"
      showHandle
    >
      <Text style={styles.title}>{t('beauty_title')}</Text>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>{t(activeTab.labelKey)}</Text>
        <View style={!beautyOn && styles.disabled}>
          <Slider
            value={activeLevel}
            min={0}
            max={9}
            trackWidth={526}
            disabled={!beautyOn}
            onChange={onLevel}
            onChangeEnd={onLevel}
          />
        </View>
        <Text style={styles.sliderValue}>{activeLevel}</Text>
      </View>
      <View style={styles.optionRow}>
        <View style={styles.option}>
          <View style={styles.optionSlot}>
            <SwitchButton value={beautyOn} onChange={setEnabled} />
          </View>
          <Text style={styles.optionLabel}>{t('beauty_title')}</Text>
        </View>
        {TABS.map((tab) => {
          const active = activeKey === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={styles.option}
              onPress={() => setActiveKey(tab.key)}
            >
              <View style={styles.optionSlot}>
                <View
                  style={[styles.optionIcon, active && styles.optionIconActive]}
                >
                  <Icon
                    name={tab.icon}
                    style={[styles.optionImg, active && styles.optionImgActive]}
                  />
                </View>
              </View>
              <Text
                style={[styles.optionLabel, active && styles.optionLabelActive]}
              >
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: rpxToPx(16),
    fontSize: rpxToPx(30),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.94)',
    textAlign: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: rpxToPx(36),
  },
  sliderLabel: {
    width: rpxToPx(68),
    fontSize: rpxToPx(24),
    color: 'rgba(255, 255, 255, 0.64)',
  },
  sliderValue: {
    width: rpxToPx(44),
    fontSize: rpxToPx(26),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
  },
  disabled: {
    opacity: 0.4,
  },
  optionRow: {
    width: rpxToPx(670),
    flexDirection: 'row',
    marginTop: rpxToPx(32),
  },
  option: {
    width: rpxToPx(167),
    flexDirection: 'column',
    alignItems: 'center',
  },
  optionSlot: {
    width: rpxToPx(88),
    height: rpxToPx(88),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rpxToPx(8),
  },
  optionIcon: {
    width: rpxToPx(88),
    height: rpxToPx(88),
    borderRadius: rpxToPx(44),
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    borderColor: '#4fa3ff',
    backgroundColor: 'rgba(46, 122, 235, 0.32)',
  },
  optionImg: {
    width: rpxToPx(48),
    height: rpxToPx(48),
    opacity: 0.82,
  },
  optionImgActive: {
    opacity: 1,
  },
  optionLabel: {
    marginTop: rpxToPx(16),
    fontSize: rpxToPx(24),
    color: 'rgba(255, 255, 255, 0.64)',
  },
  optionLabelActive: {
    color: 'rgba(255, 255, 255, 0.94)',
  },
});

export default BeautyPanel;
