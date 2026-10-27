import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j';

/**
 * Safe, race-free counter initialization script for Post entity.
 * Aligns with Approved Architectural Decision 3 and Phase 6 instructions.
 * Baseline verified in preflight: max postId = 202.
 */
async function initPostCounter() {
  console.log('--- Initializing Dedicated Post Counter in Neo4j Aura ---');
  const session = getSession(neo4j.session.WRITE);

  const baseline = 202;

  try {
    // Atomic Cypher operation using MERGE with conditional reconciliation
    const result = await session.executeWrite(async (tx) => {
      const res = await tx.run(
        `
        MERGE (c:_Counter { name: 'Post' })
        ON CREATE SET c.current = $baseline, c.createdAt = datetime()
        ON MATCH SET c.current = CASE WHEN c.current < $baseline THEN $baseline ELSE c.current END
        RETURN c.name AS name, c.current AS current
        `,
        { baseline: neo4j.int(baseline) }
      );
      return res.records[0];
    });

    const name = result.get('name');
    const rawCurrent = result.get('current');
    const currentValue = neo4j.isInt(rawCurrent) ? rawCurrent.toInt() : rawCurrent;

    console.log(`[Success] Counter initialized: name="${name}", current=${currentValue}`);

    // Read-only verification check
    const readSession = getSession(neo4j.session.READ);
    try {
      const verifyRes = await readSession.run(
        `
        MATCH (c:_Counter { name: 'Post' })
        RETURN c.name AS name, c.current AS current, labels(c) AS labels
        `
      );
      if (verifyRes.records.length === 1) {
        const rec = verifyRes.records[0];
        const vCur = rec.get('current');
        const vVal = neo4j.isInt(vCur) ? vCur.toInt() : vCur;
        console.log(`[Read-Only Verification Passed]: (:_Counter { name: '${rec.get('name')}', current: ${vVal} })`);
      } else {
        console.error(`[Verification Failed]: Found ${verifyRes.records.length} counter nodes!`);
      }
    } finally {
      await readSession.close();
    }
  } catch (error) {
    console.error('[Error during counter initialization]:', error);
  } finally {
    await session.close();
    await closeDriver();
  }
}

initPostCounter();
