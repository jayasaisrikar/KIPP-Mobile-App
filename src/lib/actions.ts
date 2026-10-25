import { Platform } from 'react-native';
import { notifications } from './notifications';
import { taskSchema, reminderSchema, memorySchema, calendarEventSchema } from './schemas';
import { useAppStore } from '../stores/appStore';
import type { ProposedAction, Reminder, Task } from '../types';
import { createCalendarEvent } from './google';
import { googleAccount, pushTask } from './sync';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tz = () => useAppStore.getState().user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const validDate = (iso?: string) => (iso && !Number.isNaN(new Date(iso).getTime()) ? new Date(iso).toISOString() : undefined);

export async function ensureNotificationPermission() {
  const Notifications = notifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleReminder(r: Reminder): Promise<string | undefined> {
  if (Platform.OS === 'web' || new Date(r.triggerAt).getTime() <= Date.now()) return undefined;
  const Notifications = notifications();
  if (!Notifications || !(await ensureNotificationPermission())) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: { title: 'KIPP reminder', body: r.title, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.triggerAt) },
  });
}

export async function cancelReminder(r: Reminder) {
  if (!r.notificationId) return;
  await notifications()?.cancelScheduledNotificationAsync(r.notificationId).catch(() => {});
}

export function createTask(input: { title: string; notes?: string; dueDate?: string }): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: newId(), title: input.title, notes: input.notes, status: 'todo', dueDate: validDate(input.dueDate), dueTimezone: tz(),
    source: 'kipp', version: 1, createdAt: now, updatedAt: now, syncState: 'synced',
  };
  useAppStore.getState().addTask(task);
  pushTask(task);
  return task;
}

export async function createReminder(input: { title: string; triggerAt: string }): Promise<Reminder> {
  const at = validDate(input.triggerAt);
  if (!at) throw new Error('That reminder time is not a valid date.');
  if (new Date(at).getTime() <= Date.now()) throw new Error('That reminder time is in the past.');
  const now = new Date().toISOString();
  const r: Reminder = { id: newId(), title: input.title, triggerAt: at, timezone: tz(), enabled: true, createdAt: now, updatedAt: now };
  r.notificationId = await scheduleReminder(r);
  useAppStore.getState().addReminder(r);
  return r;
}

/** Executes an approved action. Returns a short human summary. */
export async function commitAction(action: ProposedAction): Promise<string> {
  switch (action.tool) {
    case 'task.create': {
      const args = taskSchema.parse(action.args);
      createTask(args);
      return 'Task added to Plans.';
    }
    case 'reminder.create': {
      const args = reminderSchema.omit({ timezone: true }).parse(action.args);
      const r = await createReminder(args);
      return r.notificationId || Platform.OS === 'web'
        ? `Reminder set for ${new Date(r.triggerAt).toLocaleString()}.`
        : 'Reminder saved, but notifications are off — enable them in system settings.';
    }
    case 'memory.save': {
      if (useAppStore.getState().user?.memoryEnabled === false) throw new Error('Memory is turned off in You → Memory.');
      const args = memorySchema.parse(action.args);
      const now = new Date().toISOString();
      useAppStore.getState().addMemory({ id: newId(), ...args, explicit: true, createdAt: now, updatedAt: now });
      return 'Saved to memory.';
    }
    case 'calendar.event.create': {
      const args = calendarEventSchema.parse(action.args);
      if (googleAccount()) {
        const event = await createCalendarEvent(args);
        const { events, setEvents } = useAppStore.getState();
        setEvents([...events, event].sort((a, b) => a.start.localeCompare(b.start)));
        return `Added to Google Calendar for ${new Date(event.start).toLocaleString()}.`;
      }
      // No calendar connected: keep the event as a dated task so nothing is lost.
      createTask({ title: args.title, dueDate: args.start, notes: args.end ? `Ends ${args.end}` : undefined });
      return 'No calendar connected — saved as a dated task in Plans.';
    }
  }
}

export function describeAction(a: ProposedAction): { title: string; detail: string } {
  const s = (k: string) => (typeof a.args[k] === 'string' ? (a.args[k] as string) : undefined);
  const when = (iso?: string) => (validDate(iso) ? new Date(iso!).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined);
  switch (a.tool) {
    case 'task.create': return { title: 'New task', detail: [s('title'), when(s('dueDate'))].filter(Boolean).join(' · ') };
    case 'reminder.create': return { title: 'New reminder', detail: [s('title'), when(s('triggerAt'))].filter(Boolean).join(' · ') };
    case 'memory.save': return { title: 'Remember this', detail: s('text') || '' };
    case 'calendar.event.create': return { title: 'Calendar event', detail: [s('title'), when(s('start'))].filter(Boolean).join(' · ') };
  }
}
