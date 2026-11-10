/**
 * SVGAAnimationView Component
 * React Native 原生 SVGA 动画组件封装
 *
 * @format
 */

import { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';

// ==================== 类型定义 ====================

interface SVGAAnimationViewNativeProps {
  style?: ViewStyle;
  onFinished?: () => void;
}

export interface SVGAAnimationViewProps {
  style?: ViewStyle;
  onFinished?: () => void;
}

export interface SVGAAnimationViewRef {
  startAnimation: (url: string) => void;
  stopAnimation: () => void;
}

// ==================== 原生组件 ====================

// 检查原生组件是否可用
const isNativeComponentAvailable = () => {
  try {
    const config = UIManager.getViewManagerConfig('SVGAAnimationView');
    return !!config;
  } catch {
    return false;
  }
};

const NATIVE_AVAILABLE = isNativeComponentAvailable();

const SVGAAnimationViewNative = NATIVE_AVAILABLE
  ? requireNativeComponent<SVGAAnimationViewNativeProps>('SVGAAnimationView')
  : null;

// ==================== 命令常量 ====================

const getCommands = () => {
  if (!NATIVE_AVAILABLE) return {};
  const config = UIManager.getViewManagerConfig('SVGAAnimationView');
  return (config as any)?.Commands || {};
};

// ==================== 组件封装 ====================

const SVGAAnimationView = forwardRef<
  SVGAAnimationViewRef,
  SVGAAnimationViewProps
>((props, ref) => {
  const { style, onFinished } = props;
  const nativeRef = useRef(null);

  const dispatchCommand = useCallback(
    (commandName: string, args: any[] = []) => {
      const nodeHandle = findNodeHandle(nativeRef.current);
      if (!nodeHandle) {
        console.warn(
          'SVGAAnimationView: nodeHandle is null, component may not be mounted'
        );
        return;
      }
      const commands = getCommands();
      const commandId = commands[commandName];
      if (commandId === undefined) {
        console.error(
          `SVGAAnimationView: Command "${commandName}" not found. Available commands:`,
          Object.keys(commands)
        );
        return;
      }
      console.log(
        `SVGAAnimationView: Dispatching command "${commandName}" with ID ${commandId}`,
        args
      );
      UIManager.dispatchViewManagerCommand(nodeHandle, commandId, args);
    },
    []
  );

  const startAnimation = useCallback(
    (url: string) => {
      dispatchCommand('startAnimation', [url]);
    },
    [dispatchCommand]
  );

  const stopAnimation = useCallback(() => {
    dispatchCommand('stopAnimation');
  }, [dispatchCommand]);

  useImperativeHandle(
    ref,
    () => ({
      startAnimation,
      stopAnimation,
    }),
    [startAnimation, stopAnimation]
  );

  if (!SVGAAnimationViewNative) {
    console.warn('SVGAAnimationView: Native component not available');
    return <View style={style} />;
  }

  return (
    <SVGAAnimationViewNative
      ref={nativeRef}
      style={style}
      onFinished={onFinished}
    />
  );
});

SVGAAnimationView.displayName = 'SVGAAnimationView';

export { SVGAAnimationView };
export default SVGAAnimationView;
