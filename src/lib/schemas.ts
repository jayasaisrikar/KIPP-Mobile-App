import { z } from 'zod';

export const kippTurnSchema = z.object({
  reply: z.string(),
  emotion: z.enum(['neutral', 'happy', 'curious', 'skeptical', 'concerned']),
  intent: z.enum(['chat', 'task', 'reminder', 'calendar', 'memory']),
  proposedActions: z.array(z.object({
    id: z.string(),
    tool: z.enum(['task.create', 'reminder.create', 'calendar.event.create', 'memory.save']),
args: z.record(z.string(), z.unknown()),
    requiresConfirmation: z.boolean(),
  })),
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
  category: z.enum(['Preferences', 'Projects', 'People', 'Other']),
  sensitive: z.boolean().default(false),
});
