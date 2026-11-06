import neo4j, { type Driver } from 'neo4j-driver';
import { env } from '../config.js';

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD), {
      disableLosslessIntegers: true,
      maxConnectionLifetime: 30 * 60 * 1000,
      connectionAcquisitionTimeout: 10_000,
    });
  }
  return driver;
}

export async function pingNeo4j(): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run('RETURN 1 AS ok');
  } finally {
    await session.close();
  }
}

export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
