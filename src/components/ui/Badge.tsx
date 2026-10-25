import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fonts, radii } from '../../constants/tokens';
import { Text } from './Text';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive';

const variantStyle: Record<BadgeVariant, { bg: string; fg: string; border?: string; dot?: string }> = {
  default: { bg: colors.primary, fg: colors.primaryForeground },
  secondary: { bg: colors.secondary, fg: colors.foreground },
  outline: { bg: 'transparent', fg: colors.foreground, border: colors.input },
  success: { bg: colors.successTint, fg: colors.successForeground, dot: colors.success },
  warning: { bg: colors.warningTint, fg: colors.warningForeground, dot: colors.warning },
  info: { bg: colors.infoTint, fg: colors.infoForeground, dot: colors.info },
  destructive: { bg: colors.destructiveTint, fg: colors.destructiveForeground, dot: colors.destructive },
};

export function Badge({ label, variant = 'secondary', dot }: { label: string; variant?: BadgeVariant; dot?: boolean }) {
  const v = variantStyle[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, v.border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: v.border } : null]}>
      {dot ? <View style={[styles.dot, { backgroundColor: v.dot ?? v.fg }]} /> : null}
      <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radii.sm, paddingHorizontal: 7, height: 22 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
});
