import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

// Loading expo-notifications inside Expo Go warns on every launch about remote push, which this
// app never uses, and its native module was removed from Expo Go on Android in SDK 53. Local
// reminders are the only thing scheduled here, and Expo Go is not a supported runtime for them,
// so the module is treated as unavailable there rather than loaded. Development builds get it:
// https://docs.expo.dev/develop/development-builds/introduction/
type NotificationsModule = typeof import('expo-notifications');
let mod: NotificationsModule | null | undefined;

export function notifications(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === 'web' || isRunningInExpoGo()) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule;
  } catch {
    mod = null;
  }
  return mod;
}
