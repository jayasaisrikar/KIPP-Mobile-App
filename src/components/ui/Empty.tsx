import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, shadows, spacing } from '../../constants/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// coss ui <Empty>: icon media tile, title, description, optional actions.
export function Empty({ icon = 'inbox', title, description, children }: { icon?: IconName; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.media}>
        <Icon name={icon} size={18} color={colors.mutedForeground} />
      </View>
      <Text variant="h3" style={{ textAlign: 'center' }}>{title}</Text>
      {description ? <Text variant="bodySm" tone="muted" style={styles.description}>{description}</Text> : null}
      {children ? <View style={{ marginTop: spacing.lg, alignSelf: 'stretch', alignItems: 'center' }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  media: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  description: { textAlign: 'center', marginTop: spacing.xs, maxWidth: 280 },
});
