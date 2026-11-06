import React, { useState } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion } from '../../constants/tokens';
import * as Haptics from 'expo-haptics';

export const ease = Easing.bezier(...motion.easing);
/** Standard content entrance: a quiet fade, no movement, no overshoot. */
export const fadeIn = FadeIn.duration(motion.base).easing(ease);

// Shared motion primitives. Reanimated honours the system "reduce motion" setting by default.

export const haptic = {
  tap: () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); },
  press: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
};

/** Fades its children in once on mount. `index` is accepted for compatibility but no longer staggers. */
export function Enter({ children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={fadeIn} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that dims and sinks very slightly while pressed. Haptics are opt-in. */
export function PressableScale({ scaleTo = 0.98, hapticOnPress = false, style, onPressIn, onPressOut, onPress, ...rest }: PressableProps & { scaleTo?: number; hapticOnPress?: boolean }) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const target = Math.max(scaleTo, 0.96);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }], opacity: 1 - (1 - scale.get()) * 4 }));
  // Animated components can't take a style function, so resolve it with our own pressed state.
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { setPressed(true); scale.set(withTiming(target, { duration: motion.fast, easing: ease })); onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); scale.set(withTiming(1, { duration: motion.base, easing: ease })); onPressOut?.(e); }}
      onPress={(e) => { if (hapticOnPress) haptic.tap(); onPress?.(e); }}
      style={[resolved, animated]}
    />
  );
}

/** Numbers render as-is; counting tickers read as gimmicky. Kept for API compatibility. */
export function useCountUp(value: number) {
  return value;
}

export { Animated };
