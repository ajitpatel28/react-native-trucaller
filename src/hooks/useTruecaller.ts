import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Platform,
  NativeModules,
  NativeEventEmitter,
  DeviceEventEmitter,
} from 'react-native';
import axios from 'axios';
import type {
  TruecallerConfig,
  TruecallerUserProfile,
  UseTruecallerResult,
  TruecallerAndroidResponse,
  TruecallerIOSResponse,
} from '../interfaces';
import {
  TRUECALLER_ANDROID_EVENTS,
  TRUECALLER_IOS_EVENTS,
  TRUECALLER_API_URLS,
  DEFAULT_BUTTON_TEXT_COLOR,
  DEFAULT_BUTTON_COLOR,
  DEFAULT_BUTTON_SHAPE,
  DEFAULT_BUTTON_TEXT,
  DEFAULT_CONSENT_HEADING,
  DEFAULT_FOOTER_BUTTON_TEXT,
} from '../constants';

const TruecallerAndroidModule = NativeModules.TruecallerModule;
const TruecallerIOS = NativeModules.ReactNativeTruecaller;

export const useTruecaller = (
  config: TruecallerConfig
): UseTruecallerResult => {
  const [userProfile, setUserProfile] = useState<TruecallerUserProfile | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isTruecallerInitialized, setIsTruecallerInitialized] = useState(false);
  const readyListenerRef = useRef<{ remove: () => void } | null>(null);
  const initFailureListenersRef = useRef<{ remove: () => void }[]>([]);

  const initializeTruecallerSDK = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && !config.androidClientId) {
        throw new Error('Android client ID is required for Android platform');
      }
      if (Platform.OS === 'ios' && (!config.iosAppKey || !config.iosAppLink)) {
        throw new Error(
          'iOS app key and app link are required for iOS platform'
        );
      }

      if (Platform.OS === 'android') {
        const androidConfig: Record<string, unknown> = {
          buttonColor: config.androidButtonColor || DEFAULT_BUTTON_COLOR,
          buttonTextColor:
            config.androidButtonTextColor || DEFAULT_BUTTON_TEXT_COLOR,
          buttonText: config.androidButtonText || DEFAULT_BUTTON_TEXT,
          buttonShape: config.androidButtonShape || DEFAULT_BUTTON_SHAPE,
          footerButtonText:
            config.androidFooterButtonText || DEFAULT_FOOTER_BUTTON_TEXT,
          consentHeading:
            config.androidConsentHeading || DEFAULT_CONSENT_HEADING,
        };
        if (config.androidConsentMode) {
          androidConfig.consentMode = config.androidConsentMode;
        }
        if (config.androidSdkOptions) {
          androidConfig.sdkOptions = config.androidSdkOptions;
        }
        if (config.androidDarkMode !== undefined) {
          androidConfig.darkMode = config.androidDarkMode;
        }
        if (config.androidEnhancedBottomSheet !== undefined) {
          androidConfig.enhancedBottomSheet = config.androidEnhancedBottomSheet;
        }
        // Remove any previously-registered, not-yet-fired listeners from an
        // earlier call before registering fresh ones, to avoid stacking
        // listeners/state updates from stale closures on retry.
        const clearInitListeners = () => {
          readyListenerRef.current?.remove();
          readyListenerRef.current = null;
          initFailureListenersRef.current.forEach((l) => l.remove());
          initFailureListenersRef.current = [];
        };
        clearInitListeners();

        const readyListener = DeviceEventEmitter.addListener(
          TRUECALLER_ANDROID_EVENTS.READY,
          () => {
            setIsTruecallerInitialized(true);
            setError(null);
            clearInitListeners();
          }
        );
        readyListenerRef.current = readyListener;

        // Init is async: initializeSdk() only accepts the request, and a
        // failure can be reported before isTruecallerInitialized ever becomes
        // true, via two different native channels:
        // - TRUECALLER_ANDROID_EVENTS.ERROR: TruecallerModule.java's
        //   initializeSdk() catch block, for exceptions thrown on the JS
        //   wrapper's own side (e.g. malformed config).
        // - TRUECALLER_ANDROID_EVENTS.FAILURE: the SDK's own
        //   TcOAuthCallback.onFailure(TcOAuthError), which is how the SDK
        //   itself reports failures (including SdkInitError-style init
        //   failures) through the same callback used for the OAuth flow.
        // Without listeners registered up front for both, an init-time
        // failure would be dropped on the floor and the hook would hang
        // silently forever.
        const handleInitFailure = (err: { errorMessage: string }) => {
          setError(err.errorMessage);
          clearInitListeners();
        };
        initFailureListenersRef.current = [
          DeviceEventEmitter.addListener(
            TRUECALLER_ANDROID_EVENTS.ERROR,
            handleInitFailure
          ),
          DeviceEventEmitter.addListener(
            TRUECALLER_ANDROID_EVENTS.FAILURE,
            handleInitFailure
          ),
        ];

        try {
          await TruecallerAndroidModule.initializeSdk(androidConfig);
        } catch (initErr) {
          // If native init itself throws, remove the pending listeners so a
          // late/racing event can't silently flip isTruecallerInitialized
          // back to true, or double-report an error, after we've reported it.
          clearInitListeners();
          throw initErr;
        }
      } else {
        await TruecallerIOS.initialize(config.iosAppKey, config.iosAppLink);
        setIsTruecallerInitialized(true);
        setError(null);
      }
    } catch (err) {
      setError((err as Error).message);
      setIsTruecallerInitialized(false);
    }
  }, [config]);

  useEffect(() => {
    return () => {
      readyListenerRef.current?.remove();
      readyListenerRef.current = null;
      initFailureListenersRef.current.forEach((l) => l.remove());
      initFailureListenersRef.current = [];
    };
  }, []);

  useEffect(() => {
    let successListener: any;
    let failureListener: any;
    let errorListener: any;
    let verificationRequiredListener: any;

    if (isTruecallerInitialized) {
      if (Platform.OS === 'android') {
        if (!config.androidClientId) {
          setError('Android client ID is required for Android platform');
          return;
        }
        successListener = DeviceEventEmitter.addListener(
          TRUECALLER_ANDROID_EVENTS.SUCCESS,
          (data: TruecallerAndroidResponse) => {
            if (config.androidSuccessHandler) {
              config.androidSuccessHandler(data);
            } else {
              handleAuthorizationSuccess(data);
            }
          }
        );
        failureListener = DeviceEventEmitter.addListener(
          TRUECALLER_ANDROID_EVENTS.FAILURE,
          (err: { errorMessage: string }) => {
            setError(err.errorMessage);
            setUserProfile(null);
          }
        );
        errorListener = DeviceEventEmitter.addListener(
          TRUECALLER_ANDROID_EVENTS.ERROR,
          (err: { errorMessage: string }) => {
            setError(err.errorMessage);
          }
        );
        verificationRequiredListener = DeviceEventEmitter.addListener(
          TRUECALLER_ANDROID_EVENTS.VERIFICATION_REQUIRED,
          (err: { errorMessage: string }) => {
            setError(err.errorMessage);
          }
        );
      } else if (Platform.OS === 'ios') {
        if (!config.iosAppKey || !config.iosAppLink) {
          setError('iOS app key and app link are required for iOS platform');
          return;
        }
        const eventEmitter = new NativeEventEmitter(TruecallerIOS);

        successListener = eventEmitter.addListener(
          TRUECALLER_IOS_EVENTS.SUCCESS,
          (data: TruecallerIOSResponse) => {
            if (config.iosSuccessHandler) {
              config.iosSuccessHandler(data);
            } else {
              handleAuthorizationSuccess(data);
            }
          }
        );
        failureListener = eventEmitter.addListener(
          TRUECALLER_IOS_EVENTS.FAILURE,
          (err: { errorMessage: string }) => {
            setError(err.errorMessage);
            setUserProfile(null);
          }
        );
      }
    }

    return () => {
      successListener?.remove();
      failureListener?.remove();
      errorListener?.remove();
      verificationRequiredListener?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTruecallerInitialized, config]);

  const handleAuthorizationSuccess = async (
    data: TruecallerAndroidResponse | TruecallerIOSResponse
  ) => {
    try {
      if (Platform.OS === 'android') {
        const { authorizationCode, codeVerifier } =
          data as TruecallerAndroidResponse;

        const accessToken = await exchangeAuthorizationCodeForAccessToken(
          authorizationCode,
          codeVerifier
        );
        const userInfo = await fetchUserProfile(accessToken);
        setUserProfile(userInfo);
      } else {
        // For iOS, the profile data is directly available
        setUserProfile(
          mapIOSResponseToUserProfile(data as TruecallerIOSResponse)
        );
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setUserProfile(null);
    }
  };

  const exchangeAuthorizationCodeForAccessToken = async (
    authorizationCode: string,
    codeVerifier: string
  ): Promise<string> => {
    const clientId = config.androidClientId;
    const response = await axios.post(
      TRUECALLER_API_URLS.TOKEN_URL,
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: authorizationCode,
        code_verifier: codeVerifier,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data.access_token;
  };

  const fetchUserProfile = async (
    accessToken: string
  ): Promise<TruecallerUserProfile> => {
    const response = await axios.get(TRUECALLER_API_URLS.USER_INFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return mapAndroidResponseToUserProfile(response.data);
  };

  const mapAndroidResponseToUserProfile = (
    data: TruecallerAndroidResponse
  ): TruecallerUserProfile => ({
    firstName: data.given_name,
    lastName: data.family_name,
    email: data.email,
    countryCode: data.phone_number_country_code,
    gender: data.gender,
    phoneNumber: data.phone_number,
  });

  const mapIOSResponseToUserProfile = (
    data: TruecallerIOSResponse
  ): TruecallerUserProfile => ({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    countryCode: data.countryCode,
    gender: data.gender !== 0 ? String(data.gender) : null,
    phoneNumber: data.phoneNumber,
  });

  const isSdkUsable = async (): Promise<boolean> => {
    if (Platform.OS === 'android') return TruecallerAndroidModule.isSdkUsable();
    if (Platform.OS === 'ios') return TruecallerIOS.isSupported();
    return false;
  };

  const openTruecallerForVerification = useCallback(async () => {
    if (!isTruecallerInitialized) {
      setError('SDK is not initialized. Call initializeSDK first.');
      return;
    }

    try {
      if (!(await isSdkUsable())) {
        throw new Error('Truecaller SDK is not usable on this device');
      }
      if (Platform.OS === 'android') {
        if (!config.androidClientId) {
          throw new Error('Android client ID is required for Android platform');
        }
        await TruecallerAndroidModule.requestAuthorizationCode();
      } else {
        if (!config.iosAppKey || !config.iosAppLink) {
          throw new Error(
            'iOS app key and app link are required for iOS platform'
          );
        }
        await TruecallerIOS.requestProfile();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [isTruecallerInitialized, config]);

  const clearTruecallerSdk = useCallback(() => {
    if (Platform.OS === 'android') {
      TruecallerAndroidModule.clearSdk();
    }
  }, []);

  return {
    userProfile,
    error,
    isTruecallerInitialized,
    initializeTruecallerSDK,
    isSdkUsable,
    openTruecallerForVerification,
    clearTruecallerSdk,
  };
};
