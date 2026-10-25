import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, radii, shadows } from '../../constants/tokens';
import { Text } from './Text';

// coss ui <Tabs> / <Segmented Control>: muted track, raised active segment.
export function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.active]}
          >
            <Text numberOfLines={1} style={[styles.label, { color: active ? colors.foreground : colors.mutedForeground }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radii.lg, padding: 3, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  segment: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, paddingHorizontal: 6 },
  active: { backgroundColor: colors.input, ...shadows.xs },
  label: { fontFamily: fonts.medium, fontSize: 14 },
});
