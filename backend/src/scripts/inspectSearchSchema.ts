import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j';

async function inspectSearchSchema() {
  console.log('=== Neo4j Search & Discovery Preflight Inspection (Read-Only) ===');
  const session = getSession(neo4j.session.READ);

  try {
    // 1. Check existing indexes (full-text, range, point, text, etc.)
    console.log('\n[1. Database Indexes]:');
    const indexRes = await session.run('SHOW INDEXES');
    for (const r of indexRes.records) {
      console.log(` - Index: "${r.get('name')}" | Type: ${r.get('type')} | Entity: ${r.get('entityType')} | LabelsOrTypes: ${JSON.stringify(r.get('labelsOrTypes'))} | Properties: ${JSON.stringify(r.get('properties'))} | State: ${r.get('state')}`);
    }

    // 2. Inspect User properties on existing users (safe fields only)
    console.log('\n[2. User Node Properties Inspection]:');
    const userRes = await session.run(`
      MATCH (u:User)
      RETURN u.userId AS userId, u.username AS username, u.firstName AS firstName, u.lastName AS lastName,
             u.bio AS bio, u.avatarUrl AS avatarUrl, keys(u) AS allKeys
      LIMIT 10
    `);
    for (const r of userRes.records) {
      const allKeys: string[] = r.get('allKeys') || [];
      const safeKeys = allKeys.filter(k => !k.toLowerCase().includes('pass') && !k.toLowerCase().includes('secret') && !k.toLowerCase().includes('hash'));
      console.log(` - User ID: ${r.get('userId')}, Username: "${r.get('username')}", Name: "${r.get('firstName')} ${r.get('lastName')}", Present Keys: ${JSON.stringify(safeKeys)}`);
    }

    // 3. Inspect Post properties on existing posts
    console.log('\n[3. Post Node Properties Inspection]:');
    const postRes = await session.run(`
      MATCH (p:Post)
      RETURN p.postId AS postId, p.caption AS caption, p.imageUrl AS imageUrl, p.createdAt AS createdAt, keys(p) AS allKeys
      LIMIT 10
    `);
    for (const r of postRes.records) {
      console.log(` - Post ID: ${r.get('postId')}, Caption: "${(r.get('caption') || '').slice(0, 50)}", Keys: ${JSON.stringify(r.get('allKeys'))}`);
    }

  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await session.close();
    await closeDriver();
  }
}

inspectSearchSchema();
