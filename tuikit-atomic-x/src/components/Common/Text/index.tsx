import { forwardRef, type ComponentRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

// MIUI's default font (MiLanPro) measures bold glyphs narrower than it draws them, so the last
// characters get ellipsized even when there is room. Pin the system font on Android.
const platformFont = StyleSheet.create({
  text: Platform.OS === 'android' ? { fontFamily: 'sans-serif' } : {},
});

export const Text = forwardRef<ComponentRef<typeof RNText>, TextProps>(
  function Text({ style, ...props }, ref) {
    return <RNText ref={ref} {...props} style={[platformFont.text, style]} />;
  }
);

export const AnimatedText = Animated.createAnimatedComponent(Text);

export const TextInput = forwardRef<
  ComponentRef<typeof RNTextInput>,
  TextInputProps
>(function TextInput({ style, ...props }, ref) {
  return (
    <RNTextInput ref={ref} {...props} style={[platformFont.text, style]} />
  );
});

export type { TextInputProps, TextProps };
