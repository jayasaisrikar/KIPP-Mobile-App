import { getDriver } from './client.js';

type GraphPerson = { id: string; email: string; name?: string | null; picture?: string | null };

/** Write-through: Postgres is the source of truth, Neo4j mirrors identity edges. */
export async function upsertPerson(person: GraphPerson): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `MERGE (p:Person {id: $id})
       SET p.email = $email, p.name = $name, p.picture = $picture, p.updatedAt = timestamp()`,
      {
        id: person.id,
        email: person.email,
        name: person.name ?? null,
        picture: person.picture ?? null,
      },
    );
  } finally {
    await session.close();
  }
}

export async function upsertTaskEdge(userId: string, taskId: string, title: string, status: string): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `MERGE (t:Task {id: $taskId})
       SET t.title = $title, t.status = $status, t.updatedAt = timestamp()
       WITH t
       MATCH (p:Person {id: $userId})
       MERGE (p)-[:OWNS]->(t)`,
      { taskId, title, status, userId },
    );
  } finally {
    await session.close();
  }
}

export async function upsertMemoryEdge(
  userId: string,
  memoryId: string,
  text: string,
  category: string,
): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `MERGE (m:Memory {id: $memoryId})
       SET m.text = $text, m.category = $category, m.updatedAt = timestamp()
       WITH m
       MATCH (p:Person {id: $userId})
       MERGE (p)-[:REMEMBERS]->(m)`,
      { memoryId, text, category, userId },
    );
  } finally {
    await session.close();
  }
}
