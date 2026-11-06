import { z } from 'zod';

/**
 * API contracts for the Kipp backend.
 *
 * These mirror the app's client-side contracts in `../src/lib/schemas.ts`
 * (same shapes, same enums) so a turn/task/memory the app renders locally is
 * byte-identical to what the API serves. Keep both files in sync until the
 * contracts move into a shared package.
 */

export const taskInputSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  dueTimezone: z.string().max(64).optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskStatusSchema = z.enum(['todo', 'done', 'cancelled']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskSourceSchema = z.enum(['kipp', 'google']);
export type TaskSource = z.infer<typeof taskSourceSchema>;

export const memoryInputSchema = z.object({
  text: z.string().min(1).max(500),
  category: z.enum(['Preferences', 'Projects', 'People', 'Other']).catch('Other'),
  sensitive: z.boolean().catch(false).default(false),
  explicit: z.boolean().catch(true),
});
export type MemoryInput = z.infer<typeof memoryInputSchema>;

export const kippTurnSchema = z.object({
  reply: z.string(),
  emotion: z.enum(['neutral', 'happy', 'curious', 'skeptical', 'concerned']).catch('neutral'),
  intent: z.enum(['chat', 'task', 'reminder', 'calendar', 'memory']).catch('chat'),
  proposedActions: z
    .array(
      z.object({
        id: z.string().optional(),
        tool: z.enum(['task.create', 'reminder.create', 'calendar.event.create', 'memory.save']),
        args: z.record(z.string(), z.unknown()).catch({}),
        requiresConfirmation: z.boolean().catch(true),
      }),
    )
    .catch([])
    .default([]),
});
export type KippTurn = z.infer<typeof kippTurnSchema>;

export const googleAuthSchema = z.object({
  idToken: z.string().min(20),
});
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
