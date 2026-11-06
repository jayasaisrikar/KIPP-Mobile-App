import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { closeNeo4j, getDriver } from './client.js';

/**
 * Idempotent graph schema for the Kipp stack.
 *
 * Postgres is the system of record (one row per entity, same uuid everywhere);
 * Neo4j holds the *relationships between* those entities — who/what a memory
 * mentions, which tasks belong to which projects, how people connect.
 *
 * Run: npm run graph:bootstrap
 */
const CONSTRAINTS = [
  'CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE',
  'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
  'CREATE CONSTRAINT memory_id IF NOT EXISTS FOR (m:Memory) REQUIRE m.id IS UNIQUE',
  'CREATE CONSTRAINT device_id IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE',
  'CREATE CONSTRAINT conversation_id IF NOT EXISTS FOR (c:Conversation) REQUIRE c.id IS UNIQUE',
  'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
] as const;

const INDEXES = [
  'CREATE INDEX memory_category IF NOT EXISTS FOR (m:Memory) ON (m.category)',
  'CREATE INDEX task_status IF NOT EXISTS FOR (t:Task) ON (t.status)',
  'CREATE FULLTEXT INDEX memory_text_search IF NOT EXISTS FOR (m:Memory) ON EACH [m.text]',
] as const;

export async function bootstrapGraph(): Promise<void> {
  const session = getDriver().session();
  try {
    for (const stmt of [...CONSTRAINTS, ...INDEXES]) await session.run(stmt);
  } finally {
    await session.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrapGraph()
    .then(async () => {
      console.log('graph schema ready');
      await closeNeo4j();
    })
    .catch(async (err) => {
      console.error('graph bootstrap failed:', err);
      await closeNeo4j();
      process.exit(1);
    });
}
