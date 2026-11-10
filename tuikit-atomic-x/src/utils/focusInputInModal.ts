import { Keyboard, Platform } from 'react-native';

const RETRY_INTERVAL_MS = 100;
const MAX_ATTEMPTS = 6;

// On Android a Modal's dialog window gains input focus slightly after onShow, so the first
// showSoftInput call is rejected (InputMethodManager: showSoftInput fail). Retry until the keyboard shows.
export function focusInputInModal(
  getInput: () => { focus: () => void } | null
): () => void {
  let shown = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const sub = Keyboard.addListener(event, () => {
    shown = true;
  });
  const cancel = () => {
    if (timer) clearTimeout(timer);
    sub.remove();
  };
  const tryFocus = () => {
    if (shown || attempts >= MAX_ATTEMPTS) {
      cancel();
      return;
    }
    attempts += 1;
    getInput()?.focus();
    timer = setTimeout(tryFocus, RETRY_INTERVAL_MS);
  };
  tryFocus();
  return cancel;
}
