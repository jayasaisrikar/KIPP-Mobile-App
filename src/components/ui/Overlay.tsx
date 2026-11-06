import React, { useEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radii, shadows, spacing } from '../../constants/tokens';
import { Button } from './Button';
import { Text } from './Text';

// Keeps the Modal mounted while the exit animation runs.
function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [progress] = useState(() => new Animated.Value(0));
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      Animated.timing(progress, { toValue: 1, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: motion.base, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, progress]);

  return { mounted, progress };
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

// coss ui <Sheet side="bottom">: a panel that slides up over a dimmed backdrop.
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const { mounted, progress } = usePresence(open);
  const insets = useSafeAreaInsets();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [480, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetRoot} behavior="padding">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View style={[styles.sheet, shadows.lg, { paddingBottom: Math.max(insets.bottom, spacing.lg), transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.sheetHeader}>
              <Text variant="h2">{title}</Text>
              {description ? <Text variant="bodySm" tone="muted" style={{ marginTop: 4 }}>{description}</Text> : null}
            </View>
          ) : null}
          <View style={styles.sheetBody}>{children}</View>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

// coss ui <AlertDialog>: a centred confirmation with cancel + confirm actions.
export function Dialog({ open, onClose, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, onConfirm }: DialogProps) {
  const { mounted, progress } = usePresence(open);
  const [busy, setBusy] = useState(false);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.dialogRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View accessibilityRole="alert" style={[styles.dialog, shadows.lg, { opacity: progress, transform: [{ scale }] }]}>
          <View style={{ padding: spacing.xl, gap: spacing.sm }}>
            <Text variant="h2">{title}</Text>
            {description ? <Text variant="bodySm" tone="muted">{description}</Text> : null}
          </View>
          <View style={styles.dialogFooter}>
            <Button label={cancelLabel} variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
            <Button label={busy ? 'Working…' : confirmLabel} variant={destructive ? 'destructive' : 'default'} onPress={confirm} disabled={busy} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.popover,
    borderTopLeftRadius: radii.xxl + 4,
    borderTopRightRadius: radii.xxl + 4,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.input, marginTop: spacing.sm },
  sheetHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  sheetBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md },
  sheetFooter: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  dialogRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.popover,
    borderRadius: radii.xxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dialogFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
    backgroundColor: colors.muted,
  },
});
