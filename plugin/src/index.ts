import {
  ConfigPlugin,
  withAndroidManifest,
  AndroidConfig,
} from '@expo/config-plugins';

type TruecallerPluginProps = {
  androidClientId: string;
};

const CLIENT_ID_META_NAME = 'com.truecaller.android.sdk.ClientId';

const withTruecaller: ConfigPlugin<TruecallerPluginProps> = (
  config,
  { androidClientId }
) => {
  return withAndroidManifest(config, (modConfig) => {
    const application = AndroidConfig.Manifest.getMainApplication(
      modConfig.modResults
    );

    if (!application) {
      throw new Error(
        '[react-native-truecaller] Could not find <application> in AndroidManifest.xml'
      );
    }

    // Remove existing entry to avoid duplicates on re-runs
    application['meta-data'] = (application['meta-data'] ?? []).filter(
      (item) => item.$?.['android:name'] !== CLIENT_ID_META_NAME
    );

    application['meta-data'].push({
      $: {
        'android:name': CLIENT_ID_META_NAME,
        'android:value': androidClientId,
      },
    });

    return modConfig;
  });
};

export default withTruecaller;
