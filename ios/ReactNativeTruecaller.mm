#import "ReactNativeTruecaller.h"
#import <TrueSDK/TrueSDK.h>

@interface ReactNativeTruecaller () <TCTrueSDKDelegate>
@property (nonatomic, strong) TCTrueProfileResponse *pendingProfileResponse;
@end

@implementation ReactNativeTruecaller

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"TruecallerIOSSuccess", @"TruecallerIOSFailure"];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(isSupported) {
  return @([TCTrueSDK sharedManager].isSupported);
}

RCT_EXPORT_METHOD(initialize:(NSString *)appKey appLink:(NSString *)appLink) {
  if ([TCTrueSDK sharedManager].isSupported) {
    [[TCTrueSDK sharedManager] setupWithAppKey:appKey appLink:appLink];
    [TCTrueSDK sharedManager].delegate = self;
  } else {
    [self sendFailureEventWithCode:0 message:@"Please make sure you have truecaller app installed on your device."];
  }
}

RCT_EXPORT_METHOD(requestProfile) {
  self.pendingProfileResponse = nil;
  dispatch_async(dispatch_get_main_queue(), ^{
    [[TCTrueSDK sharedManager] requestTrueProfile];
  });
}

+ (BOOL)handle:(NSUserActivity *)userActivity
        restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {
  return [[TCTrueSDK sharedManager] application:[UIApplication sharedApplication]
                           continueUserActivity:userActivity
                             restorationHandler:restorationHandler];
}

+ (BOOL)handleOpenURL:(NSURL *)url {
  return [[TCTrueSDK sharedManager] continueWithUrlScheme:url];
}

// MARK: - TCTrueSDKDelegate

- (void)didReceiveTrueProfileResponse:(TCTrueProfileResponse *)profileResponse {
  self.pendingProfileResponse = profileResponse;
}

- (void)didReceiveTrueProfile:(TCTrueProfile *)profile {
  NSMutableDictionary *data = [NSMutableDictionary dictionaryWithDictionary:@{
    @"firstName":        profile.firstName        ?: [NSNull null],
    @"lastName":         profile.lastName         ?: [NSNull null],
    @"phoneNumber":      profile.phoneNumber      ?: [NSNull null],
    @"countryCode":      profile.countryCode      ?: [NSNull null],
    @"email":            profile.email            ?: [NSNull null],
    @"street":           profile.street           ?: [NSNull null],
    @"city":             profile.city             ?: [NSNull null],
    @"zipCode":          profile.zipCode          ?: [NSNull null],
    @"facebookID":       profile.facebookID       ?: [NSNull null],
    @"twitterID":        profile.twitterID        ?: [NSNull null],
    @"url":              profile.url              ?: [NSNull null],
    @"avatarURL":        profile.avatarURL        ?: [NSNull null],
    @"jobTitle":         profile.jobTitle         ?: [NSNull null],
    @"companyName":      profile.companyName      ?: [NSNull null],
    @"gender":           @(profile.gender),
    @"isVerified":       @(profile.isVerified),
    @"isAmbassador":     @(profile.isAmbassador),
  }];

  if (self.pendingProfileResponse) {
    data[@"payload"]            = self.pendingProfileResponse.payload            ?: [NSNull null];
    data[@"signature"]          = self.pendingProfileResponse.signature          ?: [NSNull null];
    data[@"signatureAlgorithm"] = self.pendingProfileResponse.signatureAlgorithm ?: [NSNull null];
    data[@"requestNonce"]       = self.pendingProfileResponse.requestNonce       ?: [NSNull null];
    self.pendingProfileResponse = nil;
  }

  [self sendEventWithName:@"TruecallerIOSSuccess" body:data];
}

- (void)didFailToReceiveTrueProfileWithError:(TCError *)error {
  self.pendingProfileResponse = nil;
  [self sendFailureEventWithCode:error.code message:error.localizedDescription];
}

// MARK: - Private

- (void)sendFailureEventWithCode:(NSInteger)code message:(NSString *)message {
  [self sendEventWithName:@"TruecallerIOSFailure" body:@{
    @"errorCode":    @(code),
    @"errorMessage": message ?: @"Unknown Truecaller error",
  }];
}

@end
