import {
  ConfigPlugin,
  withAndroidManifest,
  withInfoPlist,
  withEntitlementsPlist,
  withDangerousMod,
  withAppDelegate,
  withAppBuildGradle,
  withGradleProperties,
  AndroidConfig,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

type TruecallerPluginProps = {
  androidClientId: string;
  iosAppKey?: string;
  iosAppLink?: string;
};

const CLIENT_ID_META_NAME = 'com.truecaller.android.sdk.ClientId';

const withTruecaller: ConfigPlugin<TruecallerPluginProps> = (
  config,
  { androidClientId, iosAppKey, iosAppLink }
) => {
  // Android: truecaller-sdk 3.3.0 needs Java 21. This library's own module
  // already opts out of RN's forced Java 17 (android/gradle.properties);
  // :app needs the same opt-out + a Java 21 compileOptions bump, since it
  // reads this library's now-Java-21-compiled classes via autolinking.
  // Exempting :app from RN's alignment disables it app-wide (RN checks the
  // app project first, short-circuiting its whole per-module loop), which
  // can make other Kotlin dependencies hit "Inconsistent JVM Target
  // Compatibility" — harmless on Android (all DEX either way), so we relax
  // that check to a warning instead of re-forcing every dependency's target
  // ourselves (kotlin.jvm.target.validation.mode, see
  // https://kotlinlang.org/docs/gradle-configure-project.html).
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      const appGradlePropertiesPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'gradle.properties'
      );
      const marker = 'react.internal.disableJavaVersionAlignment';
      let contents = fs.existsSync(appGradlePropertiesPath)
        ? fs.readFileSync(appGradlePropertiesPath, 'utf8')
        : '';
      if (!contents.includes(marker)) {
        if (contents.length > 0 && !contents.endsWith('\n')) {
          contents += '\n';
        }
        contents += `${marker}=true\n`;
        fs.writeFileSync(appGradlePropertiesPath, contents);
      }
      return modConfig;
    },
  ]);

  config = withAppBuildGradle(config, (modConfig) => {
    const marker = '// @ajitpatel28/react-native-truecaller: Java 21';
    if (!modConfig.modResults.contents.includes(marker)) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /(\bandroid\s*\{)/,
        `$1\n    ${marker}\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_21\n        targetCompatibility JavaVersion.VERSION_21\n    }`
      );
    }
    return modConfig;
  });

  config = withGradleProperties(config, (modConfig) => {
    const propName = 'kotlin.jvm.target.validation.mode';
    modConfig.modResults = modConfig.modResults.filter(
      (item) => !(item.type === 'property' && item.key === propName)
    );
    modConfig.modResults.push({
      type: 'property',
      key: propName,
      value: 'warning',
    });
    return modConfig;
  });

  // Android: inject ClientId meta-data
  config = withAndroidManifest(config, (modConfig) => {
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

  // iOS: Info.plist — LSApplicationQueriesSchemes + URL scheme
  if (iosAppKey) {
    config = withInfoPlist(config, (modConfig) => {
      // LSApplicationQueriesSchemes
      const queriesSchemes: string[] =
        modConfig.modResults.LSApplicationQueriesSchemes ?? [];
      if (!queriesSchemes.includes('truesdk')) {
        queriesSchemes.push('truesdk');
      }
      modConfig.modResults.LSApplicationQueriesSchemes = queriesSchemes;

      // URL scheme: truecallersdk-<iosAppKey>
      const urlScheme = `truecallersdk-${iosAppKey}`;
      const urlTypes: any[] = modConfig.modResults.CFBundleURLTypes ?? [];
      const alreadyRegistered = urlTypes.some((entry) =>
        (entry.CFBundleURLSchemes ?? []).includes(urlScheme)
      );
      if (!alreadyRegistered) {
        urlTypes.push({
          CFBundleURLSchemes: [urlScheme],
        });
      }
      modConfig.modResults.CFBundleURLTypes = urlTypes;

      return modConfig;
    });
  }

  // iOS: Entitlements — Associated Domains
  if (iosAppLink) {
    config = withEntitlementsPlist(config, (modConfig) => {
      const domain = iosAppLink.replace(/^https?:\/\//, '');
      const applink = `applinks:${domain}`;
      const domains: string[] =
        (modConfig.modResults[
          'com.apple.developer.associated-domains'
        ] as string[]) ?? [];
      if (!domains.includes(applink)) {
        domains.push(applink);
      }
      modConfig.modResults['com.apple.developer.associated-domains'] = domains;
      return modConfig;
    });
  }

  // iOS: AppDelegate — forward universal links to TrueSDK
  if (iosAppKey) {
    config = withAppDelegate(config, (modConfig) => {
      let contents = modConfig.modResults.contents;
      const marker = 'ReactNativeTruecaller.handle(';
      if (contents.includes(marker)) return modConfig;

      if (modConfig.modResults.language === 'swift') {
        contents = contents.replace(
          /(\bcontinue userActivity:[^\n]+\n[\s\S]*?-> Bool \{)/,
          `$1\n    if ReactNativeTruecaller.handle(userActivity, restorationHandler: restorationHandler) {\n      return true\n    }`
        );
      } else {
        contents = contents.replace(
          /(continueUserActivity:\(NSUserActivity \*\)userActivity[\s\S]*?restorationHandler:\([^)]+\)restorationHandler\s*\{)/,
          `$1\n  if ([ReactNativeTruecaller handle:userActivity restorationHandler:restorationHandler]) {\n    return YES;\n  }`
        );
      }

      modConfig.modResults.contents = contents;
      return modConfig;
    });

    // iOS: Bridging header — expose ReactNativeTruecaller to Swift
    config = withDangerousMod(config, [
      'ios',
      (modConfig) => {
        const projectRoot = modConfig.modRequest.platformProjectRoot;
        const importLine =
          '#import <ajit_react_native_truecaller/ReactNativeTruecaller.h>';

        const findBridgingHeader = (dir: string): string | null => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('-Bridging-Header.h')) {
              return path.join(dir, entry.name);
            }
            if (
              entry.isDirectory() &&
              !entry.name.startsWith('.') &&
              entry.name !== 'Pods'
            ) {
              const nested = path.join(dir, entry.name);
              for (const sub of fs.readdirSync(nested, {
                withFileTypes: true,
              })) {
                if (sub.isFile() && sub.name.endsWith('-Bridging-Header.h')) {
                  return path.join(nested, sub.name);
                }
              }
            }
          }
          return null;
        };

        const headerPath = findBridgingHeader(projectRoot);
        if (headerPath) {
          let contents = fs.readFileSync(headerPath, 'utf8');
          if (!contents.includes(importLine)) {
            contents = importLine + '\n' + contents;
            fs.writeFileSync(headerPath, contents);
          }
        }

        return modConfig;
      },
    ]);
  }

  // iOS: Podfile — TrueSDK modular headers + Assets.car conflict fix
  config = withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'Podfile'
      );
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // 1. Add `pod 'TrueSDK', :modular_headers => true` before the first
      //    use_frameworks! line so the Swift pod can import TrueSDK as a module.
      const podLine = "  pod 'TrueSDK', :modular_headers => true";
      if (!podfile.includes(podLine)) {
        podfile = podfile.replace(
          /^( {2}use_frameworks!)/m,
          `${podLine}\n\n$1`
        );
      }

      // 2. Add at_exit fix after react_native_post_install(...) call, inserting
      //    before the closing `end` of the post_install block.
      const atExitFix = [
        '',
        '    # Fix "Multiple commands produce Assets.car" from TrueSDK xcassets conflict.',
        "    pbxproj_path = File.join(__dir__, Dir['*.xcodeproj'].first || '', 'project.pbxproj')",
        '    at_exit do',
        '      if File.exist?(pbxproj_path)',
        '        lines = File.readlines(pbxproj_path)',
        '        filtered = lines.reject do |line|',
        "          (line.include?('TrueSDK') && line.include?('.xcassets')) ||",
        "          (line.include?('Assets.car') && line.include?('TARGET_BUILD_DIR'))",
        '        end',
        '        File.write(pbxproj_path, filtered.join) if filtered.length != lines.length',
        '      end',
        '    end',
      ].join('\n');

      if (!podfile.includes('at_exit')) {
        // Insert before the `  end` that closes the post_install block
        // (the second-to-last `end` in the file, right before the target `end`)
        podfile = podfile.replace(
          /(\n {2}end\n+end\s*\n?$)/,
          `${atExitFix}\n$1`
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return modConfig;
    },
  ]);

  return config;
};

export default withTruecaller;
