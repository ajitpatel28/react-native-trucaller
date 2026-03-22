package com.ajit.reactnativetruecaller;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;

import androidx.annotation.Nullable;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.fragment.app.FragmentActivity;

import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.truecaller.android.sdk.oAuth.*;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.Locale;

public class TruecallerModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private static final String MODULE_NAME = "TruecallerModule";
    private final ReactApplicationContext reactContext;
    private String codeVerifier;
    private ActivityResultLauncher<android.content.Intent> launcher;
    private Boolean isDarkMode = null; // null = resolve from system at call time

    public TruecallerModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
        reactContext.addLifecycleEventListener(this);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @Override
    public void onHostResume() {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity instanceof FragmentActivity && launcher == null) {
            registerLauncher((FragmentActivity) currentActivity);
        }
    }

    private void registerLauncher(FragmentActivity fragmentActivity) {
        launcher = fragmentActivity.getActivityResultRegistry().register(
            "truecaller_oauth",
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                try {
                    TcSdk.getInstance().onActivityResultObtained(
                        fragmentActivity, result.getResultCode(), result.getData()
                    );
                } catch (Exception e) {
                    emitErrorEvent(e.getMessage());
                }
            }
        );
    }

    @Override
    public void onHostPause() {}

    @Override
    public void onHostDestroy() {
        cleanUp();
    }

    private void cleanUp() {
        TcSdk.clear();
        if (launcher != null) {
            launcher.unregister();
            launcher = null;
        }
    }

    private final TcOAuthCallback oauthCallback = new TcOAuthCallback() {
        @Override
        public void onSuccess(TcOAuthData oauthData) {
            emitEvent("TruecallerAndroidSuccess", createSuccessMap(oauthData));
        }

        @Override
        public void onFailure(TcOAuthError oauthError) {
            emitEvent("TruecallerAndroidFailure", createErrorMap(oauthError.getErrorCode(), oauthError.getErrorMessage()));
        }

        @Override
        public void onVerificationRequired(TcOAuthError oauthError) {
            emitEvent("TruecallerAndroidVerificationRequired", createErrorMap(oauthError.getErrorCode(), oauthError.getErrorMessage()));
        }
    };

    @ReactMethod
    public void initializeSdk(ReadableMap config) {
        try {
            isDarkMode = config.hasKey("darkMode") ? config.getBoolean("darkMode") : null;
            TcSdk.init(buildSdkOptions(config));
            if (config.hasKey("languageCode")) {
                String languageCode = config.getString("languageCode");
                if (languageCode != null && !languageCode.isEmpty()) {
                    TcSdk.getInstance().setLocale(new Locale(languageCode));
                }
            }
        } catch (Exception e) {
            emitErrorEvent(e.getMessage());
        }
    }

    @ReactMethod
    public void requestAuthorizationCode() {
        try {
            Activity currentActivity = getCurrentActivity();
            if (currentActivity == null) {
                emitErrorEvent("Current activity is null");
                return;
            }
            if (!(currentActivity instanceof FragmentActivity)) {
                emitErrorEvent("Current activity is not a FragmentActivity");
                return;
            }
            FragmentActivity fragmentActivity = (FragmentActivity) currentActivity;

            // Fallback: register launcher if onHostResume hasn't fired yet
            if (launcher == null) {
                registerLauncher(fragmentActivity);
            }

            String state = generateOAuthState();
            String codeChallenge = generateCodeChallenge();

            TcSdk.getInstance().setOAuthState(state);
            TcSdk.getInstance().setOAuthScopes(new String[]{"profile", "phone", "email"});
            TcSdk.getInstance().setCodeChallenge(codeChallenge);
            boolean darkMode = isDarkMode != null ? isDarkMode : isSystemDarkMode();
            TcSdk.getInstance().setTheme(darkMode ? OAuthThemeOptions.DARK : OAuthThemeOptions.LIGHT);
            TcSdk.getInstance().getAuthorizationCode(fragmentActivity, launcher);
        } catch (Exception e) {
            emitErrorEvent(e.getMessage());
        }
    }

    @ReactMethod
    public void isSdkUsable(Promise promise) {
        try {
            TcSdk instance = TcSdk.getInstance();
            boolean isUsable = instance != null && instance.isOAuthFlowUsable();
            promise.resolve(isUsable);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearSdk() {
        cleanUp();
    }

    private TcSdkOptions buildSdkOptions(ReadableMap config) {
        TcSdkOptions.Builder sdkOptionsBuilder = new TcSdkOptions.Builder(reactContext, oauthCallback);

        if (config.hasKey("buttonColor")) {
            sdkOptionsBuilder.buttonColor(Color.parseColor(config.getString("buttonColor")));
        }
        if (config.hasKey("buttonTextColor")) {
            sdkOptionsBuilder.buttonTextColor(Color.parseColor(config.getString("buttonTextColor")));
        }
        if (config.hasKey("buttonText")) {
            sdkOptionsBuilder.ctaText(mapCtaText(config.getString("buttonText")));
        }
        if (config.hasKey("buttonShape")) {
            sdkOptionsBuilder.buttonShapeOptions(mapButtonShape(config.getString("buttonShape")));
        }
        if (config.hasKey("footerButtonText")) {
            sdkOptionsBuilder.footerType(mapFooterText(config.getString("footerButtonText")));
        }
        if (config.hasKey("consentHeading")) {
            sdkOptionsBuilder.consentHeadingOption(mapConsentHeading(config.getString("consentHeading")));
        }
        if (config.hasKey("consentMode")) {
            sdkOptionsBuilder.consentMode(mapConsentMode(config.getString("consentMode")));
        }

        if (config.hasKey("sdkOptions")) {
            sdkOptionsBuilder.sdkOptions(mapSdkOptions(config.getString("sdkOptions")));
        }


        return sdkOptionsBuilder.build();
    }

    private String generateOAuthState() {
        return new BigInteger(130, new SecureRandom()).toString(32);
    }

    private String generateCodeChallenge() {
        codeVerifier = CodeVerifierUtil.Companion.generateRandomCodeVerifier();
        return CodeVerifierUtil.Companion.getCodeChallenge(codeVerifier);
    }

    private boolean isSystemDarkMode() {
        int nightMode = reactContext.getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK;
        return nightMode == Configuration.UI_MODE_NIGHT_YES;
    }

    private void emitEvent(String eventName, @Nullable WritableMap params) {
        reactContext
                .runOnUiQueueThread(() -> reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit(eventName, params));
    }

    private void emitErrorEvent(String errorMessage) {
        emitEvent("TruecallerAndroidError", createErrorMap(0, errorMessage));
    }

    private WritableMap createSuccessMap(TcOAuthData data) {
        WritableMap params = Arguments.createMap();
        params.putString("authorizationCode", data.getAuthorizationCode());
        params.putString("codeVerifier", codeVerifier);
        return params;
    }

    private WritableMap createErrorMap(int errorCode, String errorMessage) {
        WritableMap params = Arguments.createMap();
        params.putInt("errorCode", errorCode);
        params.putString("errorMessage", errorMessage);
        return params;
    }

    // --- Mapping functions ---

    private int mapConsentMode(String consentMode) {
        if ("TRUECALLER_ANDROID_CONSENT_MODE_POPUP".equals(consentMode)) {
            return TcSdkOptions.CONSENT_MODE_POPUP;
        }
        return TcSdkOptions.CONSENT_MODE_BOTTOMSHEET;
    }

    private int mapSdkOptions(String sdkOption) {
        if ("TRUECALLER_ANDROID_SDK_OPTION_VERIFY_ALL_USERS".equals(sdkOption)) {
            return TcSdkOptions.OPTION_VERIFY_ALL_USERS;
        }
        return TcSdkOptions.OPTION_VERIFY_ONLY_TC_USERS;
    }

    private int mapCtaText(String ctaText) {
        switch (ctaText) {
            case "TRUECALLER_ANDROID_BUTTON_TEXT_ACCEPT":
                return TcSdkOptions.CTA_TEXT_ACCEPT;
            case "TRUECALLER_ANDROID_BUTTON_TEXT_CONFIRM":
                return TcSdkOptions.CTA_TEXT_CONFIRM;
            case "TRUECALLER_ANDROID_BUTTON_TEXT_PROCEED":
                return TcSdkOptions.CTA_TEXT_PROCEED;
            default:
                return TcSdkOptions.CTA_TEXT_CONTINUE;
        }
    }

    private int mapButtonShape(String buttonShape) {
        if ("TRUECALLER_ANDROID_BUTTON_SHAPE_RECTANGLE".equals(buttonShape)) {
            return TcSdkOptions.BUTTON_SHAPE_RECTANGLE;
        }
        return TcSdkOptions.BUTTON_SHAPE_ROUNDED;
    }

    private int mapFooterText(String footerText) {
        switch (footerText) {
            case "TRUECALLER_ANDROID_FOOTER_BUTTON_ANOTHER_MOBILE_NUMBER":
                return TcSdkOptions.FOOTER_TYPE_ANOTHER_MOBILE_NO;
            case "TRUECALLER_ANDROID_FOOTER_BUTTON_ANOTHER_METHOD":
                return TcSdkOptions.FOOTER_TYPE_ANOTHER_METHOD;
            case "TRUECALLER_ANDROID_FOOTER_BUTTON_MANUALLY":
                return TcSdkOptions.FOOTER_TYPE_MANUALLY;
            case "TRUECALLER_ANDROID_FOOTER_BUTTON_LATER":
                return TcSdkOptions.FOOTER_TYPE_LATER;
            default:
                return TcSdkOptions.FOOTER_TYPE_SKIP;
        }
    }

    private int mapConsentHeading(String consentHeading) {
        switch (consentHeading) {
            case "TRUECALLER_ANDROID_CONSENT_HEADING_SIGN_UP_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_SIGN_UP_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_SIGN_IN_TO":
                return TcSdkOptions.SDK_CONSENT_HEADING_SIGN_IN_TO;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_VERIFY_NUMBER_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_VERIFY_NUMBER_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_REGISTER_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_REGISTER_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_GET_STARTED_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_GET_STARTED_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_PROCEED_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_PROCEED_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_VERIFY_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_VERIFY_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_VERIFY_PROFILE_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_VERIFY_PROFILE_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_VERIFY_YOUR_PROFILE_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_VERIFY_YOUR_PROFILE_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_VERIFY_PHONE_NO_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_VERIFY_PHONE_NO_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_VERIFY_YOUR_NO_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_VERIFY_YOUR_NO_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_CONTINUE_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_CONTINUE_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_COMPLETE_ORDER_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_COMPLETE_ORDER_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_PLACE_ORDER_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_PLACE_ORDER_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_COMPLETE_BOOKING_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_COMPLETE_BOOKING_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_CHECKOUT_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_CHECKOUT_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_MANAGE_DETAILS_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_MANAGE_DETAILS_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_MANAGE_YOUR_DETAILS_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_MANAGE_YOUR_DETAILS_WITH;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_LOGIN_TO_WITH_ONE_TAP":
                return TcSdkOptions.SDK_CONSENT_HEADING_LOGIN_TO_WITH_ONE_TAP;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_SUBSCRIBE_TO":
                return TcSdkOptions.SDK_CONSENT_HEADING_SUBSCRIBE_TO;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_GET_UPDATES_FROM":
                return TcSdkOptions.SDK_CONSENT_HEADING_GET_UPDATES_FROM;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_CONTINUE_READING_ON":
                return TcSdkOptions.SDK_CONSENT_HEADING_CONTINUE_READING_ON;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_GET_NEW_UPDATES_FROM":
                return TcSdkOptions.SDK_CONSENT_HEADING_GET_NEW_UPDATES_FROM;
            case "TRUECALLER_ANDROID_CONSENT_HEADING_LOGIN_SIGNUP_WITH":
                return TcSdkOptions.SDK_CONSENT_HEADING_LOGIN_SIGNUP_WITH;
            default:
                return TcSdkOptions.SDK_CONSENT_HEADING_LOG_IN_TO;
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for RN built in Event Emitter Calls.
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Keep: Required for RN built in Event Emitter Calls.
    }
}
