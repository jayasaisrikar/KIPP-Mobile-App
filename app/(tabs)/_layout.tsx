import { Redirect, Tabs } from 'expo-router';
import { colors } from '../../src/constants/tokens';
import { TabBar } from '../../src/components/kipp/TabBar';
import { useAppStore } from '../../src/stores/appStore';

export default function TabLayout() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="talk" options={{ title: 'Talk' }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
