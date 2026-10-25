import { z } from 'zod';

// Lenient: small/free models often omit or misspell optional fields.
export const kippTurnSchema = z.object({
  reply: z.string(),
  emotion: z.enum(['neutral', 'happy', 'curious', 'skeptical', 'concerned']).catch('neutral'),
  intent: z.enum(['chat', 'task', 'reminder', 'calendar', 'memory']).catch('chat'),
  proposedActions: z.array(z.object({
    id: z.string().optional(),
    tool: z.enum(['task.create', 'reminder.create', 'calendar.event.create', 'memory.save']),
    args: z.record(z.string(), z.unknown()).catch({}),
    requiresConfirmation: z.boolean().catch(true),
  })).catch([]).default([]),
});

export type KippTurnParsed = z.infer<typeof kippTurnSchema>;

export const taskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  dueTimezone: z.string().optional(),
});

export const reminderSchema = z.object({
  title: z.string().min(1).max(200),
  triggerAt: z.string(),
  timezone: z.string(),
  recurrence: z.string().optional(),
});

export const memorySchema = z.object({
  text: z.string().min(1).max(500),
  category: z.enum(['Preferences', 'Projects', 'People', 'Other']).catch('Other'),
  sensitive: z.boolean().catch(false).default(false),
});

export const calendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  start: z.string(),
  end: z.string().optional(),
});
