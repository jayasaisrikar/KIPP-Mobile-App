import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '../../src/constants/tokens';
import { KippFace } from '../../src/components/kipp/KippFace';
import { Badge, Button, Card, CardHeader, Empty, ListItem, Screen, Separator, Text } from '../../src/components/ui';
import { useAppStore } from '../../src/stores/appStore';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

export default function HomeScreen() {
  const user = useAppStore((s) => s.user);
  const tasks = useAppStore((s) => s.tasks);
  const reminders = useAppStore((s) => s.reminders);
  const phase = useAppStore((s) => s.phase);
  const events = useAppStore((s) => s.events);
  const nowIso = new Date().toISOString();
  const openTasks = tasks
    .filter((t) => t.status === 'todo')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const activeReminders = reminders.filter((r) => r.enabled && r.triggerAt > nowIso);
  const todayTasks = openTasks.slice(0, 4);
  const soonEvents = events.filter((e) => (e.end ?? e.start) > nowIso).slice(0, 3);
  const dueReminders = activeReminders.slice(0, 3);
  const quiet = todayTasks.length === 0 && dueReminders.length === 0 && soonEvents.length === 0;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Talk to KIPP" icon="mic" size="lg" block onPress={() => router.navigate('/talk')} />
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="muted">{greeting()}, {user?.nickname || user?.displayName || 'there'}</Text>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {quiet ? 'Nothing urgent. Remarkable.' : 'A few things worth remembering.'}
          </Text>
        </View>
        <KippFace size={60} phase={phase} />
      </View>

      <View style={styles.stats}>
        <Stat label="Open tasks" value={openTasks.length} />
        <Stat label="Reminders" value={activeReminders.length} />
      </View>

      <Card>
        <CardHeader title="Next up" description="From your calendar and tasks" action={<Button label="All" variant="ghost" size="sm" iconRight="chevronRight" onPress={() => router.navigate('/plans')} />} />
        {soonEvents.map((e, i) => (
          <React.Fragment key={e.id}>
            <Separator inset={i === 0 ? 0 : spacing.lg} />
            <ListItem icon="calendar" iconColor={colors.infoForeground} title={e.title} description={e.allDay ? 'All day' : formatWhen(e.start)} />
          </React.Fragment>
        ))}
        {todayTasks.length === 0 && soonEvents.length === 0 ? (
          <Empty icon="task" title="Clear horizon" description="Nothing scheduled. Add a task or ask KIPP." />
        ) : (
          todayTasks.map((t, i) => (
            <React.Fragment key={t.id}>
              <Separator inset={i === 0 && soonEvents.length === 0 ? 0 : spacing.lg} />
              <ListItem icon="task" title={t.title} description={t.dueDate ? formatWhen(t.dueDate) : undefined} trailing={<Badge label={t.source} variant="outline" />} />
            </React.Fragment>
          ))
        )}
      </Card>

      <Card>
        <CardHeader title="Reminders" description="Firing soon" />
        {dueReminders.length === 0 ? (
          <Empty icon="bell" title="No reminders" description={'Say "remind me…" in Talk to create one.'} />
        ) : (
          dueReminders.map((r, i) => (
            <React.Fragment key={r.id}>
              <Separator inset={i === 0 ? 0 : spacing.lg} />
              <ListItem icon="bell" iconColor={colors.warningForeground} title={r.title} description={`${formatWhen(r.triggerAt)} · ${r.timezone}`} />
            </React.Fragment>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.stat}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="h1" style={{ marginTop: 2 }}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, padding: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border, backgroundColor: colors.background },
});
