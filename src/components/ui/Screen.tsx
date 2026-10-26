import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../constants/tokens';
import { Text } from './Text';
import { Enter } from './Motion';

// Safe-area aware scrolling screen with a large title header.
// Each direct child fades in, staggered, every time the screen gains focus.
export function Screen({ title, subtitle, right, children, footer }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => { setVisit((v) => v + 1); }, []));
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {title ? (
          <Enter key={`h${visit}`} style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="display">{title}</Text>
              {subtitle ? <Text variant="bodySm" tone="muted" style={{ marginTop: 4 }}>{subtitle}</Text> : null}
            </View>
            {right}
          </Enter>
        ) : null}
        {items.map((child, i) => (
          <Enter key={`${visit}-${i}`} index={i + (title ? 1 : 0)}>{child}</Enter>
        ))}
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
