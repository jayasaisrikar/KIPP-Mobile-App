import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { ease } from '../ui/Motion';
import type { Tabs } from 'expo-router';
import { colors, fonts } from '../../constants/tokens';
import { Icon, PressableScale, Text, type IconName } from '../ui';

const tabIcons: Record<string, IconName> = { index: 'home', talk: 'chat', plans: 'plans', you: 'you' };
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const hiddenOn = new Set(['talk']);

// Floating glass pill; the active tab expands into a teal capsule with its label.
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  if (hiddenOn.has(state.routes[state.index].name)) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          return (
            <Animated.View key={route.key} layout={LinearTransition.duration(220).easing(ease)}>
              <PressableScale
                hapticOnPress
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !e.defaultPrevented) navigateToTab(route.key);
                }}
                style={[styles.item, focused && styles.itemActive]}
              >
                <Icon name={tabIcons[route.name] ?? 'home'} size={20} color={focused ? colors.white : colors.foreground} />
                {focused && <Text style={styles.label}>{label}</Text>}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(55,75,89,0.94)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
  },
  item: { height: 48, minWidth: 48, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  itemActive: { paddingHorizontal: 20, backgroundColor: colors.primary },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.white },
});
