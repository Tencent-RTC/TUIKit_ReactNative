import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../Common';
import type {
  KeyboardEvent,
  LayoutChangeEvent,
  TextInputSelectionChangeEvent,
} from 'react-native';
import {
  useBarrageState,
  useLiveAudienceState,
  useLiveListState,
  useLoginState,
} from '../../atomic-x';
import { emojiNameMap, emojiUrlMap } from '../../constants/emoji';
import { getEmojiUrl, transformEmojiNameToKey } from '../../utils';
import { Toast, focusInputInModal, rpxToPx } from '../Common';
import { useBarrageInputTranslation } from './locales';

export interface BarrageInputProps {
  liveID?: string;
  onShow?: () => void;
  onHide?: () => void;
  onShift?: (px: number) => void;
  onToast?: (message: string) => void;
}

const MAX_INPUT_LEN = 100;
const KEYBOARD_ESTIMATE_RATIO = 0.44;
const SWITCH_GUARD_MS = 300;
const EMOJI_KEY_REGEX = /\[TUIEmoji_[^\]]+\]/g;

const EMOJI_ITEMS = Object.keys(emojiUrlMap).map((key) => ({
  key,
  name: (emojiNameMap as Record<string, string>)[key] || key,
  src: getEmojiUrl(key) || '',
}));

const visibleLength = (text: string): number =>
  transformEmojiNameToKey(text).replace(EMOJI_KEY_REGEX, '_').length;

function FaceIcon() {
  return (
    <View style={iconStyles.face}>
      <View style={[iconStyles.eye, iconStyles.eyeLeft]} />
      <View style={[iconStyles.eye, iconStyles.eyeRight]} />
      <View style={iconStyles.mouth} />
    </View>
  );
}

function KeyboardIcon() {
  return (
    <View style={iconStyles.keyboard}>
      <View style={iconStyles.keyRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={iconStyles.key} />
        ))}
      </View>
      <View style={iconStyles.spaceBar} />
    </View>
  );
}

export function BarrageInput({
  liveID: liveIDProp,
  onShow,
  onHide,
  onShift,
  onToast,
}: BarrageInputProps) {
  const { t } = useBarrageInputTranslation();
  const { currentLive } = useLiveListState();
  const { loginUserInfo } = useLoginState();
  const liveID = liveIDProp || String(currentLive?.liveID || '');
  const { sendTextMessage } = useBarrageState(liveID);
  const { messageBannedUserList } = useLiveAudienceState(liveID);

  const [expanded, setExpanded] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [draft, setDraft] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [rootShrink, setRootShrink] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const lastKbHeightRef = useRef(0);
  const switchingUntilRef = useRef(0);
  const rootFullHeightRef = useRef(0);
  const expandedRef = useRef(false);
  const cancelFocusRef = useRef<(() => void) | null>(null);
  const showEmojiRef = useRef(false);
  expandedRef.current = expanded;
  showEmojiRef.current = showEmoji;

  const callbacksRef = useRef({ onShow, onHide, onShift, onToast });
  callbacksRef.current = { onShow, onHide, onShift, onToast };

  const myUserID = loginUserInfo?.userID;
  const isBanned = useMemo(
    () =>
      !!myUserID &&
      (messageBannedUserList || []).some((user) => user?.userID === myUserID),
    [messageBannedUserList, myUserID]
  );

  const emitShift = useCallback((px: number) => {
    callbacksRef.current.onShift?.(Math.max(0, Math.round(px || 0)));
  }, []);

  const showToast = useCallback((message: string) => {
    if (callbacksRef.current.onToast) {
      callbacksRef.current.onToast(message);
    } else {
      setToastMessage(message);
    }
  }, []);

  const collapse = useCallback(() => {
    if (!expandedRef.current) {
      return;
    }
    expandedRef.current = false;
    showEmojiRef.current = false;
    Keyboard.dismiss();
    setExpanded(false);
    setShowEmoji(false);
    setKeyboardHeight(0);
    emitShift(0);
    callbacksRef.current.onHide?.();
  }, [emitShift]);

  const expand = useCallback(() => {
    if (isBanned || expandedRef.current) {
      return;
    }
    expandedRef.current = true;
    setExpanded(true);
    setShowEmoji(false);
    callbacksRef.current.onShow?.();
  }, [isBanned]);

  useEffect(() => {
    if (isBanned) {
      collapse();
    }
  }, [isBanned, collapse]);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      const height = Math.round(e.endCoordinates.height);
      if (height <= 0) {
        return;
      }
      lastKbHeightRef.current = height;
      setKeyboardHeight(height);
      emitShift(height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      if (showEmojiRef.current || Date.now() < switchingUntilRef.current) {
        return;
      }
      collapse();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [expanded, collapse, emitShift]);

  useEffect(
    () => () => {
      Keyboard.dismiss();
      if (expandedRef.current) {
        callbacksRef.current.onHide?.();
        callbacksRef.current.onShift?.(0);
      }
    },
    []
  );

  const panelHeight =
    lastKbHeightRef.current ||
    Math.round(Dimensions.get('screen').height * KEYBOARD_ESTIMATE_RATIO);

  const slotHeight = showEmoji
    ? panelHeight
    : Math.max(0, keyboardHeight - rootShrink);

  const handleRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > rootFullHeightRef.current) {
      rootFullHeightRef.current = height;
    }
    setRootShrink(Math.max(0, rootFullHeightRef.current - height));
  }, []);

  const switchTo = useCallback(
    (target: 'panel' | 'kb') => {
      const wantPanel = target === 'panel';
      if (wantPanel === showEmojiRef.current) {
        return;
      }
      switchingUntilRef.current = Date.now() + SWITCH_GUARD_MS;
      showEmojiRef.current = wantPanel;
      setShowEmoji(wantPanel);
      if (wantPanel) {
        emitShift(panelHeight);
        Keyboard.dismiss();
      } else {
        emitShift(lastKbHeightRef.current || panelHeight);
        inputRef.current?.focus();
      }
    },
    [emitShift, panelHeight]
  );

  const handleChangeText = useCallback(
    (text: string) => {
      if (visibleLength(text) > MAX_INPUT_LEN && text.length > draft.length) {
        showToast(t('lengthLimit'));
        return;
      }
      setDraft(text);
    },
    [draft.length, showToast, t]
  );

  const handleSelectionChange = useCallback(
    (e: TextInputSelectionChangeEvent) => {
      selectionRef.current = e.nativeEvent.selection;
    },
    []
  );

  const insertEmoji = useCallback(
    (name: string) => {
      if (visibleLength(draft) + 1 > MAX_INPUT_LEN) {
        showToast(t('lengthLimit'));
        return;
      }
      const { start, end } = selectionRef.current;
      const from = Math.min(start, draft.length);
      const to = Math.min(end, draft.length);
      const next = draft.slice(0, from) + name + draft.slice(to);
      const cursor = from + name.length;
      selectionRef.current = { start: cursor, end: cursor };
      setDraft(next);
    },
    [draft, showToast, t]
  );

  const handleSend = useCallback(() => {
    const text = draft.replace(/\n+$/, '');
    if (!text.trim() || isBanned) {
      return;
    }
    if (visibleLength(text) > MAX_INPUT_LEN) {
      showToast(t('lengthLimit'));
      return;
    }
    sendTextMessage({
      liveID,
      text: transformEmojiNameToKey(text),
      onError: (error) => {
        console.error('[BarrageInput] sendTextMessage failed:', error);
      },
    });
    setDraft('');
    selectionRef.current = { start: 0, end: 0 };
    collapse();
  }, [draft, isBanned, liveID, sendTextMessage, collapse, showToast, t]);

  const handleMaskPress = useCallback(() => {
    if (showEmojiRef.current) {
      collapse();
      return;
    }
    Keyboard.dismiss();
    setTimeout(() => {
      if (expandedRef.current && !showEmojiRef.current) {
        collapse();
      }
    }, 400);
  }, [collapse]);

  const hasContent = draft.trim().length > 0;

  return (
    <>
      <Pressable style={styles.entry} onPress={expand}>
        <Text style={styles.entryPlaceholder} numberOfLines={1}>
          {isBanned ? t('bannedPlaceholder') : t('placeholder')}
        </Text>
      </Pressable>
      <Modal
        visible={expanded}
        transparent
        animationType="none"
        statusBarTranslucent
        onShow={() => {
          cancelFocusRef.current?.();
          cancelFocusRef.current = focusInputInModal(() => inputRef.current);
        }}
        onRequestClose={collapse}
      >
        <View style={styles.root} onLayout={handleRootLayout}>
          <Pressable style={styles.mask} onPress={handleMaskPress} />
          <View style={styles.bar}>
            <TextInput
              ref={inputRef}
              style={styles.editor}
              value={draft}
              onChangeText={handleChangeText}
              onSelectionChange={handleSelectionChange}
              onFocus={() => {
                if (showEmojiRef.current) {
                  switchTo('kb');
                }
              }}
              placeholder={t('placeholder')}
              placeholderTextColor="rgba(0, 0, 0, 0.35)"
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
            />
            <Pressable
              style={styles.toggle}
              onPress={() => switchTo(showEmoji ? 'kb' : 'panel')}
            >
              {showEmoji ? <KeyboardIcon /> : <FaceIcon />}
            </Pressable>
            <Pressable
              style={[styles.send, hasContent && styles.sendActive]}
              onPress={handleSend}
            >
              <Text
                style={[styles.sendText, hasContent && styles.sendTextActive]}
              >
                {t('send')}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.slot, { height: slotHeight }]}>
            {showEmoji ? (
              <ScrollView contentContainerStyle={styles.grid}>
                {EMOJI_ITEMS.map((item) => (
                  <Pressable
                    key={item.key}
                    style={styles.cell}
                    onPress={() => insertEmoji(item.name)}
                  >
                    <Image
                      style={styles.cellImage}
                      source={{ uri: item.src }}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
          <Toast
            visible={!!toastMessage}
            message={toastMessage}
            position="top"
            onClose={() => setToastMessage('')}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  entry: {
    width: rpxToPx(300),
    height: rpxToPx(72),
    borderRadius: rpxToPx(36),
    backgroundColor: 'rgba(20, 20, 22, 0.54)',
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.055)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rpxToPx(34),
    overflow: 'hidden',
  },
  entryPlaceholder: {
    fontSize: rpxToPx(26),
    color: 'rgba(235, 235, 245, 0.45)',
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f7f8fa',
  },
  editor: {
    flex: 1,
    minHeight: 40,
    maxHeight: 48,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: '#111111',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'center',
  },
  toggle: {
    width: 34,
    height: 34,
    marginLeft: 8,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  send: {
    height: 34,
    marginLeft: 8,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  sendActive: {
    backgroundColor: '#0468FC',
  },
  sendText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },
  sendTextActive: {
    color: '#ffffff',
  },
  slot: {
    overflow: 'hidden',
    backgroundColor: '#f7f8fa',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cell: {
    width: '12.5%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellImage: {
    width: 30,
    height: 30,
  },
});

const ICON_COLOR = '#333333';

const iconStyles = StyleSheet.create({
  face: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: ICON_COLOR,
  },
  eye: {
    position: 'absolute',
    top: 4,
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: ICON_COLOR,
  },
  eyeLeft: {
    left: 3,
  },
  eyeRight: {
    right: 3,
  },
  mouth: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    width: 8,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: ICON_COLOR,
  },
  keyboard: {
    width: 20,
    height: 12,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: ICON_COLOR,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  keyRow: {
    flexDirection: 'row',
    width: 12,
    justifyContent: 'space-between',
  },
  key: {
    width: 2,
    height: 2,
    backgroundColor: ICON_COLOR,
  },
  spaceBar: {
    width: 8,
    height: 2,
    backgroundColor: ICON_COLOR,
  },
});
