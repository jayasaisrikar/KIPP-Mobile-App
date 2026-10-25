import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../src/constants/tokens';
import { KippFace } from '../../src/components/kipp/KippFace';
import { Card, SectionTitle, EmptyState } from '../../src/components/ui/primitives';
import { useAppStore } from '../../src/stores/appStore';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning.';
  if (h < 17) return 'Afternoon.';
  return 'Evening.';
};

export default function HomeScreen() {
  const user = useAppStore((s) => s.user);
  const tasks = useAppStore((s) => s.tasks);
  const reminders = useAppStore((s) => s.reminders);
  const phase = useAppStore((s) => s.phase);
  const setPhase = useAppStore((s) => s.setPhase);
  const todayTasks = tasks.filter((t) => t.status === 'todo').slice(0, 4);
  const dueReminders = reminders.filter((r) => r.enabled).slice(0, 3);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
        <View>
          <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>{greeting().toUpperCase()}</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginTop: 2 }}>
            {user?.nickname || user?.displayName || 'there'}. {todayTasks.length === 0 && dueReminders.length === 0 ? 'Nothing urgent. Remarkable.' : 'A few things worth remembering.'}
          </Text>
        </View>
        <KippFace size={64} phase={phase} />
      </View>

      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle title="Next up" subtitle="From your calendar and tasks" />
        {todayTasks.length === 0 ? (
          <EmptyState title="Clear horizon" body="Nothing scheduled. Add a task or ask KIPP." />
        ) : (
          todayTasks.map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: spacing.md }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t.title}</Text>
                {t.dueDate ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{new Date(t.dueDate).toLocaleString()}</Text> : null}
              </View>
            </View>
          ))
        )}
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle title="Reminders" subtitle="Firing soon" />
        {dueReminders.length === 0 ? (
          <EmptyState title="No reminders" body="Say remind me to create one." />
        ) : (
          dueReminders.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning, marginRight: spacing.md }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{r.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{new Date(r.triggerAt).toLocaleString()} · {r.timezone}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <TouchableOpacity
        onPress={() => setPhase(phase === 'idle' ? 'listening' : 'idle')}
        activeOpacity={0.85}
        style={{ position: 'absolute', bottom: 24, left: spacing.lg, right: spacing.lg, backgroundColor: colors.accent, borderRadius: 28, paddingVertical: spacing.lg, alignItems: 'center', shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 }}
      >
        <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '700' }}>Talk to KIPP</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
