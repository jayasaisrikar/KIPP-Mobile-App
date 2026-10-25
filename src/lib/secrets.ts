import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Storage from './storage';

const KEY = 'kipp.opencode.apiKey';

export async function getApiKey(): Promise<string | null> {
  const stored = Platform.OS === 'web' ? await Storage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return stored || process.env.EXPO_PUBLIC_OPENCODE_API_KEY || null;
}

export async function setApiKey(value: string | null) {
  const v = value?.trim();
  if (Platform.OS === 'web') {
    if (v) await Storage.setItem(KEY, v); else await Storage.removeItem(KEY);
    return;
  }
  if (v) await SecureStore.setItemAsync(KEY, v); else await SecureStore.deleteItemAsync(KEY);
}
