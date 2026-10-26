import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, fonts, radii, shadows } from '../../constants/tokens';
import { haptic } from './Motion';
import { Text } from './Text';

const PAD = 3;
const BORDER = StyleSheet.hairlineWidth * 2;

// coss ui <Tabs> / <Segmented Control>: muted track with a raised indicator that slides to the active segment.
export function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const [width, setWidth] = useState(0);
  // onLayout width includes the track's border and padding.
  const segment = width ? (width - (PAD + BORDER) * 2) / options.length : 0;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const indicator = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(index * segment, { damping: 20, stiffness: 220 }) }],
  }));

  return (
    <View style={styles.track} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segment > 0 && <Animated.View style={[styles.indicator, indicator]} />}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { if (!active) { haptic.tap(); onChange(o.value); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Text numberOfLines={1} style={[styles.label, { color: active ? colors.foreground : colors.mutedForeground }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radii.lg, padding: PAD, borderWidth: BORDER, borderColor: colors.border },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radii.md, backgroundColor: colors.input, ...shadows.xs },
  segment: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  label: { fontFamily: fonts.medium, fontSize: 14 },
});
