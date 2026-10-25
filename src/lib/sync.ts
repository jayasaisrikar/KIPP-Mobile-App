import { useAppStore } from '../stores/appStore';
import { GoogleError, listGoogleTasks, listUpcomingEvents, createGoogleTask, updateGoogleTask, deleteGoogleTask } from './google';
import type { Task } from '../types';

export const googleAccount = () => useAppStore.getState().accounts.find((a) => a.provider === 'google' && a.status === 'connected');

function markExpired(e: unknown) {
  if (e instanceof GoogleError && /expired|401/.test(e.message)) {
    const { accounts, setAccounts } = useAppStore.getState();
    setAccounts(accounts.map((a) => (a.provider === 'google' ? { ...a, status: 'expired' } : a)));
  }
}

/** Pulls upcoming events and Google Tasks into the local store. */
export async function syncGoogle() {
  if (!googleAccount()) return;
  try {
    const [events, gtasks] = await Promise.all([listUpcomingEvents(14), listGoogleTasks()]);
    const { tasks, setTasks, setEvents, accounts, setAccounts } = useAppStore.getState();
    setEvents(events);

    const now = new Date().toISOString();
    const byExternal = new Map(tasks.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
    const remoteIds = new Set(gtasks.map((g) => g.id));
    const merged: Task[] = tasks.filter((t) => !t.externalId || remoteIds.has(t.externalId));
    for (const g of gtasks) {
      const existing = byExternal.get(g.id);
      const fields = { title: g.title, notes: g.notes, status: g.status === 'completed' ? ('done' as const) : ('todo' as const), dueDate: g.due ?? existing?.dueDate };
      if (existing) {
        const i = merged.findIndex((t) => t.id === existing.id);
        merged[i] = { ...existing, ...fields, updatedAt: g.updated, syncState: 'synced' };
      } else {
        merged.push({ id: `g-${g.id}`, externalId: g.id, source: 'google', version: 1, createdAt: g.updated, updatedAt: g.updated, syncState: 'synced', ...fields });
      }
    }
    setTasks(merged);
    setAccounts(accounts.map((a) => (a.provider === 'google' ? { ...a, lastSyncAt: now } : a)));
  } catch (e) {
    markExpired(e);
    throw e;
  }
}

/** Mirrors a local task to Google Tasks when connected. Failures leave it as a local task marked failed. */
export async function pushTask(task: Task) {
  if (!googleAccount()) return;
  const setState = (patch: Partial<Task>) => {
    const { tasks, setTasks } = useAppStore.getState();
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
  };
  try {
    const g = await createGoogleTask({ title: task.title, notes: task.notes, due: task.dueDate });
    setState({ externalId: g.id, source: 'google', syncState: 'synced' });
  } catch (e) {
    markExpired(e);
    setState({ syncState: 'failed' });
  }
}

export async function pushTaskStatus(task: Task) {
  if (!task.externalId || !googleAccount()) return;
  await updateGoogleTask(task.externalId, { status: task.status === 'done' ? 'completed' : 'needsAction' }).catch(markExpired);
}

export async function pushTaskDelete(task: Task) {
  if (!task.externalId || !googleAccount()) return;
  await deleteGoogleTask(task.externalId).catch(markExpired);
}
