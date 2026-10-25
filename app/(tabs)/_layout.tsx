import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';
import { colors, fonts } from '../../src/constants/tokens';
import { Icon, type IconName } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';

export default function TabLayout() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth * 2,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="talk" options={{ title: 'Talk', tabBarIcon: tabIcon('talk') }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: tabIcon('plans') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: tabIcon('you') }} />
    </Tabs>
  );
}

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={22} color={color} />;
  };
}
