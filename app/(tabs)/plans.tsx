import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../src/constants/tokens';
import { Card, SectionTitle, EmptyState } from '../../src/components/ui/primitives';
import { useAppStore } from '../../src/stores/appStore';
import type { Task } from '../../src/types';

export default function PlansScreen() {
  const tasks = useAppStore((s) => s.tasks);
  const setTasks = useAppStore((s) => s.setTasks);
  const reminders = useAppStore((s) => s.reminders);
  const [tab, setTab] = useState<'tasks' | 'reminders' | 'agenda'>('tasks');

  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>Plans</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>Tasks, reminders, and agenda</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        {(['tasks', 'reminders', 'agenda'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 16, backgroundColor: tab === t ? colors.accent : colors.surface2 }}>
            <Text style={{ color: tab === t ? colors.bg : colors.textMuted, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'tasks' && (
        <Card>
          <SectionTitle title="Tasks" subtitle={`${tasks.filter((t) => t.status === 'todo').length} open`} />
          {tasks.length === 0 ? (
            <EmptyState title="No tasks yet" body="Ask KIPP to add one, or create manually." />
          ) : (
            tasks.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggleTask(t.id)} />)
          )}
        </Card>
      )}

      {tab === 'reminders' && (
        <Card>
          <SectionTitle title="Reminders" subtitle={`${reminders.filter((r) => r.enabled).length} active`} />
          {reminders.length === 0 ? (
            <EmptyState title="No reminders" body="Say 'remind me' in Talk." />
          ) : (
            reminders.map((r) => (
              <View key={r.id} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{r.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{new Date(r.triggerAt).toLocaleString()} · {r.timezone}</Text>
              </View>
            ))
          )}
        </Card>
      )}

      {tab === 'agenda' && (
        <Card>
          <SectionTitle title="Agenda" subtitle="Connect Google Calendar in You → Connected apps" />
          <EmptyState title="No calendar connected" body="Connect Google Calendar to see your agenda here." />
        </Card>
      )}
    </ScrollView>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: task.status === 'done' ? colors.success : colors.border, backgroundColor: task.status === 'done' ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        {task.status === 'done' && <Text style={{ color: colors.bg, fontSize: 12, fontWeight: '700' }}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: task.status === 'done' ? colors.textDim : colors.text, fontSize: 15, fontWeight: '500', textDecorationLine: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</Text>
        {task.dueDate && <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{new Date(task.dueDate).toLocaleString()}</Text>}
      </View>
      <Text style={{ color: colors.textDim, fontSize: 11 }}>{task.source}</Text>
    </TouchableOpacity>
  );
}
