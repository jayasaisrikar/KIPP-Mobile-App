import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../constants/tokens';
import { Text } from './Text';

// Safe-area aware scrolling screen with a large title header.
export function Screen({ title, subtitle, right, children, footer }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {title ? (
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="display">{title}</Text>
              {subtitle ? <Text variant="bodySm" tone="muted" style={{ marginTop: 4 }}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
});
