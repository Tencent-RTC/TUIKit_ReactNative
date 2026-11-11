import {
  requireNativeComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface CameraTestViewProps {
  viewId: string;
  cornerRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const NativeCameraTestView =
  requireNativeComponent<CameraTestViewProps>('CameraTestView');

export function CameraTestView({
  viewId,
  cornerRadius = 0,
  style,
}: CameraTestViewProps) {
  return (
    <NativeCameraTestView
      viewId={viewId}
      cornerRadius={cornerRadius}
      style={style}
    />
  );
}

export default CameraTestView;
