import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j';

async function inspectSchema() {
  console.log('--- Inspecting Neo4j Aura Live Schema (Read-Only) ---');
  const session = getSession(neo4j.session.READ);

  try {
    // 1. Labels
    const labelsResult = await session.run('CALL db.labels()');
    const labels = labelsResult.records.map((r) => r.get('label'));
    console.log('\n[Labels Found]:', labels);

    // 2. Relationship Types
    const relsResult = await session.run('CALL db.relationshipTypes()');
    const relTypes = relsResult.records.map((r) => r.get('relationshipType'));
    console.log('\n[Relationship Types Found]:', relTypes);

    // 3. Constraints
    const constraintsResult = await session.run('SHOW CONSTRAINTS');
    console.log('\n[Constraints Found]:');
    for (const record of constraintsResult.records) {
      console.log(
        ` - ${record.get('name')} | Type: ${record.get('type')} | Label: ${JSON.stringify(
          record.get('labelsOrTypes')
        )} | Properties: ${JSON.stringify(record.get('properties'))}`
      );
    }

    // 4. Node Counts and Property Keys
    console.log('\n[Node Labels & Property Keys]:');
    for (const label of labels) {
      const countRes = await session.run(`MATCH (n:\`${label}\`) RETURN count(n) as count`);
      const count = countRes.records[0].get('count').toInt();

      const sampleRes = await session.run(`MATCH (n:\`${label}\`) RETURN keys(n) as keys LIMIT 1`);
      const keys = sampleRes.records.length > 0 ? sampleRes.records[0].get('keys') : [];
      console.log(` - Label: ${label} (Count: ${count}) -> Properties: ${JSON.stringify(keys)}`);
    }

    // 5. Relationship Patterns & Directions
    console.log('\n[Relationship Patterns & Directions]:');
    const schemaRelRes = await session.run(`
      MATCH (a)-[r]->(b)
      RETURN DISTINCT labels(a)[0] AS fromLabel, type(r) AS relType, keys(r) AS relKeys, labels(b)[0] AS toLabel
      ORDER BY fromLabel, relType
    `);
    for (const r of schemaRelRes.records) {
      console.log(
        ` - (:${r.get('fromLabel')})-[:${r.get('relType')} ${JSON.stringify(r.get('relKeys'))}]->(:${r.get(
          'toLabel'
        )})`
      );
    }
  } catch (error) {
    console.error('[Error during read-only schema inspection]:', error);
  } finally {
    await session.close();
    await closeDriver();
  }
}

inspectSchema();
