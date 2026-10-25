export type Emotion = 'neutral' | 'happy' | 'curious' | 'skeptical' | 'concerned';
export type Intent = 'chat' | 'task' | 'reminder' | 'calendar' | 'memory';

export type ProposedAction = {
  id: string;
  tool: 'task.create' | 'reminder.create' | 'calendar.event.create' | 'memory.save';
  args: Record<string, unknown>;
  requiresConfirmation: boolean;
  state: 'proposed' | 'approved' | 'committed' | 'failed' | 'rejected';
  result?: string;
};

export type KippTurn = {
  turnId: string;
  reply: string;
  emotion: Emotion;
  intent: Intent;
  proposedActions: ProposedAction[];
};

export type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: Emotion;
  actions?: ProposedAction[];
  createdAt: string;
};

export type MemoryCategory = 'Preferences' | 'Projects' | 'People' | 'Other';
export type Memory = {
  id: string;
  text: string;
  category: MemoryCategory;
  explicit: boolean;
  sensitive: boolean;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type TaskStatus = 'todo' | 'done' | 'cancelled';
export type TaskSource = 'kipp' | 'google';
export type Task = {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  dueDate?: string; // ISO
  dueTimezone?: string;
  source: TaskSource;
  externalId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncState: 'synced' | 'pending' | 'conflict' | 'failed';
};

export type Reminder = {
  id: string;
  taskId?: string;
  title: string;
  triggerAt: string; // ISO UTC
  timezone: string;
  recurrence?: string;
  enabled: boolean;
  notificationId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectedAccount = {
  id: string;
  provider: 'google';
  externalUserId?: string;
  email?: string;
  name?: string;
  scopes: string[];
  status: 'connected' | 'expired' | 'disconnected';
  lastSyncAt?: string;
  selectedCalendars: string[];
  selectedTaskLists: string[];
};

export type Device = {
  id: string;
  name: string;
  model?: string;
  firmware?: string;
  battery?: number;
  connected: boolean;
  mock: boolean;
};

export type UserProfile = {
  id: string;
  displayName: string;
  nickname?: string;
  timezone: string;
  locale: string;
  morningTime: string;
  eveningTime: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  personality: 'calm' | 'balanced' | 'playful';
  voiceId?: string;
  memoryEnabled: boolean;
  retentionDays: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
};

export type SyncOutboxItem = {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  idempotencyKey: string;
  attempts: number;
  nextRetryAt: string;
  createdAt: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
};
