import React, { memo, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text } from '@tencentcloud/react-native-tuikit-atomic-x';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLiveTranslation } from '../../locales';
import { styles } from './styles';

export interface ActionSheetSelectEvent {
  tapIndex: number;
}

export interface ActionSheetProps {
  visible?: boolean;
  itemList?: string[];
  title?: string;
  cancelText?: string;
  closeOnMask?: boolean;
  showCancel?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  onSelect?: (event: ActionSheetSelectEvent) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export interface ActionSheetRef {
  open: () => void;
  close: () => void;
}

export const ActionSheet = memo(forwardRef<ActionSheetRef, ActionSheetProps>(function ActionSheet(
  {
    visible = false,
    itemList = [],
    title = '',
    cancelText,
    closeOnMask = true,
    showCancel = true,
    onVisibleChange,
    onSelect,
    onCancel,
    onClose,
  },
  ref,
) {
  const { t } = useLiveTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [internalVisible, setInternalVisible] = useState<boolean>(visible);
  const visibleRef = useRef(internalVisible);
  visibleRef.current = internalVisible;

  useEffect(() => {
    setInternalVisible(visible);
  }, [visible]);

  const open = useCallback(() => {
    if (!visibleRef.current) {
      visibleRef.current = true;
      setInternalVisible(true);
      onVisibleChange?.(true);
    }
  }, [onVisibleChange]);

  const close = useCallback(() => {
    if (visibleRef.current) {
      visibleRef.current = false;
      setInternalVisible(false);
      onVisibleChange?.(false);
      onClose?.();
    }
  }, [onVisibleChange, onClose]);

  useImperativeHandle(ref, () => ({ open, close }), [open, close]);

  const handleMaskPress = () => {
    if (closeOnMask) {
      onCancel?.();
      close();
    }
  };

  const handleSelect = (index: number) => {
    onSelect?.({ tapIndex: index });
    close();
  };

  const handleCancel = () => {
    onCancel?.();
    close();
  };

  if (!internalVisible) return null;

  const panelWidth = width - insets.left - insets.right;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleMaskPress}
    >
      <Pressable style={styles.mask} onPress={handleMaskPress}>
        <Pressable style={[styles.container, { width: panelWidth }]} onPress={() => {}}>
          <View style={styles.panel}>
            {!!title && (
              <View style={styles.header}>
                <Text style={styles.headerText}>{title}</Text>
              </View>
            )}
            <ScrollView style={styles.list} bounces={false}>
              {itemList.map((item, index) => (
                <Pressable
                  key={index}
                  style={[styles.item, index !== itemList.length - 1 && styles.itemDivider]}
                  onPress={() => handleSelect(index)}
                >
                  <Text style={styles.itemText}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          {showCancel && (
            <Pressable style={styles.cancel} onPress={handleCancel}>
              <Text style={styles.cancelText}>{cancelText ?? t('common.cancel')}</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}));

export default ActionSheet;
