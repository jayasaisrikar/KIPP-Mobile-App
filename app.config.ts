import type { ExpoConfig, ConfigContext } from 'expo/config';

// Google Sign-In needs the reversed iOS client ID as a URL scheme at build time.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosUrlScheme = iosClientId ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}` : undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    // The plugin only adds the iOS URL scheme and fails without one; Android needs no plugin.
    ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, unknown]] : []),
  ],
});
