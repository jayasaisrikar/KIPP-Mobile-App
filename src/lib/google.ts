import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { CalendarEvent, ConnectedAccount } from '../types';

// Google Calendar + Tasks via @react-native-google-signin (needs a development build, not Expo Go).
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
];

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let mod: GoogleModule | null | undefined;

function lib(): GoogleModule | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m: GoogleModule = require('@react-native-google-signin/google-signin');
    m.GoogleSignin.configure({ scopes: GOOGLE_SCOPES, webClientId, iosClientId });
    mod = m;
  } catch {
    mod = null;
  }
  return mod;
}

export class GoogleError extends Error {}

/** Why Google can't be used right now, or null if it can. */
export function googleUnavailableReason(): string | null {
  if (Platform.OS === 'web') return 'Google sign-in is only available in the iOS and Android apps.';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'Google sign-in needs a development build — it does not run in Expo Go.';
  if (!webClientId || (Platform.OS === 'ios' && !iosClientId)) return 'Google client IDs are not configured. Add them to .env.local and rebuild.';
  if (!lib()) return 'Google sign-in native module is missing. Rebuild the app.';
  return null;
}

export async function connectGoogle(): Promise<ConnectedAccount | null> {
  const reason = googleUnavailableReason();
  if (reason) throw new GoogleError(reason);
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = lib()!;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    let scopes = res.data.scopes ?? [];
    if (!GOOGLE_SCOPES.every((s) => scopes.includes(s))) {
      const added = await GoogleSignin.addScopes({ scopes: GOOGLE_SCOPES });
      if (!added || !isSuccessResponse(added)) throw new GoogleError('Calendar and Tasks access is needed to connect.');
      scopes = added.data.scopes ?? GOOGLE_SCOPES;
    }
    return {
      id: res.data.user.id,
      provider: 'google',
      externalUserId: res.data.user.id,
      email: res.data.user.email,
      name: res.data.user.name ?? undefined,
      scopes,
      status: 'connected',
      lastSyncAt: undefined,
      selectedCalendars: ['primary'],
      selectedTaskLists: ['@default'],
    };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (e instanceof GoogleError) throw e;
    throw new GoogleError(e instanceof Error ? e.message : 'Google sign-in failed.');
  }
}

export async function disconnectGoogle() {
  const m = lib();
  if (!m) return;
  await m.GoogleSignin.revokeAccess().catch(() => {});
  await m.GoogleSignin.signOut().catch(() => {});
}

async function accessToken(): Promise<string> {
  const m = lib();
  if (!m) throw new GoogleError(googleUnavailableReason() ?? 'Google is unavailable.');
  if (!m.GoogleSignin.getCurrentUser()) {
    const silent = await m.GoogleSignin.signInSilently();
    if (silent.type !== 'success') throw new GoogleError('Google session expired. Reconnect in You → Apps.');
  }
  const { accessToken } = await m.GoogleSignin.getTokens();
  return accessToken;
}

async function gfetch<T>(url: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await accessToken();
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401 && retry) {
    await lib()?.GoogleSignin.clearCachedAccessToken(token).catch(() => {});
    return gfetch<T>(url, init, false);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GoogleError(`Google API ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TASKS = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

type GEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string; htmlLink?: string; status?: string };

const toEvent = (e: GEvent): CalendarEvent => ({
  id: e.id,
  title: e.summary || '(No title)',
  start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
  end: e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00` : undefined),
  allDay: !e.start?.dateTime,
  location: e.location,
  htmlLink: e.htmlLink,
});

export async function listUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 86400000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const data = await gfetch<{ items?: GEvent[] }>(`${CAL}?${params}`);
  return (data.items ?? []).filter((e) => e.status !== 'cancelled').map(toEvent);
}

export async function createCalendarEvent(input: { title: string; start: string; end?: string }): Promise<CalendarEvent> {
  const start = new Date(input.start);
  const end = input.end ? new Date(input.end) : new Date(start.getTime() + 60 * 60000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const e = await gfetch<GEvent>(CAL, {
    method: 'POST',
    body: JSON.stringify({ summary: input.title, start: { dateTime: start.toISOString(), timeZone: tz }, end: { dateTime: end.toISOString(), timeZone: tz } }),
  });
  return toEvent(e);
}

export type GTask = { id: string; title: string; notes?: string; status: 'needsAction' | 'completed'; due?: string; updated: string; deleted?: boolean };

export async function listGoogleTasks(): Promise<GTask[]> {
  const data = await gfetch<{ items?: GTask[] }>(`${TASKS}?showCompleted=true&showHidden=true&maxResults=100`);
  return (data.items ?? []).filter((t) => !t.deleted && t.title);
}

export async function createGoogleTask(input: { title: string; notes?: string; due?: string }): Promise<GTask> {
  // Google Tasks stores dates only; the time part is ignored.
  return gfetch<GTask>(TASKS, { method: 'POST', body: JSON.stringify({ title: input.title, notes: input.notes, due: input.due ? new Date(input.due).toISOString() : undefined }) });
}

export async function updateGoogleTask(id: string, patch: Partial<Pick<GTask, 'status' | 'title'>>) {
  return gfetch<GTask>(`${TASKS}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteGoogleTask(id: string) {
  return gfetch<void>(`${TASKS}/${id}`, { method: 'DELETE' });
}
