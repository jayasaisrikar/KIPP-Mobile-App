import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing } from '../../src/constants/tokens';
import { KippFace } from '../../src/components/kipp/KippFace';
import { Card } from '../../src/components/ui/primitives';
import { useAppStore } from '../../src/stores/appStore';

type Action = { id: string; tool: string; state: 'proposed' | 'committed' | 'failed'; title: string; detail: string };

export default function TalkScreen() {
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const [input, setInput] = useState('');
  const [actions, setActions] = useState<Action[]>([]);
const scrollRef = useRef<any>(null);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now().toString(), conversationId: 'local', role: 'user' as const, content: text, createdAt: new Date().toISOString() };
    addMessage(userMsg);
    setInput('');
    setPhase('thinking');
    // Mocked assistant turn — deterministic, schema-shaped (PRD §8.1)
    setTimeout(() => {
      const reply = mockReply(text);
      const assistantMsg = { id: (Date.now() + 1).toString(), conversationId: 'local', role: 'assistant' as const, content: reply.text, emotion: reply.emotion, createdAt: new Date().toISOString() };
      addMessage(assistantMsg);
      if (reply.action) setActions((a) => [...a, reply.action!]);
      setPhase(reply.action ? 'action' : 'speaking');
      setTimeout(() => setPhase('idle'), 1200);
    }, 600);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
        <KippFace size={40} phase={phase} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>KIPP</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{phaseLabel(phase)}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
            <KippFace size={80} phase="idle" />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginTop: spacing.lg }}>Ask me anything.</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: spacing.sm, textAlign: 'center' }}>Tasks, reminders, calendar, memory — I’ll propose, you approve.</Text>
          </View>
        )}
        {messages.map((m) => (
          <View key={m.id} style={{ marginBottom: spacing.md, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '82%', backgroundColor: m.role === 'user' ? colors.accent : colors.surface, borderRadius: 18, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <Text style={{ color: m.role === 'user' ? colors.bg : colors.text, fontSize: 15, lineHeight: 22 }}>{m.content}</Text>
            </View>
          </View>
        ))}
        {actions.map((a) => (
          <ActionCard key={a.id} action={a} onApprove={() => {
            setActions((prev) => prev.map((x) => x.id === a.id ? { ...x, state: 'committed' } : x));
          }} onCancel={() => {
            setActions((prev) => prev.map((x) => x.id === a.id ? { ...x, state: 'failed' } : x));
          }} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft, backgroundColor: colors.bg }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message KIPP…"
          placeholderTextColor={colors.textDim}
          style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: 22, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.text, fontSize: 15, marginRight: spacing.sm }}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={() => send(input)} activeOpacity={0.8} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.bg, fontWeight: '700' }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function phaseLabel(p: string) {
  switch (p) {
    case 'listening': return 'Listening…';
    case 'thinking': return 'Thinking…';
    case 'speaking': return 'Speaking…';
    case 'action': return 'Action needs approval';
    default: return 'Ready';
  }
}

function ActionCard({ action, onApprove, onCancel }: { action: Action; onApprove: () => void; onCancel: () => void }) {
  const committed = action.state === 'committed';
  const failed = action.state === 'failed';
  return (
    <Card style={{ marginBottom: spacing.md, borderColor: committed ? colors.success : failed ? colors.danger : colors.accent }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>PROPOSED ACTION · {action.tool.toUpperCase()}</Text>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{action.title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{action.detail}</Text>
      <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 6 }}>State: {action.state}</Text>
      {!committed && !failed && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity onPress={onApprove} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center' }}>
            <Text style={{ color: colors.bg, fontWeight: '600' }}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
      {committed && <Text style={{ color: colors.success, fontSize: 12, marginTop: spacing.sm, fontWeight: '600' }}>✓ Committed</Text>}
      {failed && <Text style={{ color: colors.danger, fontSize: 12, marginTop: spacing.sm, fontWeight: '600' }}>✗ Cancelled</Text>}
    </Card>
  );
}

function mockReply(text: string): { text: string; emotion: 'neutral' | 'happy' | 'curious' | 'skeptical' | 'concerned'; action?: Action } {
  const lower = text.toLowerCase();
  if (lower.includes('remind')) {
    return {
      text: 'I can remind you. Save it?',
      emotion: 'neutral',
      action: { id: Date.now().toString(), tool: 'reminder.create', state: 'proposed', title: 'Reminder', detail: text },
    };
  }
  if (lower.includes('remember')) {
    return {
      text: 'Should I save that as a memory?',
      emotion: 'curious',
      action: { id: Date.now().toString(), tool: 'memory.save', state: 'proposed', title: 'Memory', detail: text },
    };
  }
  if (lower.includes('calendar') || lower.includes('meeting') || lower.includes('event')) {
    return {
      text: 'I can draft that event. Review before it’s saved?',
      emotion: 'neutral',
      action: { id: Date.now().toString(), tool: 'calendar.event.create', state: 'proposed', title: 'Calendar event', detail: text },
    };
  }
  if (lower.includes('task') || lower.includes('todo')) {
    return {
      text: 'Adding that as a task. Confirm?',
      emotion: 'neutral',
      action: { id: Date.now().toString(), tool: 'task.create', state: 'proposed', title: 'Task', detail: text },
    };
  }
  return { text: 'Got it. Anything else you want me to capture?', emotion: 'happy' };
}
