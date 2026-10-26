import React, { useState, useRef } from 'react';
import { View, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { colors, fonts, radii, shadows, spacing } from '../../src/constants/tokens';
import { KippFace } from '../../src/components/kipp/KippFace';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Badge, Button, Card, Icon, PressableScale, Skeleton, Text, haptic, type BadgeVariant } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';
import { askKipp, KippError } from '../../src/lib/kipp';
import { commitAction, describeAction } from '../../src/lib/actions';
import { useVoiceInput } from '../../src/lib/voice';
import type { Message, ProposedAction } from '../../src/types';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const suggestions = ['Remind me to call mom at 6pm', 'Remember that I prefer window seats', 'Add a task to renew my passport'];

export default function TalkScreen() {
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const setMessages = useAppStore((s) => s.setMessages);
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const canSend = input.trim().length > 0 && !busy;

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    Speech.stop();
    setError(null);
    const userMsg: Message = { id: newId(), conversationId: 'local', role: 'user', content: text.trim(), createdAt: new Date().toISOString() };
    addMessage(userMsg);
    setInput('');
    setBusy(true);
    setPhase('thinking');
    try {
      const turn = await askKipp(useAppStore.getState().messages);
      addMessage({ id: turn.turnId, conversationId: 'local', role: 'assistant', content: turn.reply, emotion: turn.emotion, actions: turn.proposedActions, createdAt: new Date().toISOString() });
      if (turn.proposedActions.length) {
        setPhase('action');
      } else if (voiceEnabled && Platform.OS !== 'web') {
        setPhase('speaking');
        Speech.speak(turn.reply, { onDone: () => setPhase('idle'), onStopped: () => setPhase('idle'), onError: () => setPhase('idle') });
      } else {
        setPhase('idle');
      }
    } catch (e) {
      setError(e instanceof KippError ? e.message : 'Something went wrong. Try again.');
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  };

  const voice = useVoiceInput((text) => { setPhase('idle'); if (text) send(text); });

  const updateAction = (messageId: string, actionId: string, patch: Partial<ProposedAction> & { result?: string }) => {
    const current = useAppStore.getState().messages;
    setMessages(current.map((m) => m.id !== messageId ? m : { ...m, actions: m.actions?.map((a) => a.id === actionId ? { ...a, ...patch } : a) }));
  };

  const approve = async (messageId: string, action: ProposedAction) => {
    updateAction(messageId, action.id, { state: 'approved' });
    try {
      const result = await commitAction(action);
      updateAction(messageId, action.id, { state: 'committed', result });
      haptic.success();
    } catch (e) {
      updateAction(messageId, action.id, { state: 'failed', result: e instanceof Error ? e.message : 'Could not save this.' });
    }
    if (!useAppStore.getState().messages.some((m) => m.actions?.some((a) => a.state === 'proposed'))) setPhase('idle');
  };

  const reject = (messageId: string, action: ProposedAction) => {
    updateAction(messageId, action.id, { state: 'rejected' });
    if (!useAppStore.getState().messages.some((m) => m.actions?.some((a) => a.state === 'proposed'))) setPhase('idle');
  };

  const toggleVoice = async () => {
    if (voice.listening) { voice.stop(); return; }
    Speech.stop();
    setError(null);
    setPhase('listening');
    if (!(await voice.start())) setPhase('idle');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <KippFace size={36} phase={phase} />
          <View style={{ flex: 1 }}>
            <Text variant="h3">KIPP</Text>
            <Text variant="caption" tone="muted">Your companion</Text>
          </View>
          <Badge {...phaseBadge(phase)} dot />
          {messages.length > 0 && (
            <Button size="icon-sm" variant="ghost" icon="trash" accessibilityLabel="Clear conversation" onPress={() => { Speech.stop(); setMessages([]); useAppStore.getState().setConversationId(null); setError(null); setPhase('idle'); }} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={styles.empty}>
              <KippFace size={80} phase="idle" />
              <Text variant="h2" style={{ marginTop: spacing.lg }}>Ask me anything.</Text>
              <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center', maxWidth: 280 }}>Tasks, reminders, calendar, memory — I’ll propose, you approve.</Text>
              <View style={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <Animated.View key={s} entering={FadeInDown.delay(150 + i * 70).springify().damping(18)}>
                    <PressableScale onPress={() => send(s)} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.accent }]}>
                      <Icon name="sparkles" size={14} color={colors.mutedForeground} />
                      <Text variant="bodySm" style={{ flex: 1 }}>{s}</Text>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            </View>
          )}
          {messages.map((m) => {
            const mine = m.role === 'user';
            return (
              <View key={m.id}>
                <Animated.View
                  entering={(mine ? FadeInUp : FadeInDown).duration(320).springify().damping(18)}
                  style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleUser : styles.bubbleKipp]}>
                    <Text variant="body" tone={mine ? 'inverse' : 'default'} style={{ fontSize: 15, lineHeight: 22 }}>{m.content}</Text>
                  </View>
                </Animated.View>
                {m.actions?.map((a, i) => (
                  <Animated.View key={a.id} entering={FadeInDown.delay(180 + i * 80).springify().damping(16)}>
                    <ActionCard action={a} onApprove={() => approve(m.id, a)} onCancel={() => reject(m.id, a)} />
                  </Animated.View>
                ))}
              </View>
            );
          })}
          {busy && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
              <View accessibilityLabel="KIPP is thinking" style={[styles.bubble, styles.bubbleKipp, { width: 200, gap: 8, paddingVertical: 14 }]}>
                <Skeleton width="90%" height={10} />
                <Skeleton width="60%" height={10} />
              </View>
            </Animated.View>
          )}
          {voice.error && (
            <Card style={{ borderColor: colors.destructiveTint, marginTop: spacing.sm }}>
              <View style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Text variant="bodySm" tone="destructive" style={{ flex: 1 }}>{voice.error}</Text>
                <Button size="icon-sm" variant="ghost" icon="close" accessibilityLabel="Dismiss" onPress={voice.clearError} />
              </View>
            </Card>
          )}
          {error && (
            <Card style={{ borderColor: colors.destructiveTint, marginTop: spacing.sm }}>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <Text variant="bodySm" tone="destructive">{error}</Text>
                {error.includes('Settings') && <Button label="Open settings" variant="outline" size="sm" icon="settings" onPress={() => router.navigate({ pathname: '/you', params: { section: 'settings' } })} />}
              </View>
            </Card>
          )}
        </ScrollView>

        <View style={styles.composerBar}>
          <View style={styles.composer}>
            <TextInput
              value={voice.listening ? voice.transcript : input}
              onChangeText={setInput}
              placeholder={voice.listening ? 'Listening… tap stop when done' : 'Message KIPP…'}
              placeholderTextColor={colors.mutedForeground}
              selectionColor={colors.foreground}
              style={styles.composerInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              multiline
              submitBehavior="submit"
              editable={!busy && !voice.listening}
            />
            {canSend || busy ? (
              <Button size="icon-sm" icon="send" disabled={!canSend} accessibilityLabel="Send" onPress={() => send(input)} />
            ) : (
              <Button
                size="icon-sm"
                variant={voice.listening ? 'destructive' : 'secondary'}
                icon={voice.listening ? 'stop' : 'mic'}
                accessibilityLabel={voice.listening ? 'Stop listening' : 'Talk to KIPP'}
                onPress={toggleVoice}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function phaseBadge(p: string): { label: string; variant: BadgeVariant } {
  switch (p) {
    case 'listening': return { label: 'Listening', variant: 'info' };
    case 'thinking': return { label: 'Thinking', variant: 'warning' };
    case 'speaking': return { label: 'Speaking', variant: 'info' };
    case 'action': return { label: 'Needs approval', variant: 'warning' };
    default: return { label: 'Ready', variant: 'success' };
  }
}

function ActionCard({ action, onApprove, onCancel }: { action: ProposedAction & { result?: string }; onApprove: () => void; onCancel: () => void }) {
  const { title, detail } = describeAction(action);
  const pending = action.state === 'proposed' || action.state === 'approved';
  const badge: { label: string; variant: BadgeVariant } =
    action.state === 'committed' ? { label: 'Saved', variant: 'success' }
      : action.state === 'failed' ? { label: 'Failed', variant: 'destructive' }
        : action.state === 'rejected' ? { label: 'Cancelled', variant: 'outline' }
          : { label: 'Pending', variant: 'warning' };
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="overline" tone="muted">Proposed action</Text>
          <Badge {...badge} dot />
        </View>
        <Text variant="h3">{title}</Text>
        {detail ? <Text variant="bodySm" tone="muted">{detail}</Text> : null}
        {action.result ? <Text variant="caption" tone={action.state === 'failed' ? 'destructive' : 'success'}>{action.result}</Text> : null}
      </View>
      {pending && (
        <View style={styles.actionFooter}>
          <Button label="Cancel" variant="outline" size="sm" onPress={onCancel} disabled={action.state === 'approved'} style={{ flex: 1 }} />
          <Button label={action.state === 'approved' ? 'Saving…' : 'Approve'} icon="check" size="sm" onPress={onApprove} disabled={action.state === 'approved'} style={{ flex: 1 }} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.border },
  thread: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl },
  suggestions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xxl },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.sm },
  bubble: { maxWidth: '82%', borderRadius: radii.xxl, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: radii.sm },
  bubbleKipp: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border, borderBottomLeftRadius: radii.sm },
  actionFooter: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border, backgroundColor: colors.muted },
  composerBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border, backgroundColor: colors.background },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    minHeight: 48,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radii.xxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.input,
    backgroundColor: colors.popover,
    ...shadows.xs,
  },
  composerInput: { flex: 1, maxHeight: 120, paddingTop: 8, paddingBottom: 8, color: colors.foreground, fontFamily: fonts.regular, fontSize: 16 },
});
