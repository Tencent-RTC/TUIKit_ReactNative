import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { Drawer } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../../../locales';
import { LIVE_STYLE_TOKENS as T, LIVE_TOKENS } from '../../../../styles/tokens';
import { rpxToPx, DRAWER_BG } from '../../../../utils';

export interface CoverPickerPanelProps {
  visible: boolean;
  onClose: () => void;
  selectedURL?: string;
  onSelect?: (url: string) => void;
}

export const PRESET_COVER_URLS = [1, 2, 3, 4, 5].map(
  (i) => `https://liteav-test-1252463788.cos.ap-guangzhou.myqcloud.com/live/live_cover${i}.png`,
);

export function CoverPickerPanel({ visible, onClose, selectedURL, onSelect }: CoverPickerPanelProps) {
  const { t } = useLiveTranslation();
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const currentURL = selectedURL || PRESET_COVER_URLS[0];

  const markLoaded = (url: string) => setLoadedMap((prev) => (prev[url] ? prev : { ...prev, [url]: true }));

  const handleSelect = (url: string) => {
    onSelect?.(url);
    onClose();
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      height={300}
      overlayOpacity={0.4}
      bgImage={DRAWER_BG}
      bgImageHeight={710}
      padding="0 40rpx 23rpx 40rpx"
      useSafeBottom
    >
      <Text style={styles.title}>{t('anchor.changeCover')}</Text>
      <View style={styles.list}>
        {PRESET_COVER_URLS.map((url) => (
          <Pressable
            key={url}
            style={[
              styles.option,
              { backgroundColor: url === currentURL ? LIVE_TOKENS.colorBrandLight : LIVE_TOKENS.darkSurface14 },
            ]}
            onPress={() => handleSelect(url)}
          >
            <Image
              style={[styles.img, !loadedMap[url] && styles.imgLoading]}
              source={{ uri: url }}
              resizeMode="cover"
              onLoad={() => markLoaded(url)}
              onError={() => markLoaded(url)}
            />
          </Pressable>
        ))}
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: T.darkText94,
    fontSize: rpxToPx(29),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: rpxToPx(8),
  },
  list: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: rpxToPx(37),
  },
  option: {
    width: rpxToPx(118),
    height: rpxToPx(118),
    marginLeft: rpxToPx(8),
    marginRight: rpxToPx(8),
    borderRadius: rpxToPx(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: {
    width: rpxToPx(110),
    height: rpxToPx(110),
    borderRadius: rpxToPx(20),
  },
  imgLoading: {
    opacity: 0.55,
  },
});

export default CoverPickerPanel;
