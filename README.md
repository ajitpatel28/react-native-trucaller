# @ajitpatel28/react-native-truecaller


React Native library for seamless Truecaller integration, supporting Android SDK v3.2.1 and iOS SDK v0.1.8

###### Note: Ios stil need fixes, will be updating soon, any contributions are welcomed.

## Features

- Easy integration with Truecaller SDK for both Android and iOS
- Customizable UI options for Android
- Simplified user authentication flow
- TypeScript support

## Breaking Changes

### v0.9.0

- `isSdkUsable()` now returns `Promise<boolean>` instead of `boolean`. Any call site that reads the result synchronously must be updated to await the call.

## Migration Guide

### `isSdkUsable` — sync to async

**Before:**

```typescript
const usable = isSdkUsable();
if (usable) {
  openTruecallerForVerification();
}
```

**After:**

```typescript
const usable = await isSdkUsable();
if (usable) {
  openTruecallerForVerification();
}
```

## Installation

```sh
npm install @ajitpatel28/react-native-truecaller
# or
yarn add @ajitpatel28/react-native-truecaller
```

## Setup

### iOS Setup

To generate a client ID, follow the instructions in the [Truecaller IOS Guide](https://docs.truecaller.com/truecaller-sdk/android/oauth-sdk-3.0.0/integration-steps/generating-client-id).

1. Add the following to your `Podfile`:

```ruby
pod '@ajitpatel28/react-native-truecaller', :path => '../node_modules/@ajitpatel28/react-native-truecaller'
```

2. Run `pod install` in your iOS directory.

3. In your iOS project, add URL schemes for Truecaller in your `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
<dict>
  <key>CFBundleURLSchemes</key>
  <array>
    <string>truecallersdk-{YOUR_APP_ID}</string>
  </array>
</dict>
</array>
```

Replace `{YOUR_APP_ID}` with your actual Truecaller App ID.

4. Add the `truesdk` entry under `LSApplicationQueriesSchemes` in your `Info.plist` file:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
<string>truesdk</string>
</array>
```

5. Add the associated domain provided by Truecaller:
  - In Xcode, go to your project's target
  - Select the "Signing & Capabilities" tab
  - Click on "+ Capability" and add "Associated Domains"
  - Add the domain provided by Truecaller with the "applinks:" prefix

   For example: `applinks:your-provided-domain.com`

   Note: Do not include "http://" or "https://" in the domain.

### Android Setup

To generate a client ID, follow the instructions in the [Truecaller Android Guide](https://docs.truecaller.com/truecaller-sdk/android/oauth-sdk-3.0.0/integration-steps/generating-client-id).

#### Expo

Add the plugin to your `app.json` / `app.config.js` — it automatically injects the client ID into `AndroidManifest.xml`:

```json
{
  "plugins": [
    [
      "@ajitpatel28/react-native-truecaller",
      { "androidClientId": "YOUR_CLIENT_ID" }
    ]
  ]
}
```

Then run `npx expo prebuild` (or `eas build`) to apply the changes.

#### Bare React Native

1. Add the Truecaller SDK client ID to your `AndroidManifest.xml` file inside the `<application>` tag:

```xml
<meta-data
  android:name="com.truecaller.android.sdk.ClientId"
  android:value="YOUR_CLIENT_ID"/>
```

Replace `YOUR_CLIENT_ID` with your actual Truecaller client ID.

2. Ensure your app has the `INTERNET` permission in the `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## Usage

```typescript
import React, { useEffect } from 'react';
import { View, Button } from 'react-native';
import { useTruecaller } from '@ajitpatel28/react-native-truecaller';
const TruecallerLoginComponent = () => {
  const {
    initializeTruecallerSDK,
    openTruecallerForVerification,
    isSdkUsable,
    userProfile,
    error
  } = useTruecaller({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    iosAppKey: 'YOUR_IOS_APP_KEY',
    iosAppLink: 'YOUR_IOS_APP_LINK',
    androidSuccessHandler: handleBackendValidation,
  });
  useEffect(() => {
// Initialize the Truecaller SDK when the component mounts
    initializeTruecallerSDK();
  }, []);
  const handleTruecallerLogin = async () => {
    try {
      await openTruecallerForVerification();
// The userProfile will be updated automatically if verification is successful
    } catch (err) {
      console.error('Truecaller login error:', err);
// Handle error
    }
  };

  const handleBackendValidation = async (data) => {
    // do server side validation if needed
  }

  useEffect(() => {
    if (userProfile) {
      console.log('Truecaller profile:', userProfile);
// Handle successful login, e.g., navigate to a new screen or update app state
    }
  }, [userProfile]);
  useEffect(() => {
    if (error) {
      console.error('Truecaller error:', error);
// Handle error, e.g., show an error message to the user
    }
  }, [error]);
  return (
    <View>
      <Button title="Login with Truecaller" onPress={handleTruecallerLogin} />
  </View>
);
};
export default TruecallerLoginComponent;
```

## API

### `useTruecaller(config: TruecallerConfig)`

A custom hook that provides access to Truecaller functionality.

#### Parameters

- `config`: `TruecallerConfig` object with the following properties:
  - `androidClientId`: (string) Your Android client ID
  - `iosAppKey`: (string) Your iOS app key
  - `iosAppLink`: (string) Your iOS app link
  - `androidButtonColor`: (optional) Color of the Truecaller button on Android
  - `androidButtonTextColor`: (optional) Text color of the Truecaller button on Android
  - `androidButtonShape`: (optional) Shape of the Truecaller button on Android
  - `androidButtonText`: (optional) Text displayed on the Truecaller button on Android
  - `androidFooterButtonText`: (optional) Text displayed on the footer button on Android
  - `androidConsentHeading`: (optional) Heading text for the consent screen on Android
  - `androidConsentMode`: (optional) Controls how the consent UI is presented on Android. Accepted values: `'TRUECALLER_ANDROID_CONSENT_MODE_BOTTOMSHEET'` (default) or `'TRUECALLER_ANDROID_CONSENT_MODE_POPUP'`
  - `androidSdkOptions`: (optional) Controls which users can be verified on Android. Accepted values: `'TRUECALLER_ANDROID_SDK_OPTION_VERIFY_ONLY_TC_USERS'` (default) or `'TRUECALLER_ANDROID_SDK_OPTION_VERIFY_ALL_USERS'`
  - `androidDarkMode`: (optional, boolean) When `true`, forces dark mode on the consent UI. When `false`, forces light mode. Omit to follow the system theme.
  - `androidSuccessHandler`: (optional) Callback function invoked on Android when Truecaller succeeds with a response. It receives a parameter of type `TruecallerAndroidResponse` containing the success data. Pass this function if you want to do server side validation of the Truecaller response.

#### Returns

- `initializeTruecallerSDK(): Promise<void>`: Initializes the Truecaller SDK.
- `isTruecallerInitialized: boolean`: Returns true if the Truecaller SDK is initialized.
- `isSdkUsable(): Promise<boolean>`: Returns a promise that resolves to `true` if the Truecaller SDK is usable on the current device. Must be awaited.
- `openTruecallerForVerification(): Promise<void>`: Requests the user's Truecaller verification.
- `clearTruecallerSdk(): void`: Clears the SDK state and unregisters the activity result launcher. Android only.
- `userProfile`: The user's Truecaller profile (if available). For android, it will be available only if androidSuccessHandler is not provided then library will internally handle the validation and will return the userProfile
- `error`: Any error that occurred during the Truecaller operations.

## Constants

The library provides several constants for customization:

```typescript
import {
  TRUECALLER_ANDROID_CUSTOMIZATIONS,
  TRUECALLER_ANDROID_EVENTS,
  TRUECALLER_IOS_EVENTS,
  TRUECALLER_LANGUAGES,
} from '@ajitpatel28/react-native-truecaller';
```

### `TRUECALLER_ANDROID_EVENTS`

| Key                   | Value                                  | Description                                      |
| --------------------- | -------------------------------------- | ------------------------------------------------ |
| `ERROR`               | `'TruecallerAndroidError'`             | Emitted when an error occurs during verification |
| `VERIFICATION_REQUIRED` | `'TruecallerAndroidVerificationRequired'` | Emitted when additional verification is needed |

### `TRUECALLER_ANDROID_CUSTOMIZATIONS`

#### `CONSENT_MODES`

Controls how the consent UI is presented.

| Key           | Value                                           |
| ------------- | ----------------------------------------------- |
| `BOTTOMSHEET` | `'TRUECALLER_ANDROID_CONSENT_MODE_BOTTOMSHEET'` |
| `POPUP`       | `'TRUECALLER_ANDROID_CONSENT_MODE_POPUP'`       |

#### `SDK_OPTIONS`

Controls which users can be verified.

| Key                    | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| `VERIFY_ONLY_TC_USERS` | `'TRUECALLER_ANDROID_SDK_OPTION_VERIFY_ONLY_TC_USERS'` |
| `VERIFY_ALL_USERS`     | `'TRUECALLER_ANDROID_SDK_OPTION_VERIFY_ALL_USERS'`     |

The library also provides constants for button styles, event types, and supported languages through the same imports above.

## Types

The following types are exported for use in TypeScript projects:

```typescript
import type {
  TruecallerConsentModeKey,
  TruecallerConsentModeValue,
  TruecallerSdkOptionKey,
  TruecallerSdkOptionValue,
} from '@ajitpatel28/react-native-truecaller';
```

| Type                      | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `TruecallerConsentModeKey`   | Union of valid keys for `CONSENT_MODES`               |
| `TruecallerConsentModeValue` | Union of valid values for `CONSENT_MODES`             |
| `TruecallerSdkOptionKey`     | Union of valid keys for `SDK_OPTIONS`                 |
| `TruecallerSdkOptionValue`   | Union of valid values for `SDK_OPTIONS`               |

## Error Handling

The library throws errors in case of initialization or profile request failures. Implement proper error handling in your application using try-catch blocks or by checking the `error` value returned from the `useTruecaller` hook.

## Notes

- Ensure you have the necessary permissions set up in your app for accessing user information.
- Follow Truecaller's guidelines and policies when implementing this SDK in your application.
- For more detailed customization options, refer to the Truecaller SDK documentation for [Android](https://docs.truecaller.com/truecaller-sdk/android/getting-started) and [iOS](https://docs.truecaller.com/truecaller-sdk/ios/getting-started).

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with ❤️ by [Ajit Patel](https://github.com/ajitpatel28) and [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
