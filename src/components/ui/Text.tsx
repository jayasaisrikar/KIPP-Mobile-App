import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { colors, typography } from '../../constants/tokens';

export type TextVariant = keyof typeof typography;
export type TextTone = 'default' | 'muted' | 'destructive' | 'success' | 'warning' | 'info' | 'inverse';

const toneColor: Record<TextTone, string> = {
  default: colors.foreground,
  muted: colors.mutedForeground,
  destructive: colors.destructiveForeground,
  success: colors.successForeground,
  warning: colors.warningForeground,
  info: colors.infoForeground,
  inverse: colors.primaryForeground,
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps & { variant?: TextVariant; tone?: TextTone }) {
  return <RNText {...rest} style={[typography[variant], { color: toneColor[tone] }, style]} />;
}
