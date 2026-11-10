import React, { memo, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../locales';
import { styles } from './styles';

export type AudienceEntryUser = { userID: string; userName: string; level: number };

export interface AudienceEntryBannerProps {
  topPx: number;
}

export interface AudienceEntryBannerRef {
  push: (user: AudienceEntryUser) => void;
}

type LevelTier = 'basic' | 'advanced' | 'premium' | 'elite';

const HOLD_MS = 1500;
const EXIT_MS = 240;
const ENTER_MS = 400;
const QUEUE_MAX = 10;
const QUEUE_TRIM_KEEP = 2;

const INITIAL_TRANSLATE_X = -400;
const ENTER_TRANSLATE_X = 12;
const EXIT_TRANSLATE_X = -18;

const BADGE_GRADIENT: Record<LevelTier, number> = {
  basic: require('../../static/images/live/badge/badge-gradient-basic.png'),
  advanced: require('../../static/images/live/badge/badge-gradient-advanced.png'),
  premium: require('../../static/images/live/badge/badge-gradient-premium.png'),
  elite: require('../../static/images/live/badge/badge-gradient-elite.png'),
};
const BADGE_ICON: Record<LevelTier, number> = {
  basic: require('../../static/images/live/badge/badge-icon-basic.png'),
  advanced: require('../../static/images/live/badge/badge-icon-advanced.png'),
  premium: require('../../static/images/live/badge/badge-icon-premium.png'),
  elite: require('../../static/images/live/badge/badge-icon-elite.png'),
};
const TIP_BG_PREMIUM = require('../../static/images/live/badge/tip-bg-premium.png');
const TIP_BG_ELITE = require('../../static/images/live/badge/tip-bg-elite.png');

const levelTier = (level: number): LevelTier => {
  if (level >= 40) return 'elite';
  if (level >= 25) return 'premium';
  if (level >= 10) return 'advanced';
  return 'basic';
};

const LEVEL_NUM_STYLE = {
  basic: styles.levelNumBasic,
  advanced: styles.levelNumAdvanced,
  premium: styles.levelNumPremium,
  elite: styles.levelNumElite,
} as const;

export const AudienceEntryBanner = memo(forwardRef<AudienceEntryBannerRef, AudienceEntryBannerProps>(
  function AudienceEntryBanner({ topPx }, ref) {
    const { t } = useLiveTranslation();
    const [currentEntry, setCurrentEntry] = useState<AudienceEntryUser | null>(null);

    const translateX = useRef(new Animated.Value(INITIAL_TRANSLATE_X)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    const queueRef = useRef<AudienceEntryUser[]>([]);
    const processingRef = useRef(false);
    const currentEntryIDRef = useRef('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const sleep = (ms: number) =>
      new Promise<void>(resolve => {
        timerRef.current = setTimeout(resolve, ms);
      });

    const playEnter = () => {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: ENTER_TRANSLATE_X,
          duration: ENTER_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ENTER_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    };

    const playExit = () => {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: EXIT_TRANSLATE_X,
          duration: EXIT_MS,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_MS,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    };

    const processQueue = useCallback(async () => {
      if (processingRef.current || queueRef.current.length === 0) return;
      processingRef.current = true;
      try {
        while (queueRef.current.length > 0 && mountedRef.current) {
          const entry = queueRef.current.shift() as AudienceEntryUser;
          translateX.setValue(INITIAL_TRANSLATE_X);
          opacity.setValue(0);
          currentEntryIDRef.current = entry.userID;
          setCurrentEntry(entry);
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          if (!mountedRef.current) return;
          playEnter();
          await sleep(HOLD_MS);
          if (!mountedRef.current) return;
          playExit();
          await sleep(EXIT_MS);
          if (!mountedRef.current) return;
          currentEntryIDRef.current = '';
          setCurrentEntry(null);
        }
      } finally {
        processingRef.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const push = useCallback(
      (user: AudienceEntryUser) => {
        if (!user?.userName) return;
        if (currentEntryIDRef.current === user.userID) return;
        if (queueRef.current.some(e => e.userID === user.userID)) return;
        queueRef.current.push(user);
        if (queueRef.current.length > QUEUE_MAX) {
          queueRef.current = queueRef.current.slice(-QUEUE_TRIM_KEEP);
        }
        processQueue();
      },
      [processQueue],
    );

    useImperativeHandle(ref, () => ({ push }), [push]);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        translateX.stopAnimation();
        opacity.stopAnimation();
      };
    }, [translateX, opacity]);

    if (!currentEntry) return null;

    const tier = levelTier(currentEntry.level || 0);
    const isPremium = tier === 'premium';
    const isElite = tier === 'elite';
    const entryBg = isPremium ? TIP_BG_PREMIUM : isElite ? TIP_BG_ELITE : null;

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.audienceEntry,
          isPremium && styles.audienceEntryPremium,
          isElite && styles.audienceEntryElite,
          { top: topPx, opacity, transform: [{ translateX }] },
        ]}
      >
        {entryBg && <Image style={styles.entryBg} source={entryBg} resizeMode="stretch" />}
        {currentEntry.level > 0 && (
          <View style={[styles.levelBadge, isPremium && styles.levelBadgePremium]}>
            <Image style={styles.badgeBg} source={BADGE_GRADIENT[tier]} resizeMode="stretch" />
            <Image style={styles.badgeIcon} source={BADGE_ICON[tier]} resizeMode="contain" />
            <Text style={[styles.levelNum, LEVEL_NUM_STYLE[tier]]}>{currentEntry.level}</Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>
          {currentEntry.userName}
        </Text>
        <Text style={[styles.action, isPremium && styles.actionPremium, isElite && styles.actionElite]}>
          {t('audience.enteredRoom')}
        </Text>
      </Animated.View>
    );
  },
));

export default AudienceEntryBanner;
