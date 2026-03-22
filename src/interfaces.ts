import { type ColorValue } from 'react-native';
import type { TRUECALLER_ANDROID_CUSTOMIZATIONS } from './constants';

/**
 * Type for Button Text Customizations
 */
export type TruecallerButtonTextKey =
  keyof typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.BUTTON_TEXTS;
export type TruecallerButtonTextValue =
  (typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.BUTTON_TEXTS)[TruecallerButtonTextKey];

/**
 * Type for Button Shape Customizations
 */
export type TruecallerButtonShapeKey =
  keyof typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.BUTTON_SHAPES;
export type TruecallerButtonShapeValue =
  (typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.BUTTON_SHAPES)[TruecallerButtonShapeKey];

/**
 * Type for Footer Button Text Customizations
 */
export type TruecallerFooterButtonTextKey =
  keyof typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.FOOTER_TEXTS;
export type TruecallerFooterButtonTextValue =
  (typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.FOOTER_TEXTS)[TruecallerFooterButtonTextKey];

/**
 * Type for Consent Heading Customizations
 */
export type TruecallerConsentHeadingKey =
  keyof typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.CONSENT_HEADINGS;
export type TruecallerConsentHeadingValue =
  (typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.CONSENT_HEADINGS)[TruecallerConsentHeadingKey];

/**
 * Type for Consent Mode Customizations
 */
export type TruecallerConsentModeKey =
  keyof typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.CONSENT_MODES;
export type TruecallerConsentModeValue =
  (typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.CONSENT_MODES)[TruecallerConsentModeKey];

/**
 * Type for SDK Options
 */
export type TruecallerSdkOptionKey =
  keyof typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.SDK_OPTIONS;
export type TruecallerSdkOptionValue =
  (typeof TRUECALLER_ANDROID_CUSTOMIZATIONS.SDK_OPTIONS)[TruecallerSdkOptionKey];

/**
 * Configuration interface for initializing Truecaller
 */
export interface TruecallerConfig {
  /** Android client ID for Truecaller SDK */
  androidClientId?: string;
  /** iOS app key for Truecaller SDK */
  iosAppKey?: string;
  /** iOS app link for Truecaller SDK */
  iosAppLink?: string;
  /** Color of the Truecaller button on Android */
  androidButtonColor?: ColorValue;
  /** Text color of the Truecaller button on Android */
  androidButtonTextColor?: ColorValue;
  /** Shape of the Truecaller button on Android */
  androidButtonShape?: TruecallerButtonShapeValue;
  /** Text displayed on the Truecaller button on Android */
  androidButtonText?: TruecallerButtonTextValue;
  /** Text displayed on the footer button on Android */
  androidFooterButtonText?: TruecallerFooterButtonTextValue;
  /** Heading text for the consent screen on Android */
  androidConsentHeading?: TruecallerConsentHeadingValue;
  /** Consent UI mode: BOTTOMSHEET (default) or POPUP (center) */
  androidConsentMode?: TruecallerConsentModeValue;
  /** Whether to verify only Truecaller users or all users */
  androidSdkOptions?: TruecallerSdkOptionValue;
  /** Enable dark mode for the consent screen on Android (defaults to system setting) */
  androidDarkMode?: boolean;
  /** Custom handler for Android success events if you want to handle them yourself */
  androidSuccessHandler?: (data: TruecallerAndroidResponse) => void;
}

/**
 * User Profile Interface returned by Truecaller
 */
export interface TruecallerUserProfile {
  firstName: string;
  lastName: string | null;
  phoneNumber: string;
  countryCode: string;
  gender: string | null;
  email: string | null;
}

/**
 * Android-specific user response interface
 */
export interface TruecallerAndroidResponse {
  authorizationCode: string;
  codeVerifier: string;
  given_name: string;
  family_name: string | null;
  phone_number: string;
  phone_number_country_code: string;
  gender: string | null;
  email: string | null;
}

/**
 * iOS-specific user response interface
 */
export interface TruecallerIOSResponse {
  firstName: string;
  lastName: string | null;
  phoneNumber: string;
  countryCode: string;
  gender: string | null;
  email: string | null;
}

/**
 * Interface for the Truecaller hook result
 */
export interface UseTruecallerResult {
  /** Will be null for android if custom success handler is provided */
  userProfile: TruecallerUserProfile | null;
  error: string | null;
  isTruecallerInitialized: boolean;
  initializeTruecallerSDK: () => Promise<void>;
  isSdkUsable: () => Promise<boolean>;
  openTruecallerForVerification: () => Promise<void>;
  clearTruecallerSdk: () => void;
}
