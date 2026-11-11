import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { AudioEffectPanel, Drawer, Icon, MirrorType, useDeviceState } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx, DRAWER_BG } from '../../../../utils';

export interface BeforeLiveSettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  onTip?: (title: string) => void;
}


export function BeforeLiveSettingsPanel({ visible, onClose, onTip }: BeforeLiveSettingsPanelProps) {
  const { t } = useLiveTranslation();
  const { localMirrorType, isFrontCamera, switchMirror } = useDeviceState();
  const [audioEffectVisible, setAudioEffectVisible] = useState(false);

  const mirrorEnabled = localMirrorType === MirrorType.AUTO || localMirrorType === MirrorType.ENABLE;

  const handleMirror = () => {
    if (!isFrontCamera) {
      onTip?.(t('morePanel.frontOnly'));
      return;
    }
    switchMirror({ mirrorType: mirrorEnabled ? MirrorType.DISABLE : MirrorType.ENABLE });
  };

  const handleAudioEffect = () => {
    setAudioEffectVisible(true);
    onClose();
  };

  return (
    <>
      <Drawer
        visible={visible}
        onClose={onClose}
        height={300}
        overlayOpacity={0.5}
        bgImage={DRAWER_BG}
        bgImageHeight={710}
        padding="0 48rpx 40rpx 48rpx"
        useSafeBottom
      >
        <Text style={styles.title}>{t('anchor.moreSettings')}</Text>
        <View style={styles.list}>
          <Pressable style={styles.cap} onPress={handleMirror}>
            <View style={styles.capIcon}>
              <Icon name="mirror" style={[styles.capImg, { transform: [{ scaleX: mirrorEnabled ? 1 : -1 }] }]} />
            </View>
            <Text style={styles.capLabel} numberOfLines={1}>
              {t('morePanel.mirror')}
            </Text>
          </Pressable>
          <Pressable style={styles.cap} onPress={handleAudioEffect}>
            <View style={styles.capIcon}>
              <Icon name="audioEffect" style={styles.capImg} />
            </View>
            <Text style={styles.capLabel} numberOfLines={1}>
              {t('anchor.soundEffect')}
            </Text>
          </Pressable>
        </View>
      </Drawer>
      <AudioEffectPanel visible={audioEffectVisible} onClose={() => setAudioEffectVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(32),
    fontWeight: '500',
    textAlign: 'center',
  },
  list: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: rpxToPx(654),
  },
  cap: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
  },
  capIcon: {
    width: rpxToPx(88),
    height: rpxToPx(88),
    borderRadius: rpxToPx(44),
    backgroundColor: T.darkSurface08,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: rpxToPx(16),
  },
  capImg: {
    width: rpxToPx(44),
    height: rpxToPx(44),
  },
  capLabel: {
    fontSize: rpxToPx(22),
    color: T.darkText75,
    textAlign: 'center',
  },
});

export default BeforeLiveSettingsPanel;
