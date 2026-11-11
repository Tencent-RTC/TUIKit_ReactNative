import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { rpxToPx } from '../../../utils/unitUtils';

export type DialogConfirmType = 'danger' | 'primary';

export interface DialogProps {
  visible?: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: DialogConfirmType;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function Dialog({
  visible = false,
  onClose,
  title = '',
  message = '',
  confirmText = '',
  cancelText = '',
  confirmType = 'danger',
  onConfirm,
  onCancel,
}: DialogProps) {
  const handleConfirm = useCallback(() => {
    onConfirm?.();
    onClose?.();
  }, [onConfirm, onClose]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onClose?.();
  }, [onCancel, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.mask} onPress={handleCancel}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          <View style={styles.bg} />
          <View style={styles.inner}>
            {!!title && <Text style={styles.title}>{title}</Text>}
            {!!message && (
              <Text style={styles.message} numberOfLines={2}>
                {message}
              </Text>
            )}
            <View style={styles.btns}>
              {!!cancelText && (
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnCancel,
                    pressed && styles.btnCancelPressed,
                  ]}
                >
                  <Text style={[styles.btnText, styles.btnCancelText]}>
                    {cancelText}
                  </Text>
                </Pressable>
              )}
              {!!confirmText && (
                <Pressable
                  onPress={handleConfirm}
                  style={({ pressed }) => [
                    styles.btn,
                    confirmType === 'primary'
                      ? styles.btnPrimary
                      : styles.btnDanger,
                    pressed &&
                      (confirmType === 'primary'
                        ? styles.btnPrimaryPressed
                        : styles.btnDangerPressed),
                  ]}
                >
                  <Text style={[styles.btnText, styles.btnConfirmText]}>
                    {confirmText}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const BOX_WIDTH = rpxToPx(500);
const BOX_HEIGHT = rpxToPx(256);
const BOX_RADIUS = rpxToPx(28);

const styles = StyleSheet.create({
  mask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    position: 'relative',
    width: BOX_WIDTH,
    minHeight: BOX_HEIGHT,
    borderRadius: BOX_RADIUS,
    boxShadow: `0 ${rpxToPx(20)}px ${rpxToPx(60)}px rgba(0, 0, 0, 0.55)`,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BOX_RADIUS,
    backgroundColor: 'rgba(14, 18, 28, 0.94)',
    borderWidth: rpxToPx(2),
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  inner: {
    width: BOX_WIDTH,
    minHeight: BOX_HEIGHT,
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: rpxToPx(36),
    paddingRight: rpxToPx(40),
    paddingBottom: rpxToPx(28),
    paddingLeft: rpxToPx(40),
  },
  title: {
    color: '#ffffff',
    fontSize: rpxToPx(32),
    fontWeight: '700',
    marginBottom: rpxToPx(12),
    textAlign: 'center',
  },
  message: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: rpxToPx(24),
    marginBottom: rpxToPx(32),
    textAlign: 'center',
  },
  btns: {
    flexDirection: 'row',
    width: rpxToPx(420),
  },
  btn: {
    flex: 1,
    height: rpxToPx(72),
    borderRadius: rpxToPx(36),
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  btnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    marginRight: rpxToPx(20),
  },
  btnCancelPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  btnDanger: {
    backgroundColor: '#FF5158',
  },
  btnDangerPressed: {
    backgroundColor: '#E04549',
  },
  btnPrimary: {
    backgroundColor: '#2A6BFF',
    experimental_backgroundImage: 'linear-gradient(to right, #2A6BFF, #4A9EFF)',
  },
  btnPrimaryPressed: {
    opacity: 0.88,
  },
  btnText: {
    fontSize: rpxToPx(28),
    fontWeight: '600',
  },
  btnCancelText: {
    color: 'rgba(255, 255, 255, 0.88)',
  },
  btnConfirmText: {
    color: '#ffffff',
  },
});

export default Dialog;
