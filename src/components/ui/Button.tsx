import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from './Motion';
import { colors, fonts, radii, shadows, spacing } from '../../constants/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// Mirrors coss ui <Button> variants and sizes, scaled up to 44pt touch targets.
export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'destructive-outline';
export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm';

type Props = {
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const variantStyle: Record<ButtonVariant, { bg: string; pressedBg: string; fg: string; border?: string; shadow?: boolean }> = {
  default: { bg: colors.primary, pressedBg: colors.primaryPressed, fg: colors.primaryForeground, shadow: true },
  secondary: { bg: colors.secondary, pressedBg: colors.accent, fg: colors.foreground },
  outline: { bg: colors.popover, pressedBg: colors.surfacePressed, fg: colors.foreground, border: colors.input, shadow: true },
  ghost: { bg: 'transparent', pressedBg: colors.accent, fg: colors.foreground },
  destructive: { bg: colors.destructive, pressedBg: colors.destructivePressed, fg: colors.white, shadow: true },
  'destructive-outline': { bg: colors.popover, pressedBg: colors.destructiveTint, fg: colors.destructiveForeground, border: colors.input, shadow: true },
};

const sizeStyle: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number; iconSize: number; width?: number }> = {
  sm: { height: 36, paddingHorizontal: spacing.md, fontSize: 14, iconSize: 15 },
  default: { height: 44, paddingHorizontal: spacing.lg, fontSize: 15, iconSize: 17 },
  lg: { height: 50, paddingHorizontal: spacing.xl, fontSize: 16, iconSize: 18 },
  icon: { height: 44, width: 44, paddingHorizontal: 0, fontSize: 15, iconSize: 18 },
  'icon-sm': { height: 36, width: 36, paddingHorizontal: 0, fontSize: 14, iconSize: 16 },
};

export function Button({ label, onPress, variant = 'default', size = 'default', icon, iconRight, disabled, block, style, accessibilityLabel }: Props) {
  const v = variantStyle[variant];
  const s = sizeStyle[size];
  return (
    <PressableScale
      scaleTo={size === 'icon' || size === 'icon-sm' ? 0.9 : 0.97}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={size === 'icon-sm' ? 6 : undefined}
      style={({ pressed }) => [
        styles.base,
        { height: s.height, width: s.width, paddingHorizontal: s.paddingHorizontal, backgroundColor: pressed ? v.pressedBg : v.bg },
        v.border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: v.border } : null,
        v.shadow ? shadows.xs : null,
        block && styles.block,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={s.iconSize} color={v.fg} /> : null}
      {label ? <Text style={{ fontFamily: fonts.medium, fontSize: s.fontSize, lineHeight: s.fontSize + 6, color: v.fg }}>{label}</Text> : null}
      {iconRight ? <View style={{ opacity: 0.72 }}><Icon name={iconRight} size={s.iconSize - 2} color={v.fg} /></View> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.lg },
  block: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
});
