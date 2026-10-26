import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, spacing } from '../../src/constants/tokens';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Badge, Button, Card, CardHeader, Empty, Field, Icon, Input, ListItem, Progress, Screen, SegmentedControl, Separator, Sheet, SkeletonRow, Switch, Text, haptic, toast } from '../../src/components/ui';
import { cancelReminder, createTask, scheduleReminder } from '../../src/lib/actions';
import { googleAccount, pushTaskDelete, pushTaskStatus, syncGoogle } from '../../src/lib/sync';
import { useAppStore } from '../../src/stores/appStore';
import type { Task } from '../../src/types';

const tabs = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'agenda', label: 'Agenda' },
] as const;

const dueOptions = [
  { value: 'none', label: 'No date' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
] as const;
type Due = (typeof dueOptions)[number]['value'];

// Today at 6pm (or in an hour if that's passed), tomorrow at 9am.
function dueDateFor(due: Due): string | undefined {
  if (due === 'none') return undefined;
  const d = new Date();
  if (due === 'today') {
    d.setHours(18, 0, 0, 0);
    if (d.getTime() <= Date.now()) return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function PlansScreen() {
  const tasks = useAppStore((s) => s.tasks);
  const setTasks = useAppStore((s) => s.setTasks);
  const reminders = useAppStore((s) => s.reminders);
  const setReminders = useAppStore((s) => s.setReminders);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<(typeof tabs)[number]['value']>('tasks');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDue, setNewDue] = useState<Due>('none');

  const events = useAppStore((s) => s.events);
  const connected = useAppStore((s) => s.accounts.some((a) => a.provider === 'google' && a.status === 'connected'));
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const refresh = async () => {
    setSyncing(true);
    setSyncError(null);
    try { await syncGoogle(); } catch (e) { setSyncError(e instanceof Error ? e.message : 'Sync failed.'); }
    setSyncing(false);
  };

  const toggleTask = (id: string) => {
    const next = tasks.map((t) => t.id === id ? { ...t, status: t.status === 'done' ? 'todo' as const : 'done' as const, updatedAt: new Date().toISOString() } : t);
    setTasks(next);
    const changed = next.find((t) => t.id === id);
    if (changed?.status === 'done') haptic.success();
    if (changed && googleAccount()) pushTaskStatus(changed);
  };
  const deleteTask = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    setTasks(tasks.filter((x) => x.id !== id));
    if (t.externalId) {
      // Already removed from Google, so undo would only restore it locally — skip it.
      pushTaskDelete(t);
      toast('Task deleted');
      return;
    }
    toast('Task deleted', { action: { label: 'Undo', onPress: () => setTasks([t, ...useAppStore.getState().tasks]) } });
  };
  const addDraft = () => {
    if (!draft.trim()) return;
    createTask({ title: draft.trim() });
    setDraft('');
  };
  const openSheet = () => {
    setNewTitle(draft);
    setNewNotes('');
    setNewDue('none');
    setSheetOpen(true);
  };
  const addFromSheet = () => {
    if (!newTitle.trim()) return;
    createTask({ title: newTitle.trim(), notes: newNotes.trim() || undefined, dueDate: dueDateFor(newDue) });
    setDraft('');
    setSheetOpen(false);
    toast('Task added', { variant: 'success', description: newDue === 'none' ? undefined : `Due ${formatWhen(dueDateFor(newDue)!)}` });
  };
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  // Open tasks first, newest first; completed at the bottom.
  const sortedTasks = [...tasks].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));

  const toggleReminder = async (id: string, enabled: boolean) => {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    await cancelReminder(r);
    const notificationId = enabled ? await scheduleReminder(r) : undefined;
    setReminders(useAppStore.getState().reminders.map((x) => x.id === id ? { ...x, enabled, notificationId, updatedAt: new Date().toISOString() } : x));
  };
  const deleteReminder = async (id: string) => {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    await cancelReminder(r);
    setReminders(useAppStore.getState().reminders.filter((x) => x.id !== id));
    toast('Reminder deleted', {
      action: {
        label: 'Undo',
        onPress: async () => {
          const notificationId = r.enabled ? await scheduleReminder(r) : undefined;
          setReminders([...useAppStore.getState().reminders, { ...r, notificationId }].sort((a, b) => a.triggerAt.localeCompare(b.triggerAt)));
        },
      },
    });
  };

  return (
    <Screen title="Plans" subtitle="Tasks, reminders, and agenda">
      <SegmentedControl options={tabs} value={tab} onChange={setTab} />

      {tab === 'tasks' && (
        <Card>
          <CardHeader title="Tasks" action={<Badge label={`${tasks.filter((t) => t.status === 'todo').length} open`} />} />
          {tasks.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
              <Progress value={doneCount / tasks.length} label="Progress" detail={`${doneCount} of ${tasks.length} done`} />
            </View>
          ) : null}
          <View style={styles.addRow}>
            <Input value={draft} onChangeText={setDraft} placeholder="Add a task…" returnKeyType="done" onSubmitEditing={addDraft} style={{ flex: 1 }} />
            {draft.trim()
              ? <Button size="icon" icon="check" accessibilityLabel="Add task" onPress={addDraft} />
              : <Button size="icon" variant="outline" icon="plus" accessibilityLabel="New task with details" onPress={openSheet} />}
          </View>
          {tasks.length === 0 ? (
            <Empty icon="task" title="No tasks yet" description="Type one above, or ask KIPP in Talk." />
          ) : (
            sortedTasks.map((t) => (
              <React.Fragment key={t.id}>
                <Separator />
                <TaskRow task={t} onToggle={() => toggleTask(t.id)} onDelete={() => deleteTask(t.id)} />
              </React.Fragment>
            ))
          )}
        </Card>
      )}

      {tab === 'reminders' && (
        <Card>
          <CardHeader title="Reminders" action={<Badge label={`${reminders.filter((r) => r.enabled).length} active`} />} />
          {reminders.length === 0 ? (
            <Empty icon="bell" title="No reminders" description={'Say "remind me…" in Talk.'}>
              <Button label="Open Talk" variant="outline" size="sm" icon="talk" onPress={() => router.navigate('/talk')} />
            </Empty>
          ) : (
            reminders.map((r) => (
              <React.Fragment key={r.id}>
                <Separator />
                <ListItem
                  icon="bell"
                  iconColor={r.enabled ? colors.warningForeground : colors.mutedForeground}
                  title={r.title}
                  description={`${formatWhen(r.triggerAt)} · ${r.timezone}`}
                  muted={!r.enabled}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Switch value={r.enabled} accessibilityLabel={`Reminder ${r.title}`} onValueChange={(v) => toggleReminder(r.id, v)} />
                      <Button size="icon-sm" variant="ghost" icon="trash" accessibilityLabel="Delete reminder" onPress={() => deleteReminder(r.id)} />
                    </View>
                  }
                />
              </React.Fragment>
            ))
          )}
        </Card>
      )}

      {tab === 'agenda' && (
        <Card>
          <CardHeader
            title="Agenda"
            description="Next 14 days from Google Calendar"
            action={connected ? <Button size="icon-sm" variant="ghost" icon="restore" accessibilityLabel="Refresh" disabled={syncing} onPress={refresh} /> : undefined}
          />
          {!connected ? (
            <Empty icon="calendar" title="No calendar connected" description="Connect Google in You → Apps to see your agenda here.">
              <Button label="Connect calendar" variant="outline" size="sm" icon="apps" onPress={() => router.navigate({ pathname: '/you', params: { section: 'apps' } })} />
            </Empty>
          ) : events.length === 0 && syncing ? (
            <>
              {[0, 1, 2].map((i) => <React.Fragment key={i}><Separator /><SkeletonRow /></React.Fragment>)}
            </>
          ) : events.length === 0 ? (
            <Empty icon="calendar" title="Nothing scheduled" description="No events in the next two weeks." />
          ) : (
            events.map((e) => (
              <React.Fragment key={e.id}>
                <Separator />
                <ListItem icon="calendar" title={e.title} description={[e.allDay ? new Date(e.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · All day' : formatWhen(e.start), e.location].filter(Boolean).join(' · ')} />
              </React.Fragment>
            ))
          )}
          {syncError ? <Text variant="caption" tone="destructive" style={{ padding: spacing.lg }}>{syncError}</Text> : null}
        </Card>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="New task"
        description={googleAccount() ? 'Also added to Google Tasks.' : undefined}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setSheetOpen(false)} style={{ flex: 1 }} />
            <Button label="Add task" icon="check" disabled={!newTitle.trim()} onPress={addFromSheet} style={{ flex: 1 }} />
          </>
        }
      >
        <Field label="Title">
          <Input value={newTitle} onChangeText={setNewTitle} placeholder="What needs doing?" autoFocus returnKeyType="next" />
        </Field>
        <Field label="Notes" description="Optional">
          <Input value={newNotes} onChangeText={setNewNotes} placeholder="Details, links…" multiline style={{ height: 88, paddingTop: 10, textAlignVertical: 'top' }} />
        </Field>
        <Field label="Due">
          <SegmentedControl options={dueOptions} value={newDue} onChange={setNewDue} />
        </Field>
      </Sheet>
    </Screen>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const done = task.status === 'done';
  return (
    <ListItem
      onPress={onToggle}
      title={task.title}
      description={task.dueDate ? formatWhen(task.dueDate) : undefined}
      muted={done}
      leading={
        <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: done }} hitSlop={8}>
          <View style={[styles.checkbox, done && styles.checkboxOn]}>
            {done && <Animated.View entering={ZoomIn.springify().damping(12)}><Icon name="check" size={13} color={colors.primaryForeground} /></Animated.View>}
          </View>
        </Pressable>
      }
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {task.source === 'google' ? <Badge label="Google" variant="outline" /> : task.syncState === 'failed' ? <Badge label="Not synced" variant="warning" /> : null}
          <Button size="icon-sm" variant="ghost" icon="trash" accessibilityLabel="Delete task" onPress={onDelete} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.ring, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
