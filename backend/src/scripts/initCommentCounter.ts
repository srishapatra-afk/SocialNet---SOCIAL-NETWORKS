import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j';

/**
 * Safe, race-free counter initialization script for Comment entity.
 * Aligns with Approved Architectural Decision 3 and Phase 8 instructions.
 * Baseline verified in preflight: max commentId = 302.
 */
async function initCommentCounter() {
  console.log('--- Initializing Dedicated Comment Counter in Neo4j Aura ---');
  const session = getSession(neo4j.session.WRITE);

  try {
    // 1. Read maximum existing Comment ID to reconcile safely
    const readSession = getSession(neo4j.session.READ);
    let baseline = 302;
    try {
      const maxRes = await readSession.run(`
        MATCH (c:Comment)
        RETURN coalesce(max(c.commentId), 302) AS maxCommentId
      `);
      const rawMax = maxRes.records[0]?.get('maxCommentId');
      const maxVal = neo4j.isInt(rawMax) ? rawMax.toInt() : (typeof rawMax === 'number' ? rawMax : 302);
      baseline = Math.max(302, maxVal);
      console.log(`[Inspection] Maximum existing commentId in graph: ${maxVal}. Reconciled baseline: ${baseline}`);
    } finally {
      await readSession.close();
    }

    // 2. Atomic Cypher operation using MERGE with conditional reconciliation
    const result = await session.executeWrite(async (tx) => {
      const res = await tx.run(
        `
        MERGE (c:_Counter { name: 'Comment' })
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

    console.log(`[Success] Counter initialized/reconciled: name="${name}", current=${currentValue}`);

    // 3. Read-only verification check
    const verifySession = getSession(neo4j.session.READ);
    try {
      const verifyRes = await verifySession.run(
        `
        MATCH (c:_Counter { name: 'Comment' })
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
      await verifySession.close();
    }
  } catch (error) {
    console.error('[Error during comment counter initialization]:', error);
  } finally {
    await session.close();
    await closeDriver();
  }
}

initCommentCounter();
