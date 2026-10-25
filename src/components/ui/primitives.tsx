import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../constants/tokens';

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderSoft }, style]}>{children}</View>;
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={{ backgroundColor: disabled ? colors.surface2 : colors.accent, borderRadius: radii.pill, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: disabled ? colors.textMuted : colors.bg, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ borderRadius: radii.pill, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600' }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>{subtitle}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: spacing.sm }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl }}>{body}</Text>
    </View>
  );
}
