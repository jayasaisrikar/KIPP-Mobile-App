import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    googleSub: text('google_sub').notNull(),
    email: text('email').notNull(),
    name: text('name'),
    picture: text('picture'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_google_sub_idx').on(t.googleSub), uniqueIndex('users_email_idx').on(t.email)],
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 16 }).notNull(),
    pushToken: text('push_token'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('devices_user_idx').on(t.userId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    source: varchar('source', { length: 16 }).notNull().default('kipp'),
    title: text('title').notNull(),
    notes: text('notes'),
    status: varchar('status', { length: 16 }).notNull().default('todo'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    syncState: varchar('sync_state', { length: 16 }).notNull().default('synced'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('tasks_user_idx').on(t.userId),
    index('tasks_user_status_idx').on(t.userId, t.status),
    uniqueIndex('tasks_external_idx').on(t.externalId),
  ],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('conversations_user_idx').on(t.userId)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(),
    content: text('content').notNull(),
    emotion: varchar('emotion', { length: 16 }),
    actions: jsonb('actions').$type<unknown[]>().default([]),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId)],
);

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    category: varchar('category', { length: 32 }).notNull().default('Other'),
    explicit: boolean('explicit').notNull().default(true),
    sensitive: boolean('sensitive').notNull().default(false),
    sourceMessageId: uuid('source_message_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('memories_user_idx').on(t.userId), index('memories_user_category_idx').on(t.userId, t.category)],
);

export type User = typeof users.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
