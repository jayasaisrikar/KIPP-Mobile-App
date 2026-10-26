import { useEffect, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { reloadAppAsync } from 'expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { colors, resolveScheme, scheme, themePreference } from '../src/constants/tokens';
import { Toaster } from '../src/components/ui';
import { useAppStore } from '../src/stores/appStore';
import { syncGoogle } from '../src/lib/sync';
import { notifications } from '../src/lib/notifications';

SplashScreen.preventAutoHideAsync();

notifications()?.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function useHydrated() {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const hydrated = useHydrated();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    syncGoogle().catch(() => {});
  }, [ready]);

  // Styles are built from the palette at startup, so follow system appearance changes by reloading.
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      if (themePreference === 'system' && resolveScheme('system') !== scheme) reloadAppAsync().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
      <Toaster />
    </>
  );
}
