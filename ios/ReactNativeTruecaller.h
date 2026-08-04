#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>

@interface ReactNativeTruecaller : RCTEventEmitter <RCTBridgeModule>

+ (BOOL)handle:(NSUserActivity *)userActivity
        restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler;

+ (BOOL)handleOpenURL:(NSURL *)url;

@end
