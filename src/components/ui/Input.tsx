import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radii, shadows, spacing } from '../../constants/tokens';
import { Text } from './Text';

// coss ui <Input>: input border, popover surface, ring colour on focus.
export function Input({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.foreground}
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={[styles.input, focused && styles.focused, style]}
    />
  );
}

// coss ui <Field>: label + control + optional description.
export function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{label}</Text>
      {children}
      {description ? <Text variant="caption" tone="muted">{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.input,
    backgroundColor: colors.popover,
    paddingHorizontal: spacing.md,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 16,
    ...shadows.xs,
  },
  focused: { borderColor: colors.ring },
});
