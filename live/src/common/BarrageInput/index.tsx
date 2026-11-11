import React, { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Text, TextInput, getLiveErrorMessage, useBarrageState } from '@tencentcloud/react-native-tuikit-atomic-x';

import { useLiveTranslation } from '../../locales';
import { LIVE_STYLE_TOKENS as T } from '../../styles/tokens';
import { errorCodeOf, rpxToPx } from '../../utils';

export interface BarrageInputProps {
  visible: boolean;
  onClose: () => void;
  liveID: string;
  onTip?: (title: string) => void;
}

const KEYBOARD_GAP_PX = 12;
const BLUR_CLOSE_DELAY_MS = 200;
const MAX_LENGTH = 120;
const FOCUS_RETRY_DELAYS_MS = [0, 120, 300];
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

export const BarrageInput = memo(function BarrageInput({ visible, onClose, liveID, onTip }: BarrageInputProps) {
  const { t } = useLiveTranslation();
  const { sendTextMessage } = useBarrageState(liveID);
  const [draft, setDraft] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [focused, setFocused] = useState(false);
  const [rootShrink, setRootShrink] = useState(0);
  const rootFullHeightRef = useRef(0);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const keyboardShownRef = useRef(false);
  const refocusingRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutFocusedRef = useRef(false);

  const clearBlurTimer = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = null;
  };

  const clearFocusTimers = () => {
    focusTimersRef.current.forEach(clearTimeout);
    focusTimersRef.current = [];
  };

  const close = useCallback(() => {
    clearBlurTimer();
    clearFocusTimers();
    inputRef.current?.blur();
    Keyboard.dismiss();
    setKeyboardHeight(0);
    setFocused(false);
    onClose();
  }, [onClose]);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!visible) return undefined;
    layoutFocusedRef.current = false;
    keyboardShownRef.current = false;
    setDraft('');
    const showSub = Keyboard.addListener(SHOW_EVENT, (e: KeyboardEvent) => {
      const height = Math.round(e.endCoordinates.height);
      if (height > 0) {
        keyboardShownRef.current = true;
        setKeyboardHeight(height);
      }
    });
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current();
      return true;
    });
    return () => {
      showSub.remove();
      backSub.remove();
      clearFocusTimers();
      clearBlurTimer();
    };
  }, [visible]);

  const handleBlur = () => {
    if (refocusingRef.current) return;
    setFocused(false);
    clearBlurTimer();
    blurTimerRef.current = setTimeout(() => closeRef.current(), BLUR_CLOSE_DELAY_MS);
  };

  // The first focus() can land before the native EditText is mounted: focus is gained but
  // showSoftInput fails, and RN then ignores further focus() because the input already counts as
  // focused. Retry like uniapp, blurring first so each attempt really asks the keyboard to show.
  const handleInputLayout = () => {
    if (layoutFocusedRef.current) return;
    layoutFocusedRef.current = true;
    clearFocusTimers();
    focusTimersRef.current = FOCUS_RETRY_DELAYS_MS.map((delay, index) =>
      setTimeout(() => {
        const input = inputRef.current;
        if (!input || keyboardShownRef.current) return;
        if (index > 0) {
          refocusingRef.current = true;
          input.blur();
        }
        input.focus();
        refocusingRef.current = false;
      }, delay),
    );
  };

  const handleFocus = () => {
    setFocused(true);
    clearBlurTimer();
  };

  const handleRootLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > rootFullHeightRef.current) rootFullHeightRef.current = height;
    setRootShrink(Math.max(0, rootFullHeightRef.current - height));
  };

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    sendTextMessage({
      liveID,
      text: content,
      onSuccess: () => {
        setDraft('');
        close();
      },
      onError: (error) => {
        console.error('[BarrageInput] sendTextMessage failed:', error);
        onTip?.(`${t('morePanel.commentSendFailed')}: ${getLiveErrorMessage(errorCodeOf(error))}`);
      },
    });
  };

  if (!visible) return null;

  const ready = focused || keyboardHeight > 0;
  const lift = Math.max(0, keyboardHeight - rootShrink) + KEYBOARD_GAP_PX;

  return (
    <View style={styles.root} onLayout={handleRootLayout}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      {/* collapsable={false}: toggling opacity must not let Fabric flatten/recreate the bar, which
          detaches the focused EditText and blurs it. */}
      <View collapsable={false} style={[styles.bar, { bottom: lift, opacity: ready ? 1 : 0 }]}>
        <Pressable style={styles.cancel} onPress={close}>
          <Text style={styles.cancelText}>×</Text>
        </Pressable>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_LENGTH}
          placeholder={t('morePanel.commentPlaceholder')}
          placeholderTextColor={T.darkText40}
          selectionColor={T.darkTextPrimary}
          returnKeyType="send"
          onSubmitEditing={submit}
          submitBehavior="submit"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onLayout={handleInputLayout}
        />
        <Pressable style={styles.send} onPress={submit}>
          <Text style={styles.sendText}>{t('morePanel.send')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  bar: {
    position: 'absolute',
    left: rpxToPx(24),
    right: rpxToPx(24),
    height: rpxToPx(72),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rpxToPx(12),
    borderWidth: rpxToPx(1),
    borderColor: T.darkBorder08,
    borderRadius: rpxToPx(36),
    backgroundColor: T.darkBgInput,
  },
  cancel: {
    width: rpxToPx(48),
    height: rpxToPx(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: T.darkText58,
    fontSize: rpxToPx(40),
    lineHeight: rpxToPx(44),
  },
  input: {
    flex: 1,
    height: rpxToPx(68),
    color: T.darkTextPrimary,
    fontSize: rpxToPx(26),
    fontWeight: '600',
    paddingHorizontal: rpxToPx(8),
    paddingVertical: 0,
  },
  send: {
    height: rpxToPx(56),
    paddingHorizontal: rpxToPx(28),
    borderRadius: rpxToPx(28),
    backgroundColor: T.colorBrandLight,
    experimental_backgroundImage: `linear-gradient(135deg, ${T.colorBrandLight}, ${T.colorBrandDeep})`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: {
    color: T.darkTextPrimary,
    fontSize: rpxToPx(24),
    fontWeight: '600',
  },
});

export default BarrageInput;
