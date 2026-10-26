import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, fonts, motion, radii, shadows, spacing } from '../../constants/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// coss ui <Toast>: short-lived feedback, stacked at the top of the screen.
export type ToastVariant = 'default' | 'success' | 'error' | 'info';
type ToastItem = { id: number; title: string; description?: string; variant: ToastVariant; action?: { label: string; onPress: () => void } };

const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));
let nextId = 1;

const dismiss = (id: number) => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));

export function toast(title: string, opts: { description?: string; variant?: ToastVariant; action?: ToastItem['action']; duration?: number } = {}) {
  const id = nextId++;
  // Keep at most three on screen.
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, title, description: opts.description, variant: opts.variant ?? 'default', action: opts.action }] }));
  setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 5000 : 3000));
}

const variantIcon: Record<ToastVariant, { name: IconName; color: string } | null> = {
  default: null,
  success: { name: 'check', color: colors.successForeground },
  error: { name: 'alert', color: colors.destructiveForeground },
  info: { name: 'info', color: colors.infoForeground },
};

/** Mount once, above the navigator. */
export function Toaster() {
  const items = useToasts((s) => s.items);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      {items.map((t) => <ToastView key={t.id} item={t} />)}
    </View>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const icon = variantIcon[item.variant];

  return (
    <Animated.View accessibilityLiveRegion="polite" style={[styles.toast, shadows.lg, { opacity: progress, transform: [{ translateY }] }]}>
      <View style={styles.row}>
        <Pressable style={styles.body} onPress={() => dismiss(item.id)} accessibilityRole="button" accessibilityLabel={`${item.title}. Dismiss`}>
          {icon ? <Icon name={icon.name} size={16} color={icon.color} /> : null}
          <View style={{ flex: 1 }}>
            <Text variant="label">{item.title}</Text>
            {item.description ? <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{item.description}</Text> : null}
          </View>
        </Pressable>
        {item.action ? (
          <Pressable
            hitSlop={8}
            onPress={() => { item.action?.onPress(); dismiss(item.id); }}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.accent }]}
          >
            <Text style={styles.actionText}>{item.action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm, alignItems: 'center', zIndex: 1000 },
  toast: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.popover,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingRight: spacing.lg },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.lg, paddingVertical: spacing.md },
  action: { paddingHorizontal: spacing.md, height: 30, justifyContent: 'center', borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.input },
  actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.foreground },
});
