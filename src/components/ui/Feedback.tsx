import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radii, spacing } from '../../constants/tokens';
import { useAppStore } from '../../stores/appStore';
import { Text } from './Text';

// coss ui <Skeleton>: a pulsing placeholder block.
export function Skeleton({ width = '100%', height = 14, radius = radii.sm, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeleton, opacity: pulse }, style]} />;
}

/** A list row placeholder matching ListItem's layout. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={32} height={32} radius={radii.md} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={13} />
        <Skeleton width="35%" height={11} />
      </View>
    </View>
  );
}

// coss ui <Avatar>: initials on a muted circle.
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.38, lineHeight: size * 0.5, color: colors.foreground }}>{initials}</Text>
    </View>
  );
}

// coss ui <Progress>: a thin track with an animated fill (value 0–1).
export function Progress({ value, label, detail }: { value: number; label?: string; detail?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  const [width, setWidth] = useState(0);
  const [anim] = useState(() => new Animated.Value(clamped));
  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim, clamped]);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });

  return (
    <View style={{ gap: spacing.xs }}>
      {label || detail ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {label ? <Text variant="caption" tone="muted">{label}</Text> : <View />}
          {detail ? <Text variant="caption" tone="muted">{detail}</Text> : null}
        </View>
      ) : null}
      <View
        style={styles.track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      >
        <Animated.View style={[styles.fill, { opacity: width ? 1 : 0, transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  avatar: { backgroundColor: colors.muted, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 3, backgroundColor: colors.primary },
});
