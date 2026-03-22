import { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';

import {
  TRUECALLER_ANDROID_CUSTOMIZATIONS,
  useTruecaller,
} from '@ajitpatel28/react-native-truecaller';

export default function App() {
  const truecallerConfig = {
    androidClientId: 'xxxxxxxx-android-client-id',
    androidButtonColor: '#212121',
    androidButtonTextColor: '#FFFFFF',
    androidButtonShape: TRUECALLER_ANDROID_CUSTOMIZATIONS.BUTTON_SHAPES.ROUNDED,
    androidButtonText: TRUECALLER_ANDROID_CUSTOMIZATIONS.BUTTON_TEXTS.ACCEPT,
    androidFooterButtonText:
      TRUECALLER_ANDROID_CUSTOMIZATIONS.FOOTER_TEXTS.ANOTHER_METHOD,
    androidConsentHeading:
      TRUECALLER_ANDROID_CUSTOMIZATIONS.CONSENT_HEADINGS.CHECKOUT_WITH,
  };
  const {
    initializeTruecallerSDK,
    openTruecallerForVerification,
    userProfile,
    error,
  } = useTruecaller(truecallerConfig);

  useEffect(() => {
    initializeTruecallerSDK();
  }, [initializeTruecallerSDK]);

  useEffect(() => {
    if (userProfile) console.log(userProfile);
  }, [userProfile]);

  useEffect(() => {
    if (error) console.log('Truecaller error:', error);
  }, [error]);

  return (
    <View style={styles.container}>
      <Pressable onPress={openTruecallerForVerification}>
        <Text>Sign in with truecaller</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
