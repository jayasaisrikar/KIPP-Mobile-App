import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { colors } from '../../src/constants/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
<Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon label="H" color={color as string} /> }} />
      <Tabs.Screen name="talk" options={{ title: 'Talk', tabBarIcon: ({ color }) => <TabIcon label="T" color={color as string} /> }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: ({ color }) => <TabIcon label="P" color={color as string} /> }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: ({ color }) => <TabIcon label="Y" color={color as string} /> }} />
    </Tabs>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
