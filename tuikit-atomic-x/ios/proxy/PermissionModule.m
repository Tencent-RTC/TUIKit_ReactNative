#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PermissionModule, NSObject)

RCT_EXTERN_METHOD(getAuthorizationStatus:(NSString *)kind
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
