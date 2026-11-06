import React, { useState, useRef } from 'react';
import { View, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts, gradients, spacing } from '../../src/constants/tokens';
import { Orb } from '../../src/components/kipp/Orb';
import Animated from 'react-native-reanimated';
import { fadeIn } from '../../src/components/ui/Motion';
import { Button, Icon, PressableScale, Progress, Skeleton, Text, haptic, type IconName } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';
import { runTurn } from '../../src/lib/conversation';
import { speakReply, stopSpeaking } from '../../src/lib/speech';
import { downloadVoiceModels, startHandsFree, stopHandsFree, useHandsFree, voiceStateLabel } from '../../src/lib/handsfree';
import { commitAction, describeAction } from '../../src/lib/actions';
import { useVoiceInput } from '../../src/lib/voice';
import type { ProposedAction } from '../../src/types';

const suggestions = ['Remind me to call mom at 6pm', 'Remember that I prefer window seats', 'Add a task to renew my passport'];

export default function TalkScreen() {
  const messages = useAppStore((s) => s.messages);
  const setMessages = useAppStore((s) => s.setMessages);
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'voice' | 'chat'>('chat');
  const scrollRef = useRef<ScrollViewInstance>(null);
  const hf = useHandsFree();
  const thinking = busy || (hf.listening && phase === 'thinking');
  const canSend = input.trim().length > 0 && !thinking;

  const send = async (text: string) => {
    if (!text.trim() || thinking) return;
    stopSpeaking();
    setError(null);
    setInput('');
    setBusy(true);
    const result = await runTurn(text);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setPhase('idle');
    } else if (result.turn.proposedActions.length) {
      setPhase('action');
      if (voiceEnabled) speakReply(result.turn.reply);
    } else if (voiceEnabled && Platform.OS !== 'web') {
      speakReply(result.turn.reply);
    } else {
      setPhase('idle');
    }
  };

  const toggleHandsFree = async () => {
    if (hf.listening) { await stopHandsFree(); setPhase('idle'); return; }
    stopSpeaking();
    if (voice.listening) voice.stop();
    await startHandsFree();
  };
  const handsFreeReady = hf.available && !!hf.models?.ready;

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
    if (hf.listening) { await stopHandsFree(); setPhase('idle'); return; } // one mic user at a time
    stopSpeaking();
    setError(null);
    setPhase('listening');
    if (!(await voice.start())) setPhase('idle');
  };

  // Home can deep-link a prompt (?prompt=…&t=…); send it once per tap.
  const params = useLocalSearchParams<{ prompt?: string; t?: string }>();
  const [handled, setHandled] = useState<string | undefined>(undefined);
  if (params.prompt && params.t && params.t !== handled) {
    setHandled(params.t);
    setMode('chat');
    setTimeout(() => send(params.prompt!), 0);
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const transcript = voice.listening ? voice.transcript : hf.listening ? hf.lastHeard ?? '' : lastUser?.content ?? '';
  const words = transcript.split(' ');

  const clear = () => { stopSpeaking(); setMessages([]); useAppStore.getState().setConversationId(null); setError(null); setPhase('idle'); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, backgroundImage: mode === 'voice' ? gradients.talk : gradients.screen }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.header}>
            <RoundButton icon="arrowLeft" label="Back" onPress={() => (mode === 'voice' ? setMode('chat') : router.navigate('/'))} />
            <PressableScale onPress={() => setMode(mode === 'voice' ? 'chat' : 'voice')} style={styles.modelPill}>
              <Text style={styles.modelText}>KIPP · {phaseLabel(phase)}</Text>
              <Icon name="chevronDown" size={10} color={colors.foreground} />
            </PressableScale>
            {mode === 'chat' ? (
              <RoundButton icon="compose" label="New conversation" onPress={clear} />
            ) : (
              <RoundButton icon="more" label="Chat view" onPress={() => setMode('chat')} />
            )}
          </View>

          {mode === 'voice' ? (
            <View style={{ flex: 1 }}>
              <View style={styles.voiceCenter}>
                <Orb size={260} phase={phase} />
              </View>
              <View style={styles.transcriptWrap}>
                {transcript ? (
                  <Text style={styles.transcript}>
                    {words.map((w, i) => (
                      <Text key={i} style={{ opacity: i < Math.min(3, words.length - 1) ? 0.45 : 1 }}>{w}{i < words.length - 1 ? ' ' : ''}</Text>
                    ))}
                  </Text>
                ) : (
                  <Text style={[styles.transcript, { opacity: 0.55 }]}>
                    {hf.listening ? voiceStateLabel(hf.state, hf.inConversation) : handsFreeReady ? 'Tap to go hands-free.\nThen just say "Hey KIPP".' : `Tap the mic and${'\n'}say anything.`}
                  </Text>
                )}
                {hf.listening && transcript ? (
                  <Text variant="label" tone="muted" style={{ textAlign: 'center', marginTop: spacing.md }}>{voiceStateLabel(hf.state, hf.inConversation)}</Text>
                ) : null}
                {hf.available && !hf.models?.ready ? (
                  <View style={styles.downloadCard}>
                    <Text variant="label">Give KIPP ears and a real voice</Text>
                    <Text variant="caption" tone="muted">Wake word, speech recognition and a natural voice, all running on this phone. One-time download of about 380 MB. Wi-Fi recommended.</Text>
                    {hf.download.active ? (
                      <Progress value={hf.download.fraction} label="Downloading" detail={`${Math.round(hf.download.fraction * 100)}%`} />
                    ) : (
                      <Button label={hf.download.error ? 'Retry download' : 'Download'} icon="sparkles" size="sm" onPress={downloadVoiceModels} />
                    )}
                    {hf.download.error ? <Text variant="caption" tone="destructive">{hf.download.error}</Text> : null}
                  </View>
                ) : null}
                {voice.error || hf.error ? <Text variant="bodySm" tone="destructive" style={{ textAlign: 'center', marginTop: spacing.md }}>{voice.error || hf.error}</Text> : null}
              </View>
              <View style={styles.voiceControls}>
                <RoundButton icon="scan" label="Clear" size={64} onPress={clear} />
                <View style={styles.micRing}>
                  {handsFreeReady ? (
                    <PressableScale scaleTo={0.96} hapticOnPress onPress={toggleHandsFree} accessibilityRole="switch" accessibilityState={{ checked: hf.listening }} accessibilityLabel={hf.listening ? 'Turn off hands-free listening' : 'Turn on hands-free listening'} style={[styles.mic, hf.listening && { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.primary }]}>
                      <Icon name={hf.listening ? 'stop' : 'voice'} size={38} color={hf.listening ? colors.primary : colors.white} />
                    </PressableScale>
                  ) : (
                    <PressableScale scaleTo={0.96} hapticOnPress onPress={toggleVoice} accessibilityRole="button" accessibilityLabel={voice.listening ? 'Stop listening' : 'Talk to KIPP'} style={[styles.mic, voice.listening && { backgroundColor: colors.destructive }]}>
                      <Icon name={voice.listening ? 'stop' : 'voice'} size={38} color={colors.white} />
                    </PressableScale>
                  )}
                </View>
                <RoundButton icon="chat" label="Chat view" size={64} onPress={() => setMode('chat')} />
              </View>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={styles.thread}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 && (
                  <View style={styles.empty}>
                    <Orb size={160} phase={phase} />
                    <Text style={styles.emptyTitle}>Ask me anything.</Text>
                    <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center', maxWidth: 280 }}>Tasks, reminders, calendar, memory — I’ll propose, you approve.</Text>
                    <View style={styles.suggestions}>
                      {suggestions.map((s, i) => (
                        <Animated.View key={s} entering={fadeIn}>
                          <PressableScale onPress={() => send(s)} style={styles.suggestion}>
                            <Icon name="chat" size={16} color={colors.mutedForeground} />
                            <Text variant="bodySm" numberOfLines={1} style={{ flex: 1 }}>{s}</Text>
                            <Icon name="chevronRight" size={13} color={colors.mutedForeground} />
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
                      <Animated.View entering={fadeIn} style={mine ? styles.userRow : styles.kippRow}>
                        {mine ? (
                          <View style={styles.userBubble}>
                            <Text style={styles.msgText}>{m.content}</Text>
                          </View>
                        ) : (
                          <>
                            <View style={styles.avatar}><Icon name="sparkles" size={15} color={colors.white} /></View>
                            <Text style={[styles.msgText, { flex: 1, paddingTop: 6 }]}>{m.content}</Text>
                          </>
                        )}
                      </Animated.View>
                      {m.actions?.map((a, i) => (
                        <Animated.View key={a.id} entering={fadeIn}>
                          <ActionCard action={a} onApprove={() => approve(m.id, a)} onCancel={() => reject(m.id, a)} />
                        </Animated.View>
                      ))}
                    </View>
                  );
                })}
                {thinking && (
                  <Animated.View entering={fadeIn} style={styles.kippRow}>
                    <View style={styles.avatar}><Icon name="sparkles" size={15} color={colors.white} /></View>
                    <View accessibilityLabel="KIPP is thinking" style={{ flex: 1, gap: 8, paddingTop: 10 }}>
                      <Skeleton width="80%" height={10} />
                      <Skeleton width="50%" height={10} />
                    </View>
                  </Animated.View>
                )}
                {(voice.error || error) && (
                  <View style={styles.errorCard}>
                    <Text variant="bodySm" tone="destructive" style={{ flex: 1 }}>{voice.error || error}</Text>
                    {error?.includes('Settings') && <Button label="Settings" variant="outline" size="sm" onPress={() => router.navigate({ pathname: '/you', params: { section: 'settings' } })} />}
                    <Button size="icon-sm" variant="ghost" icon="close" accessibilityLabel="Dismiss" onPress={() => { voice.clearError(); setError(null); }} />
                  </View>
                )}
              </ScrollView>

              <View style={styles.composerBar}>
                <PressableScale onPress={() => setMode('voice')} accessibilityLabel="Voice mode" hitSlop={8}><Icon name="voice" size={22} color={colors.foreground} /></PressableScale>
                <PressableScale onPress={toggleVoice} accessibilityLabel={voice.listening ? 'Stop listening' : 'Dictate'} hitSlop={8}>
                  <Icon name={voice.listening ? 'stop' : 'mic'} size={22} color={voice.listening ? colors.destructiveForeground : colors.foreground} />
                </PressableScale>
                <View style={styles.composer}>
                  <TextInput
                    value={voice.listening ? voice.transcript : input}
                    onChangeText={setInput}
                    placeholder={voice.listening ? 'Listening…' : 'Type something..'}
                    placeholderTextColor={colors.mutedForeground}
                    selectionColor={colors.primary}
                    style={styles.composerInput}
                    onSubmitEditing={() => send(input)}
                    returnKeyType="send"
                    multiline
                    submitBehavior="submit"
                    editable={!thinking && !voice.listening}
                  />
                  <PressableScale onPress={() => send(input)} disabled={!canSend} accessibilityLabel="Send" style={[styles.send, !canSend && { opacity: 0.5 }]}>
                    <Icon name="paperplane" size={15} color={colors.white} />
                  </PressableScale>
                </View>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function RoundButton({ icon, label, onPress, size = 44 }: { icon: IconName; label: string; onPress: () => void; size?: number }) {
  return (
    <PressableScale scaleTo={0.96} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name={icon} size={size > 50 ? 24 : 18} color={colors.foreground} />
    </PressableScale>
  );
}

function phaseLabel(p: string) {
  switch (p) {
    case 'listening': return 'Listening';
    case 'thinking': return 'Thinking';
    case 'speaking': return 'Speaking';
    case 'action': return 'Needs approval';
    default: return 'Ready';
  }
}

function ActionCard({ action, onApprove, onCancel }: { action: ProposedAction & { result?: string }; onApprove: () => void; onCancel: () => void }) {
  const { title, detail } = describeAction(action);
  const pending = action.state === 'proposed' || action.state === 'approved';
  const status =
    action.state === 'committed' ? { label: 'Saved', tone: 'success' as const }
      : action.state === 'failed' ? { label: 'Failed', tone: 'destructive' as const }
        : action.state === 'rejected' ? { label: 'Cancelled', tone: 'muted' as const } : null;
  return (
    <View style={styles.actionCard}>
      <Text style={styles.actionKind}>{title}</Text>
      {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      {action.result ? <Text variant="caption" tone={action.state === 'failed' ? 'destructive' : 'success'}>{action.result}</Text> : null}
      <View style={styles.actionFooter}>
        <Icon name="alarm" size={22} color={colors.foreground} />
        <View style={{ flex: 1 }} />
        {pending ? (
          <>
            <PressableScale onPress={onCancel} disabled={action.state === 'approved'} style={styles.actionPill}><Text style={styles.actionPillText}>Cancel</Text></PressableScale>
            <PressableScale onPress={onApprove} disabled={action.state === 'approved'} style={[styles.actionPill, { backgroundColor: colors.primary }]}>
              <Text style={[styles.actionPillText, { color: colors.white }]}>{action.state === 'approved' ? 'Saving…' : 'Confirm'}</Text>
            </PressableScale>
          </>
        ) : status ? <Text variant="label" tone={status.tone}>{status.label}</Text> : null}
      </View>
    </View>
  );
}

const glass = { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.09)' } as const;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  round: { alignItems: 'center', justifyContent: 'center', ...glass },
  modelPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(220,20,60,0.18)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(240,67,95,0.35)' },
  modelText: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },

  voiceCenter: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxxl },
  downloadCard: { marginTop: spacing.xl, padding: spacing.lg, gap: spacing.sm, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  transcriptWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  transcript: { fontFamily: fonts.regular, fontSize: 28, lineHeight: 42, letterSpacing: -0.8, textAlign: 'center', color: colors.foreground },
  voiceControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingBottom: spacing.xl },
  micRing: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.06)', boxShadow: '0 0 40px rgba(220,20,60,0.25)' },
  mic: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, boxShadow: '0 8px 30px rgba(220,20,60,0.55)' },

  thread: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1, gap: spacing.md },
  empty: { alignItems: 'center', paddingTop: spacing.xl },
  emptyTitle: { fontFamily: fonts.regular, fontSize: 22, color: colors.foreground, marginTop: spacing.lg },
  suggestions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xxl },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 16, borderRadius: 999, ...glass },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  userBubble: { maxWidth: '82%', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, ...glass },
  kippRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(220,20,60,0.3)' },
  msgText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.foreground },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 18, backgroundColor: colors.destructiveTint },

  actionCard: { marginLeft: 42, marginTop: spacing.sm, padding: 18, gap: 6, borderRadius: 22, ...glass },
  actionKind: { fontFamily: fonts.regular, fontSize: 16, color: colors.foreground },
  actionDetail: { fontFamily: fonts.regular, fontSize: 24, color: colors.foreground, letterSpacing: -0.3 },
  actionFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  actionPill: { height: 34, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  actionPillText: { fontFamily: fonts.medium, fontSize: 13, color: colors.foreground },

  composerBar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  composer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 50, paddingLeft: 18, paddingRight: 6, borderRadius: 999, ...glass },
  composerInput: { flex: 1, maxHeight: 120, paddingVertical: 12, color: colors.foreground, fontFamily: fonts.regular, fontSize: 16 },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
