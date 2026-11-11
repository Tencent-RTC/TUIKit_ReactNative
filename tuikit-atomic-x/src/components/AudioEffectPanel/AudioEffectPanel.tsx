import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Common';
import {
  useAudioEffectState,
  useDeviceState,
  type AudioChangerTypeParam,
  type AudioReverbTypeParam,
} from '../../atomic-x';
import { Drawer, Icon, SwitchButton, rpxToPx, type IconName } from '../Common';
import { Slider } from '../Common/Slider';
import { useAudioEffectTranslation } from './locales';

export interface AudioEffectPanelProps {
  visible?: boolean;
  onClose?: () => void;
}

interface EffectOption<K extends string> {
  key: K;
  labelKey: string;
  icon: IconName;
}

const DRAWER_BG = require('../../static/assets/live/drawer-bg.png');

const VOICE_OPTIONS: EffectOption<AudioChangerTypeParam>[] = [
  {
    key: 'NONE',
    labelKey: 'original',
    icon: 'voiceOriginal',
  },
  {
    key: 'CHILD',
    labelKey: 'child',
    icon: 'voiceChild',
  },
  {
    key: 'LITTLE_GIRL',
    labelKey: 'loli',
    icon: 'voiceLoli',
  },
  {
    key: 'MAN',
    labelKey: 'uncle',
    icon: 'voiceUncle',
  },
  {
    key: 'ETHEREAL',
    labelKey: 'ethereal',
    icon: 'voiceSpirit',
  },
];

const REVERB_OPTIONS: EffectOption<AudioReverbTypeParam>[] = [
  {
    key: 'NONE',
    labelKey: 'none',
    icon: 'reverbNone',
  },
  {
    key: 'KTV',
    labelKey: 'ktv',
    icon: 'reverbKtv',
  },
  {
    key: 'METALLIC',
    labelKey: 'metal',
    icon: 'reverbMetal',
  },
  {
    key: 'DEEP',
    labelKey: 'deep',
    icon: 'reverbDeep',
  },
  {
    key: 'LOUD',
    labelKey: 'loud',
    icon: 'reverbBright',
  },
];

export function AudioEffectPanel({
  visible = false,
  onClose,
}: AudioEffectPanelProps) {
  const { t } = useAudioEffectTranslation();
  const {
    isEarMonitorOpened,
    earMonitorVolume,
    audioChangerType,
    audioReverbType,
    setVoiceEarMonitorEnable,
    setVoiceEarMonitorVolume,
    setAudioChangerType,
    setAudioReverbType,
  } = useAudioEffectState();
  const { captureVolume, setCaptureVolume } = useDeviceState();

  const [earVolume, setEarVolume] = useState(earMonitorVolume);
  const [voiceVolume, setVoiceVolume] = useState(100);
  const [changerType, setChangerType] = useState(audioChangerType);
  const [reverbType, setReverbType] = useState(audioReverbType);

  useEffect(() => setEarVolume(earMonitorVolume), [earMonitorVolume]);
  useEffect(() => setChangerType(audioChangerType), [audioChangerType]);
  useEffect(() => setReverbType(audioReverbType), [audioReverbType]);
  useEffect(() => setVoiceVolume(captureVolume), [captureVolume, visible]);

  const onEarVolume = (v: number) => {
    setEarVolume(v);
    setVoiceEarMonitorVolume({ volume: v });
  };

  const onVoiceVolume = (v: number) => {
    setVoiceVolume(v);
    setCaptureVolume({ volume: v });
  };

  const handleVoiceChange = (key: AudioChangerTypeParam) => {
    setChangerType(key);
    setAudioChangerType({ changerType: key });
  };

  const handleReverbChange = (key: AudioReverbTypeParam) => {
    setReverbType(key);
    setAudioReverbType({ reverbType: key });
  };

  const renderOptions = <K extends string>(
    options: EffectOption<K>[],
    selected: K,
    onSelect: (key: K) => void
  ) => (
    <View style={styles.optionGrid}>
      {options.map((option) => {
        const on = selected === option.key;
        return (
          <Pressable
            key={option.key}
            style={styles.option}
            onPress={() => onSelect(option.key)}
          >
            <View style={[styles.optionIconWrap, on && styles.optionIconOn]}>
              <Icon
                name={option.icon}
                style={[styles.optionIcon, on && styles.optionIconImgOn]}
              />
            </View>
            <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>
              {t(option.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={990}
      overlayOpacity={0.5}
      bgImage={DRAWER_BG}
      bgImageHeight={1200}
      padding="20rpx 36rpx 48rpx"
      useSafeBottom
    >
      <View style={styles.heading}>
        <Text style={styles.title}>{t('title')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('earback')}</Text>
          <SwitchButton
            value={isEarMonitorOpened}
            onChange={(next) => setVoiceEarMonitorEnable({ enable: next })}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('earbackVolume')}</Text>
          <View style={styles.rowSlider}>
            <Slider
              value={earVolume}
              min={0}
              max={100}
              trackWidth={340}
              onChange={onEarVolume}
              onChangeEnd={onEarVolume}
            />
            <Text style={styles.rowValue}>{earVolume}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('audioSettings')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('voiceVolume')}</Text>
            <View style={styles.rowSlider}>
              <Slider
                value={voiceVolume}
                min={0}
                max={100}
                trackWidth={340}
                onChange={onVoiceVolume}
                onChangeEnd={onVoiceVolume}
              />
              <Text style={styles.rowValue}>{voiceVolume}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('voiceChange')}</Text>
        {renderOptions(VOICE_OPTIONS, changerType, handleVoiceChange)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('reverb')}</Text>
        {renderOptions(REVERB_OPTIONS, reverbType, handleReverbChange)}
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: rpxToPx(-12),
  },
  title: {
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: rpxToPx(30),
    fontWeight: '600',
    letterSpacing: rpxToPx(0.6),
  },
  card: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    borderWidth: rpxToPx(1),
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: rpxToPx(28),
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    paddingHorizontal: rpxToPx(24),
    marginTop: rpxToPx(24),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: rpxToPx(96),
  },
  divider: {
    height: rpxToPx(1),
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  rowLabel: {
    color: 'rgba(255, 255, 255, 0.84)',
    fontSize: rpxToPx(24),
    fontWeight: '500',
  },
  rowSlider: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  rowValue: {
    width: rpxToPx(54),
    color: 'rgba(255, 255, 255, 0.74)',
    fontSize: rpxToPx(22),
    textAlign: 'right',
  },
  section: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    marginTop: rpxToPx(28),
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.48)',
    fontSize: rpxToPx(22),
    fontWeight: '500',
    marginTop: 0,
    marginHorizontal: rpxToPx(8),
    marginBottom: rpxToPx(14),
  },
  optionGrid: {
    flexDirection: 'row',
  },
  option: {
    width: rpxToPx(134),
    flexDirection: 'column',
    alignItems: 'center',
  },
  optionIconWrap: {
    width: rpxToPx(96),
    height: rpxToPx(96),
    borderRadius: rpxToPx(28),
    borderWidth: rpxToPx(1),
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rpxToPx(12),
  },
  optionIconOn: {
    borderColor: 'rgba(74, 158, 255, 0.6)',
    backgroundColor: 'rgba(74, 158, 255, 0.22)',
  },
  optionIcon: {
    width: rpxToPx(48),
    height: rpxToPx(48),
    opacity: 0.68,
  },
  optionIconImgOn: {
    opacity: 1,
  },
  optionLabel: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: rpxToPx(21),
    textAlign: 'center',
  },
  optionLabelOn: {
    color: '#FFFFFF',
  },
});

export default AudioEffectPanel;
