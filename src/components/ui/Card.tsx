import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '../../constants/tokens';
import { Text } from './Text';

// coss ui <Card>: rounded-2xl, translucent border, card surface, soft shadow.
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {description ? <Text variant="bodySm" tone="muted" style={{ marginTop: 2 }}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function CardPanel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

export function Separator({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  panel: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
    backgroundColor: colors.muted,
  },
});
