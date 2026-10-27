import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j';

async function runPreflight() {
  console.log('=== Neo4j Aura Preflight Inspection (Read-Only) ===');
  const session = getSession(neo4j.session.READ);

  try {
    // 1. All existing Post nodes and their IDs, types, properties
    const postsRes = await session.run(`
      MATCH (p:Post)
      RETURN p.postId AS postId, p.caption AS caption, p.createdAt AS createdAt, labels(p) AS labels
      ORDER BY p.postId ASC
    `);

    console.log(`\n[1. All Existing Post Nodes] (Total found: ${postsRes.records.length})`);
    const postIds: Array<{ raw: any; type: string; isNeo4jInt: boolean; numericValue: number | null }> = [];
    for (const r of postsRes.records) {
      const rawId = r.get('postId');
      const isInt = neo4j.isInt(rawId);
      const val = isInt ? rawId.toInt() : (typeof rawId === 'number' ? rawId : null);
      postIds.push({
        raw: rawId,
        type: typeof rawId,
        isNeo4jInt: isInt,
        numericValue: val,
      });
      console.log(` - Post Node:`, {
        postId: val,
        rawType: typeof rawId,
        isNeo4jInt: isInt,
        captionSnippet: (r.get('caption') || '').slice(0, 40),
        labels: r.get('labels'),
      });
    }

    // 2. Maximum existing integer postId
    const maxRes = await session.run(`
      MATCH (p:Post)
      RETURN max(p.postId) AS maxPostId
    `);
    const rawMax = maxRes.records[0]?.get('maxPostId');
    const maxPostId = neo4j.isInt(rawMax) ? rawMax.toInt() : (typeof rawMax === 'number' ? rawMax : rawMax);
    console.log(`\n[2. Maximum Existing Post ID]:`, maxPostId, `(Type: ${typeof maxPostId})`);

    // 3 & 4. Existing :_Counter nodes
    const counterRes = await session.run(`
      MATCH (c:_Counter)
      RETURN c.name AS name, c.current AS current, labels(c) AS labels
    `);
    console.log(`\n[3 & 4. Existing :_Counter Nodes] (Total found: ${counterRes.records.length})`);
    if (counterRes.records.length === 0) {
      console.log(' - No :_Counter nodes currently exist in the database.');
    } else {
      for (const r of counterRes.records) {
        const rawCur = r.get('current');
        const curVal = neo4j.isInt(rawCur) ? rawCur.toInt() : rawCur;
        console.log(` - Counter node: name="${r.get('name')}", current=${curVal} (Type: ${typeof curVal}, isInt: ${neo4j.isInt(rawCur)})`);
      }
    }

    // 5. Constraints inspection
    const constraintRes = await session.run('SHOW CONSTRAINTS');
    console.log(`\n[5. Active Database Constraints] (Total: ${constraintRes.records.length}):`);
    let postConstraintFound = false;
    let counterConstraintFound = false;
    for (const r of constraintRes.records) {
      const name = r.get('name');
      const type = r.get('type');
      const labels = r.get('labelsOrTypes');
      const props = r.get('properties');
      console.log(` - Constraint: ${name} [${type}] on (${JSON.stringify(labels)}) properties: ${JSON.stringify(props)}`);
      if (Array.isArray(labels) && labels.includes('Post') && Array.isArray(props) && props.includes('postId')) {
        postConstraintFound = true;
      }
      if (Array.isArray(labels) && labels.includes('_Counter') && Array.isArray(props) && props.includes('name')) {
        counterConstraintFound = true;
      }
    }

    console.log('\n[Constraint Status Summary]:');
    console.log(` - post_id_unique present: ${postConstraintFound}`);
    console.log(` - counter_name_unique present: ${counterConstraintFound}`);

    // 6. LIKES relationships inspection
    const likesRes = await session.run(`
      MATCH (u:User)-[r:LIKES]->(p:Post)
      RETURN u.userId AS userId, u.username AS username, p.postId AS postId, type(r) AS relType, keys(r) AS keys
    `);
    console.log(`\n[6. Existing LIKES Relationships] (Total: ${likesRes.records.length}):`);
    for (const r of likesRes.records) {
      const uId = neo4j.isInt(r.get('userId')) ? r.get('userId').toInt() : r.get('userId');
      const pId = neo4j.isInt(r.get('postId')) ? r.get('postId').toInt() : r.get('postId');
      console.log(` - (:User {userId: ${uId}, username: '${r.get('username')}'})-[:${r.get('relType')}]->(:Post {postId: ${pId}})`);
    }

    // 7. Check reverse or unexpected LIKES relationships
    const reverseLikesRes = await session.run(`
      MATCH (p:Post)-[r:LIKES]->(u:User)
      RETURN p.postId AS postId, u.userId AS userId
    `);
    console.log(`\n[7. Reverse LIKES (:Post)-[:LIKES]->(:User)] (Total: ${reverseLikesRes.records.length})`);

    // 8. Comment nodes and properties inspection
    const commentsRes = await session.run(`
      MATCH (c:Comment)
      RETURN c.commentId AS commentId, c.text AS text, c.createdAt AS createdAt, keys(c) AS keys, labels(c) AS labels
      ORDER BY c.commentId ASC
    `);
    console.log(`\n[8. All Existing Comment Nodes] (Total found: ${commentsRes.records.length})`);
    for (const r of commentsRes.records) {
      const rawId = r.get('commentId');
      const isInt = neo4j.isInt(rawId);
      const val = isInt ? rawId.toInt() : rawId;
      console.log(` - Comment Node:`, {
        commentId: val,
        rawType: typeof rawId,
        isNeo4jInt: isInt,
        textSnippet: (r.get('text') || '').slice(0, 40),
        keys: r.get('keys'),
        labels: r.get('labels'),
      });
    }

    // 9. Maximum existing integer commentId
    const maxCommentRes = await session.run(`
      MATCH (c:Comment)
      RETURN max(c.commentId) AS maxCommentId
    `);
    const rawMaxComment = maxCommentRes.records[0]?.get('maxCommentId');
    const maxCommentId = neo4j.isInt(rawMaxComment) ? rawMaxComment.toInt() : (typeof rawMaxComment === 'number' ? rawMaxComment : rawMaxComment);
    console.log(`\n[9. Maximum Existing Comment ID]:`, maxCommentId, `(Type: ${typeof maxCommentId})`);

    // 10. Comment relationships inspection (:User)-[:WROTE]->(:Comment) and (:Comment)-[:ON_POST]->(:Post)
    const commentRelsRes = await session.run(`
      MATCH (u:User)-[w:WROTE]->(c:Comment)-[o:ON_POST]->(p:Post)
      RETURN u.userId AS authorId, u.username AS authorUsername, c.commentId AS commentId, p.postId AS postId
      ORDER BY c.commentId ASC
    `);
    console.log(`\n[10. Existing Comment Relationships] (Total: ${commentRelsRes.records.length}):`);
    for (const r of commentRelsRes.records) {
      const aId = neo4j.isInt(r.get('authorId')) ? r.get('authorId').toInt() : r.get('authorId');
      const cId = neo4j.isInt(r.get('commentId')) ? r.get('commentId').toInt() : r.get('commentId');
      const pId = neo4j.isInt(r.get('postId')) ? r.get('postId').toInt() : r.get('postId');
      console.log(` - (:User {userId: ${aId}, username: '${r.get('authorUsername')}'})-[:WROTE]->(:Comment {commentId: ${cId}})-[:ON_POST]->(:Post {postId: ${pId}})`);
    }

    console.log('\n=== Preflight Inspection Completed Successfully ===');
  } catch (error) {
    console.error('[Preflight Inspection Error]:', error);
  } finally {
    await session.close();
    await closeDriver();
  }
}

runPreflight();
