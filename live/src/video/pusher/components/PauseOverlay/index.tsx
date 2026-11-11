import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../../../styles/tokens';
import { rpxToPx } from '../../../../utils';

export interface PauseOverlayProps {
  visible?: boolean;
  seconds?: number;
  onResume?: () => void;
}

export const PauseOverlay = memo(function PauseOverlay({ visible = false, seconds = 0, onResume }: PauseOverlayProps) {
  const { t } = useLiveTranslation();
  if (!visible) return null;

  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('morePanel.livePaused')}</Text>
        <Text style={styles.timer}>{`${m}:${s}`}</Text>
      </View>
      <Pressable style={styles.resume} onPress={onResume}>
        <Text style={styles.resumeText}>{t('morePanel.resumeLive')}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.mask90,
    zIndex: 999,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(42),
    fontWeight: '600',
  },
  timer: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(72),
    fontWeight: '600',
    marginTop: rpxToPx(40),
  },
  resume: {
    position: 'absolute',
    bottom: rpxToPx(120),
    left: rpxToPx(170),
    right: rpxToPx(170),
    height: rpxToPx(96),
    borderRadius: rpxToPx(20),
    backgroundColor: T.surfaceWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeText: {
    color: T.lightTextInverse,
    fontSize: rpxToPx(34),
    fontWeight: '600',
  },
});

export default PauseOverlay;
