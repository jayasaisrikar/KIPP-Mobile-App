import React from 'react';
import { Pressable, StyleSheet, Switch as RNSwitch, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../constants/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  description?: string;
  icon?: IconName;
  iconColor?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
};

// A row inside a Card: optional icon tile, title/description, trailing slot.
export function ListItem({ title, description, icon, iconColor = colors.mutedForeground, leading, trailing, onPress, muted, style }: Props) {
  const body = (
    <>
      {leading ?? (icon ? (
        <View style={styles.iconTile}>
          <Icon name={icon} size={16} color={iconColor} />
        </View>
      ) : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" tone={muted ? 'muted' : 'default'} style={muted ? styles.strike : null} numberOfLines={2}>{title}</Text>
        {description ? <Text variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>{description}</Text> : null}
      </View>
      {trailing}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.accent }, style]}>
      {body}
    </Pressable>
  );
}

export function Switch({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel?: string }) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.input, true: colors.primary }}
      thumbColor={value ? colors.primaryForeground : colors.mutedForeground}
      ios_backgroundColor={colors.input}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strike: { textDecorationLine: 'line-through' },
});
