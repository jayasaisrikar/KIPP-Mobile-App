import React, { useEffect, useState } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Shared motion primitives. Reanimated honours the system "reduce motion" setting by default.

export const haptic = {
  tap: () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); },
  press: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
};

/** Fades and lifts its children in; `index` staggers siblings. */
export function Enter({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(Math.min(index, 8) * 55).springify().damping(18).stiffness(160)} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that sinks slightly while pressed. */
export function PressableScale({ scaleTo = 0.97, hapticOnPress = true, style, onPressIn, onPressOut, onPress, ...rest }: PressableProps & { scaleTo?: number; hapticOnPress?: boolean }) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  // Animated components can't take a style function, so resolve it with our own pressed state.
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { setPressed(true); scale.set(withSpring(scaleTo, { damping: 20, stiffness: 400 })); onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); scale.set(withSpring(1, { damping: 14, stiffness: 300 })); onPressOut?.(e); }}
      onPress={(e) => { if (hapticOnPress) haptic.tap(); onPress?.(e); }}
      style={[resolved, animated]}
    />
  );
}

/** Animates a number from its previous value to `value`. */
export function useCountUp(value: number, duration = 600) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const from = shown;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // Only re-run when the target changes; `shown` is the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return shown;
}

export { Animated };
