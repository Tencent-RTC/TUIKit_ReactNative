import { useCallback, useState, type RefObject } from 'react';
import type { GiftParam } from '../../atomic-x';
import type { GiftPlayerRef } from './GiftPlayer';

export interface GiftUserInfo {
  userID?: string;
  userName?: string;
  avatarURL?: string;
  [key: string]: unknown;
}

export interface ReceivedGiftData {
  gift?: Partial<GiftParam>;
  sender?: GiftUserInfo;
  count?: number;
  [key: string]: unknown;
}

export interface ShowGiftOptions {
  onlyDisplay?: boolean;
  isFromSelf?: boolean;
  count?: number;
}

export interface GiftServiceParams {
  giftPlayerRef: RefObject<GiftPlayerRef | null>;
}

export function useGiftService({ giftPlayerRef }: GiftServiceParams) {
  const [isGiftPlaying, setIsGiftPlaying] = useState(false);

  const showGift = useCallback(
    (
      giftData: ReceivedGiftData | null | undefined,
      options?: ShowGiftOptions
    ) => {
      const gift = giftData?.gift;
      if (!gift?.resourceURL) return;
      setIsGiftPlaying(true);
      giftPlayerRef.current?.playGift(gift, !!options?.isFromSelf);
    },
    [giftPlayerRef]
  );

  const onGiftFinished = useCallback(() => {
    setIsGiftPlaying(false);
  }, []);

  return { showGift, onGiftFinished, isGiftPlaying };
}
