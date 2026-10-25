import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// expo-notifications throws on import in Expo Go for Android (its native module was removed there),
// so it is loaded lazily and treated as unavailable in that case.
type NotificationsModule = typeof import('expo-notifications');
let mod: NotificationsModule | null | undefined;

export function notifications(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === 'web') return mod;
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule;
  } catch {
    mod = null;
  }
  return mod;
}
