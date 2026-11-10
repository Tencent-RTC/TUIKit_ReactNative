import type { ImageSourcePropType } from 'react-native';

export type LevelTier = 'basic' | 'advanced' | 'premium' | 'elite';

const LEVEL_BADGE_IMAGES: Record<LevelTier, ImageSourcePropType> = {
  basic: require('../../static/assets/live/level-badge-basic.png'),
  advanced: require('../../static/assets/live/level-badge-advanced.png'),
  premium: require('../../static/assets/live/level-badge-premium.png'),
  elite: require('../../static/assets/live/level-badge-elite.png'),
};

export const levelTier = (level: number): LevelTier => {
  if (level >= 40) return 'elite';
  if (level >= 25) return 'premium';
  if (level >= 10) return 'advanced';
  return 'basic';
};

interface LevelMessage {
  sender?: { userID?: string; level?: number | string };
}

export const resolveMsgLevel = (
  message: LevelMessage | null | undefined,
  myUserID: string | null | undefined,
  myLevel: number
): number => {
  const level = Number(message?.sender?.level);
  if (!isNaN(level) && level > 0) return level;
  if (message?.sender?.userID && message.sender.userID === myUserID) {
    if (!isNaN(myLevel) && myLevel > 0) return myLevel;
  }
  return 0;
};

export const levelBadgeSource = (level: number): ImageSourcePropType =>
  LEVEL_BADGE_IMAGES[levelTier(level)];
