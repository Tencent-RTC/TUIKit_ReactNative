import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import {
  Image,
  UIManager,
  findNodeHandle,
  requireNativeComponent,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type LiveCoreViewType = 'playView' | 'pushView';

export interface LiveCoreViewNativeProps {
  liveId: string;
  coreViewType: LiveCoreViewType;
  round?: number;
  style?: StyleProp<ViewStyle>;
}

export interface LiveCoreViewNativeRef {
  setLocalVideoMuteImage: (
    bigImage: ImageSourcePropType,
    smallImage: ImageSourcePropType
  ) => void;
}

const NATIVE_NAME = 'LiveCoreView';

const NativeLiveCoreView =
  requireNativeComponent<LiveCoreViewNativeProps>(NATIVE_NAME);

function toUri(source: ImageSourcePropType): string | null {
  return Image.resolveAssetSource(source as never)?.uri ?? null;
}

export const LiveCoreViewNative = forwardRef<
  LiveCoreViewNativeRef,
  LiveCoreViewNativeProps
>(function LiveCoreViewNative({ liveId, coreViewType, round, style }, ref) {
  const nativeRef = useRef(null);

  const dispatchCommand = useCallback((name: string, args: unknown[]) => {
    const node = findNodeHandle(nativeRef.current);
    const commands = (
      UIManager.getViewManagerConfig(NATIVE_NAME) as {
        Commands?: Record<string, number>;
      }
    )?.Commands;
    const commandId = commands?.[name];
    if (node == null || commandId === undefined) {
      console.warn(`[LiveCoreViewNative] command ${name} unavailable`);
      return;
    }
    UIManager.dispatchViewManagerCommand(node, commandId, args);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setLocalVideoMuteImage: (bigImage, smallImage) => {
        dispatchCommand('setLocalVideoMuteImage', [
          toUri(bigImage),
          toUri(smallImage),
        ]);
      },
    }),
    [dispatchCommand]
  );

  return (
    <NativeLiveCoreView
      ref={nativeRef}
      liveId={liveId}
      coreViewType={coreViewType}
      round={round}
      style={style}
    />
  );
});
