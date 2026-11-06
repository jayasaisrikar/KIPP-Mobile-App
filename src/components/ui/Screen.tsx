import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, spacing } from '../../constants/tokens';
import { Text } from './Text';
import { Enter } from './Motion';

// Safe-area aware scrolling screen with a large title header.
// Each direct child fades in, staggered, every time the screen gains focus.
export function Screen({ title, subtitle, right, children, footer }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Android draws edge-to-edge, so the window no longer resizes for the keyboard; shrink the scroll area instead. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {title ? (
          <Enter style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="display">{title}</Text>
              {subtitle ? <Text variant="bodySm" tone="muted" style={{ marginTop: 4 }}>{subtitle}</Text> : null}
            </View>
            {right}
          </Enter>
        ) : null}
        {items.map((child, i) => (
          <Enter key={i}>{child}</Enter>
        ))}
      </ScrollView>
      </KeyboardAvoidingView>
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, backgroundImage: gradients.screen },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
});
