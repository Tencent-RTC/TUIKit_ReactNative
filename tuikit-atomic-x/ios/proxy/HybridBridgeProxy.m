#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HybridBridgeProxy, NSObject)

RCT_EXTERN_METHOD(callAPI:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(callExperimentalAPI:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(addEventListener:(NSString *)key)

RCT_EXTERN_METHOD(removeEventListener:(NSString *)key)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
