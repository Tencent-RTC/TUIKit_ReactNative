import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../Common';
import * as RNLocalize from 'react-native-localize';
import {
  useGiftState,
  useLiveListState,
  type GiftCategoryParam,
  type GiftParam,
} from '../../atomic-x';
import { heightPercentToRpx } from '../../utils';
import { Drawer, rpxToPx } from '../Common';
import {
  COMBO_EXPIRE_DELAY,
  ComboButton,
  isAdvancedGift,
  useComboHold,
  useComboSender,
} from './FloatingGiftCombo';
import type { GiftSentPayload } from './FloatingGiftCombo';
import { useGiftTranslation } from './locales';

const DRAWER_BG = require('../../static/assets/live/drawer-bg.png');
const GIFT_SEND_BG = require('../../static/assets/live/gift-send.png');

export interface GiftPickerProps {
  visible?: boolean;
  onClose?: () => void;
  onGiftSent?: (payload: GiftSentPayload) => void;
  onAdvancedComboStart?: (payload: GiftSentPayload) => void;
}

function resolveSdkLanguage(): string {
  const locale = RNLocalize.getLocales()[0];
  const tag = locale?.languageTag || '';
  if (locale?.languageCode === 'en') return 'en';
  if (/^zh[-_](Hant|TW)/i.test(tag)) return 'zh-Hant';
  return 'zh-Hans';
}

export const GiftPicker = memo(function GiftPicker({
  visible = false,
  onClose,
  onGiftSent,
  onAdvancedComboStart,
}: GiftPickerProps) {
  const { t } = useGiftTranslation();
  const { currentLive } = useLiveListState();
  const liveID = String(currentLive?.liveID || '');
  const { usableGifts, sendGift, refreshUsableGifts, setLanguage } =
    useGiftState(liveID);
  const { enqueueSend, flushPendingSend } = useComboSender(liveID, sendGift);

  const drawerHeight = useMemo(() => heightPercentToRpx(0.5), []);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [comboIndex, setComboIndex] = useState(-1);
  const [comboCount, setComboCount] = useState(0);
  const [cycle, setCycle] = useState(0);
  const combo = useRef({ index: -1, giftID: '', count: 0 });
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ onClose, onGiftSent, onAdvancedComboStart });
  latest.current = { onClose, onGiftSent, onAdvancedComboStart };

  const giftLists: GiftCategoryParam[] = useMemo(
    () => (Array.isArray(usableGifts) ? usableGifts : []),
    [usableGifts]
  );
  const currentGifts: GiftParam[] = useMemo(() => {
    const list = giftLists[categoryIndex]?.giftList;
    return Array.isArray(list) ? list : [];
  }, [giftLists, categoryIndex]);
  const giftsRef = useRef(currentGifts);
  giftsRef.current = currentGifts;

  const stopComboRef = useRef<() => void>(() => {});

  const restartComboTimer = useCallback(() => {
    if (expireTimer.current) clearTimeout(expireTimer.current);
    setCycle((c) => c + 1);
    expireTimer.current = setTimeout(() => {
      if (combo.current.index >= 0) stopComboRef.current();
    }, COMBO_EXPIRE_DELAY);
  }, []);

  const doSend = useCallback(
    (index: number) => {
      const gift = giftsRef.current[index];
      if (!gift) return false;
      const isSameCombo =
        combo.current.giftID === gift.giftID && combo.current.index === index;

      if (isAdvancedGift(gift) && !isSameCombo) {
        flushPendingSend();
        stopComboRef.current();
        enqueueSend(gift);
        latest.current.onGiftSent?.({ gift, count: 1 });
        latest.current.onAdvancedComboStart?.({ gift, count: 1 });
        return true;
      }

      if (isSameCombo) {
        combo.current.count += 1;
      } else {
        flushPendingSend();
        combo.current = { index, giftID: gift.giftID, count: 1 };
        setComboIndex(index);
      }
      setComboCount(combo.current.count);
      restartComboTimer();
      enqueueSend(gift);
      latest.current.onGiftSent?.({ gift, count: combo.current.count });
      return true;
    },
    [enqueueSend, flushPendingSend, restartComboTimer]
  );

  const hold = useComboHold(
    useCallback(
      () => combo.current.index >= 0 && doSend(combo.current.index),
      [doSend]
    )
  );
  const resetHold = hold.reset;

  const stopCombo = useCallback(() => {
    flushPendingSend();
    resetHold();
    if (expireTimer.current) clearTimeout(expireTimer.current);
    expireTimer.current = null;
    combo.current = { index: -1, giftID: '', count: 0 };
    setComboCount(0);
    setComboIndex(-1);
  }, [flushPendingSend, resetHold]);
  stopComboRef.current = stopCombo;

  const switchCategory = useCallback(
    (index: number) => {
      if (index === categoryIndex) return;
      stopCombo();
      setCategoryIndex(index);
      setSelectedIndex(-1);
    },
    [categoryIndex, stopCombo]
  );

  const onGiftTap = useCallback(
    (index: number) => {
      if (selectedIndex === index) {
        doSend(index);
        return;
      }
      stopCombo();
      setSelectedIndex(index);
    },
    [doSend, selectedIndex, stopCombo]
  );

  useEffect(() => {
    if (!visible) stopCombo();
  }, [visible, stopCombo]);

  const initedLiveID = useRef('');
  useEffect(() => {
    if (!liveID || initedLiveID.current === liveID) return;
    initedLiveID.current = liveID;
    setLanguage({ liveID, language: resolveSdkLanguage() });
    refreshUsableGifts({ liveID });
  }, [liveID, setLanguage, refreshUsableGifts]);

  useEffect(
    () => () => {
      if (expireTimer.current) clearTimeout(expireTimer.current);
      flushPendingSend();
    },
    [flushPendingSend]
  );

  const handleClose = useCallback(() => {
    stopCombo();
    latest.current.onClose?.();
  }, [stopCombo]);

  return (
    <Drawer
      visible={visible}
      onClose={handleClose}
      height={drawerHeight}
      overlayOpacity={0.4}
      bgImage={DRAWER_BG}
      bgImageHeight={drawerHeight}
      showHandle
      padding="0"
    >
      <Text style={styles.title}>{t('pickerTitle')}</Text>

      <View style={styles.tabs}>
        {giftLists.map((category, index) => {
          const active = categoryIndex === index;
          return (
            <Pressable
              key={category.categoryID ?? String(index)}
              style={styles.tab}
              onPress={() => switchCategory(index)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {category.name}
              </Text>
              {active && <View style={styles.tabUnderline} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.scrollShell}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        >
          {currentGifts.map((gift, index) =>
            comboIndex === index ? (
              <View key={gift.giftID} style={[styles.item, styles.itemCombo]}>
                <ComboButton
                  variant="grid"
                  count={comboCount}
                  cycle={cycle}
                  pressing={hold.pressing}
                  onPressIn={hold.onPressIn}
                  onPressOut={hold.onPressOut}
                />
              </View>
            ) : (
              <GiftCell
                key={gift.giftID}
                gift={gift}
                index={index}
                selected={selectedIndex === index}
                sendLabel={t('send')}
                onTap={onGiftTap}
                onSend={doSend}
              />
            )
          )}
          <View style={styles.gridBottomSpace} />
        </ScrollView>
        <View pointerEvents="none" style={styles.scrollFade} />
      </View>
    </Drawer>
  );
});

interface GiftCellProps {
  gift: GiftParam;
  index: number;
  selected: boolean;
  sendLabel: string;
  onTap: (index: number) => void;
  onSend: (index: number) => boolean;
}

const GiftCell = memo(function GiftCell({
  gift,
  index,
  selected,
  sendLabel,
  onTap,
  onSend,
}: GiftCellProps) {
  const scale = useRef(new Animated.Value(selected ? 1.2 : 1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: selected ? 1.2 : 1,
      duration: 180,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <View style={[styles.item, selected && styles.itemSelected]}>
      <Pressable style={styles.select} onPress={() => onTap(index)}>
        <View style={styles.imageWrap}>
          {!!gift.iconURL && (
            <Animated.Image
              source={{ uri: gift.iconURL }}
              resizeMode="contain"
              style={[styles.image, { transform: [{ scale }] }]}
            />
          )}
        </View>
        {!selected && (
          <Text style={styles.name} numberOfLines={1}>
            {gift.name || ''}
          </Text>
        )}
        <View style={[styles.price, selected && styles.priceSelected]}>
          <View style={styles.priceCoin} />
          <Text
            style={[styles.priceValue, selected && styles.priceValueSelected]}
          >
            {gift.coins}
          </Text>
        </View>
        {selected && (
          <Pressable style={styles.send} onPress={() => onSend(index)}>
            <Image
              source={GIFT_SEND_BG}
              resizeMode="stretch"
              style={styles.sendBg}
            />
            <Text style={styles.sendText}>{sendLabel}</Text>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
});

const FULL_WIDTH = rpxToPx(750);
const ITEM_WIDTH = rpxToPx(179);
const ITEM_HEIGHT = rpxToPx(208);
const COIN_COLOR = '#ffc32e';
const COIN_BORDER = 'rgba(255, 218, 86, 0.9)';

const styles = StyleSheet.create({
  title: {
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: rpxToPx(32),
    fontWeight: '700',
    lineHeight: rpxToPx(44),
    textAlign: 'center',
    marginBottom: rpxToPx(10),
  },
  tabs: {
    width: FULL_WIDTH,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: rpxToPx(28),
    height: rpxToPx(64),
  },
  tab: {
    marginRight: rpxToPx(48),
    height: rpxToPx(56),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: rpxToPx(28),
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: rpxToPx(56),
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: rpxToPx(12),
    right: rpxToPx(12),
    height: rpxToPx(4),
    borderRadius: rpxToPx(2),
    experimental_backgroundImage: 'linear-gradient(to right, #4A9EFF, #0052D9)',
  },
  scrollShell: {
    flex: 1,
    position: 'relative',
    width: FULL_WIDTH,
  },
  scroll: {
    flex: 1,
    width: FULL_WIDTH,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: rpxToPx(16),
  },
  item: {
    position: 'relative',
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: rpxToPx(28),
    borderWidth: rpxToPx(2),
    borderColor: 'transparent',
  },
  itemSelected: {
    borderColor: '#4A9EFF',
    backgroundColor: 'rgba(74, 158, 255, 0.15)',
  },
  itemCombo: {
    borderWidth: 0,
    zIndex: 1,
  },
  select: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: rpxToPx(8),
    position: 'relative',
  },
  imageWrap: {
    width: rpxToPx(108),
    height: rpxToPx(108),
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: rpxToPx(88),
    height: rpxToPx(88),
  },
  name: {
    width: rpxToPx(160),
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: rpxToPx(24),
    fontWeight: '600',
    lineHeight: rpxToPx(34),
    textAlign: 'center',
  },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: rpxToPx(34),
    marginTop: rpxToPx(2),
  },
  priceSelected: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: rpxToPx(60),
  },
  priceCoin: {
    width: rpxToPx(16),
    height: rpxToPx(16),
    borderRadius: rpxToPx(8),
    backgroundColor: COIN_COLOR,
    borderWidth: rpxToPx(2),
    borderColor: COIN_BORDER,
    marginRight: rpxToPx(6),
  },
  priceValue: {
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: rpxToPx(20),
    lineHeight: rpxToPx(34),
  },
  priceValueSelected: {
    color: 'rgba(255, 255, 255, 0.94)',
    fontWeight: '700',
  },
  send: {
    position: 'absolute',
    left: rpxToPx(-12),
    bottom: rpxToPx(-20),
    width: rpxToPx(203),
    height: rpxToPx(100),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: rpxToPx(203),
    height: rpxToPx(100),
  },
  sendText: {
    color: '#ffffff',
    fontSize: rpxToPx(20),
    fontWeight: '700',
    lineHeight: rpxToPx(44),
    textAlign: 'center',
  },
  gridBottomSpace: {
    width: FULL_WIDTH,
    height: rpxToPx(40),
  },
  scrollFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: rpxToPx(96),
    experimental_backgroundImage:
      'linear-gradient(to top, rgba(10, 9, 14, 0.9), rgba(10, 9, 14, 0))',
  },
});

export default GiftPicker;
