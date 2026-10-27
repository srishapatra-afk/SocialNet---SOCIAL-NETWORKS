import neo4j from 'neo4j-driver';
import { getSession } from '../config/neo4j';

/**
 * Concurrency-Safe ID Allocation Service.
 * Implements approved Architectural Decision 3 using atomic Neo4j node write locks on :_Counter nodes.
 * Prevents race condition collisions inherent to naive MAX(id)+1 queries.
 */
export async function getNextSequence(entityName: string, baselineCurrent: number = 102): Promise<number> {
  const session = getSession(neo4j.session.WRITE);

  try {
    const nextId = await session.executeWrite(async (tx) => {
      // 1. Ensure counter node exists with initial baseline (exclusive lock placed on node on write)
      await tx.run(
        `
        MERGE (c:_Counter { name: $entityName })
        ON CREATE SET c.current = $baselineCurrent
        RETURN c
        `,
        { entityName, baselineCurrent: neo4j.int(baselineCurrent) }
      );

      // 2. Increment atomically under write lock
      const result = await tx.run(
        `
        MATCH (c:_Counter { name: $entityName })
        SET c.current = c.current + 1
        RETURN c.current AS nextId
        `,
        { entityName }
      );

      const record = result.records[0];
      return record.get('nextId').toInt();
    });

    return nextId;
  } finally {
    await session.close();
  }
}

/**
 * Initializes or reconciles a counter node safely without resetting higher values.
 */
export async function initCounter(entityName: string, baselineCurrent: number): Promise<number> {
  const session = getSession(neo4j.session.WRITE);

  try {
    const current = await session.executeWrite(async (tx) => {
      const result = await tx.run(
        `
        MERGE (c:_Counter { name: $entityName })
        ON CREATE SET c.current = $baselineCurrent, c.createdAt = datetime()
        ON MATCH SET c.current = CASE WHEN c.current < $baselineCurrent THEN $baselineCurrent ELSE c.current END
        RETURN c.current AS current
        `,
        { entityName, baselineCurrent: neo4j.int(baselineCurrent) }
      );
      const raw = result.records[0].get('current');
      return neo4j.isInt(raw) ? raw.toInt() : Number(raw);
    });

    return current;
  } finally {
    await session.close();
  }
}

/**
 * Read-only retrieval of a counter's current value.
 */
export async function getCounterValue(entityName: string): Promise<number | null> {
  const session = getSession(neo4j.session.READ);

  try {
    const result = await session.run(
      `
      MATCH (c:_Counter { name: $entityName })
      RETURN c.current AS current
      `,
      { entityName }
    );

    if (result.records.length === 0) return null;
    const raw = result.records[0].get('current');
    return neo4j.isInt(raw) ? raw.toInt() : Number(raw);
  } finally {
    await session.close();
  }
}
