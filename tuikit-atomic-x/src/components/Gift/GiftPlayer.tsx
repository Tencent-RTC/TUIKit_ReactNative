import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import type { GiftParam } from '../../atomic-x';
import { rpxToPx } from '../Common';
import SVGAAnimationView, {
  type SVGAAnimationViewRef,
} from '../../native/SVGAAnimationView';

export type GiftPlayerGift = Pick<
  GiftParam,
  'giftID' | 'name' | 'resourceURL'
> &
  Partial<GiftParam>;

export interface GiftPlayerProps {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  url?: string;
  onFinished?: () => void;
}

export interface GiftPlayerRef {
  playGift: (gift: Partial<GiftPlayerGift>, isFromSelf?: boolean) => void;
}

interface QueuedGift {
  resourceURL: string;
  giftID: string;
  isFromSelf: boolean;
}

const PLAY_TIMEOUT_MS = 30000;
const RESET_DELAY = 100;
const START_DELAY = 200;
const START_RETRY_DELAY = 100;
const NEXT_GIFT_DELAY = 300;
const FINISH_DEBOUNCE = 50;
const PLAYER_SIZE = rpxToPx(750);

export const GiftPlayer = forwardRef<GiftPlayerRef, GiftPlayerProps>(
  function GiftPlayer({ visible, onVisibleChange, url, onFinished }, ref) {
    const playerRef = useRef<SVGAAnimationViewRef>(null);
    const [innerVisible, setInnerVisible] = useState(false);
    const shown = visible ?? innerVisible;

    const queue = useRef<QueuedGift[]>([]);
    const isPlaying = useRef(false);
    const current = useRef<QueuedGift | null>(null);
    const playSeq = useRef(0);
    const playTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    const destroyed = useRef(false);
    const latest = useRef({ shown, onVisibleChange, onFinished });
    latest.current = { shown, onVisibleChange, onFinished };

    const later = useCallback((fn: () => void, ms: number) => {
      if (destroyed.current) return null;
      const id = setTimeout(() => {
        timers.current.delete(id);
        if (!destroyed.current) fn();
      }, ms);
      timers.current.add(id);
      return id;
    }, []);

    const delay = useCallback(
      (ms: number) =>
        new Promise<void>((resolve) => {
          later(resolve, ms);
        }),
      [later]
    );

    const clearTimer = useCallback(
      (timer: { current: ReturnType<typeof setTimeout> | null }) => {
        if (timer.current != null) {
          clearTimeout(timer.current);
          timers.current.delete(timer.current);
          timer.current = null;
        }
      },
      []
    );

    const stopPlayer = useCallback(() => {
      if (destroyed.current) return;
      playerRef.current?.stopAnimation();
    }, []);

    const setShown = useCallback((value: boolean) => {
      setInnerVisible(value);
      latest.current.onVisibleChange?.(value);
    }, []);

    const preparePlayRef = useRef<() => void>(() => {});

    const onPlayFinished = useCallback(() => {
      clearTimer(playTimeout);
      stopPlayer();
      isPlaying.current = false;
      queue.current.shift();
      current.current = null;
      if (queue.current.length > 0) {
        later(() => {
          stopPlayer();
          if (!isPlaying.current) preparePlayRef.current();
        }, NEXT_GIFT_DELAY);
      } else {
        latest.current.onFinished?.();
        setShown(false);
      }
    }, [clearTimer, later, setShown, stopPlayer]);

    const schedulePlayTimeout = useCallback(() => {
      clearTimer(playTimeout);
      const seq = playSeq.current;
      playTimeout.current = later(() => {
        playTimeout.current = null;
        if (seq !== playSeq.current || !isPlaying.current) return;
        onPlayFinished();
      }, PLAY_TIMEOUT_MS);
    }, [clearTimer, later, onPlayFinished]);

    const tryStart = useCallback(
      (playUrl: string) => {
        if (destroyed.current || !playUrl || !playerRef.current) return;
        playerRef.current.startAnimation(playUrl);
        schedulePlayTimeout();
      },
      [schedulePlayTimeout]
    );

    const preparePlay = useCallback(async () => {
      if (queue.current.length === 0) {
        isPlaying.current = false;
        return;
      }
      if (isPlaying.current) return;
      stopPlayer();
      await delay(RESET_DELAY);
      stopPlayer();
      if (isPlaying.current || destroyed.current) return;
      const gift = queue.current[0];
      if (!gift) return;
      isPlaying.current = true;
      playSeq.current += 1;
      schedulePlayTimeout();
      current.current = gift;
      setShown(true);
      const isCurrent = () =>
        isPlaying.current &&
        current.current === gift &&
        !!playerRef.current &&
        latest.current.shown;
      later(() => {
        if (isCurrent()) {
          tryStart(gift.resourceURL);
          return;
        }
        later(() => {
          if (isCurrent()) tryStart(gift.resourceURL);
        }, START_RETRY_DELAY);
      }, START_DELAY);
    }, [delay, later, schedulePlayTimeout, setShown, stopPlayer, tryStart]);
    preparePlayRef.current = preparePlay;

    const playGift = useCallback(
      (gift: Partial<GiftPlayerGift>, isFromSelf = false) => {
        if (!gift || !gift.resourceURL) return;
        const item: QueuedGift = {
          resourceURL: String(gift.resourceURL),
          giftID: String(gift.giftID ?? ''),
          isFromSelf,
        };
        const list = queue.current;
        if (isFromSelf && list.some((g) => !g.isFromSelf)) {
          let insertIndex = 0;
          for (let i = list.length - 1; i >= 0; i--) {
            if (list[i]?.isFromSelf) {
              insertIndex = i + 1;
              break;
            }
          }
          list.splice(insertIndex, 0, item);
        } else {
          list.push(item);
        }
        if (list.length === 1 && !isPlaying.current) {
          preparePlay();
        }
      },
      [preparePlay]
    );

    useImperativeHandle(ref, () => ({ playGift }), [playGift]);

    const handleFinished = useCallback(() => {
      if (finishTimer.current != null) return;
      finishTimer.current = later(() => {
        finishTimer.current = null;
        onPlayFinished();
      }, FINISH_DEBOUNCE);
    }, [later, onPlayFinished]);

    useEffect(() => {
      if (!url || isPlaying.current || !shown) return;
      tryStart(url);
    }, [url, shown, tryStart]);

    useEffect(() => {
      let lastState = AppState.currentState;
      const subscription = AppState.addEventListener('change', (next) => {
        const wasActive = lastState === 'active';
        lastState = next;
        if (wasActive === (next === 'active')) return;
        timers.current.forEach((id) => clearTimeout(id));
        timers.current.clear();
        playTimeout.current = null;
        finishTimer.current = null;
        playSeq.current += 1;
        stopPlayer();
        queue.current = [];
        isPlaying.current = false;
        current.current = null;
        latest.current.onFinished?.();
        setShown(false);
      });
      return () => subscription.remove();
    }, [setShown, stopPlayer]);

    useEffect(() => {
      const pending = timers.current;
      const player = playerRef.current;
      return () => {
        pending.forEach((id) => clearTimeout(id));
        pending.clear();
        player?.stopAnimation();
        destroyed.current = true;
        queue.current = [];
        isPlaying.current = false;
        current.current = null;
      };
    }, []);

    return (
      <View pointerEvents="none" style={styles.container}>
        <SVGAAnimationView
          ref={playerRef}
          style={shown ? styles.playerShown : styles.playerHidden}
          onFinished={handleFinished}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5000,
    elevation: 5000,
  },
  playerShown: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
  },
  playerHidden: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
});

export default GiftPlayer;
