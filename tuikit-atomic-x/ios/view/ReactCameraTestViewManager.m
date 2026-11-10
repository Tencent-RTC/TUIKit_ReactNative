#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(CameraTestView, ReactCameraTestViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(viewId, NSString)
RCT_EXPORT_VIEW_PROPERTY(cornerRadius, NSNumber)

@end
