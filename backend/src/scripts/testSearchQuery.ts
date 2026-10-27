import neo4j from 'neo4j-driver';
import { getSession, closeDriver } from '../config/neo4j';

async function testSearch() {
  console.log('--- Testing Search Cypher Queries (Read-Only) ---');
  const session = getSession(neo4j.session.READ);

  try {
    const q = 'aditya';
    const viewerId = neo4j.int(-1);

    // 1. User search count
    const userCountRes = await session.run(
      `
      MATCH (u:User)
      WHERE (u.accountStatus IS NULL OR u.accountStatus = 'active')
        AND (
          toLower(u.username) CONTAINS toLower($q)
          OR toLower(coalesce(u.firstName, '') + ' ' + coalesce(u.lastName, '')) CONTAINS toLower($q)
        )
      RETURN count(u) AS total
      `,
      { q }
    );
    const userTotal = userCountRes.records[0].get('total').toInt();
    console.log(`User Search ("${q}") Total Matches:`, userTotal);

    // 2. User search items
    const userItemsRes = await session.run(
      `
      MATCH (u:User)
      WHERE (u.accountStatus IS NULL OR u.accountStatus = 'active')
        AND (
          toLower(u.username) CONTAINS toLower($q)
          OR toLower(coalesce(u.firstName, '') + ' ' + coalesce(u.lastName, '')) CONTAINS toLower($q)
        )
      RETURN u.userId AS userId,
             u.username AS username,
             u.firstName AS firstName,
             u.lastName AS lastName,
             u.bio AS bio,
             u.avatarUrl AS avatarUrl,
             u.isVerified AS isVerified,
             u.createdAt AS createdAt,
             COUNT { (u)-[:CREATED]->(:Post) } AS postCount,
             COUNT { (:User)-[:FOLLOWS]->(u) } AS followerCount,
             COUNT { (u)-[:FOLLOWS]->(:User) } AS followingCount,
             EXISTS { (:User { userId: $viewerId })-[:FOLLOWS]->(u) } AS isFollowing
      ORDER BY
        CASE
          WHEN toLower(u.username) = toLower($q) THEN 0
          WHEN toLower(u.username) STARTS WITH toLower($q) THEN 1
          ELSE 2
        END,
        u.username ASC,
        u.userId ASC
      SKIP $skip
      LIMIT $limit
      `,
      {
        q,
        viewerId,
        skip: neo4j.int(0),
        limit: neo4j.int(10),
      }
    );
    console.log(`User Items Found: ${userItemsRes.records.length}`);
    for (const r of userItemsRes.records) {
      console.log(' - User Result:', {
        userId: r.get('userId').toInt(),
        username: r.get('username'),
        firstName: r.get('firstName'),
        lastName: r.get('lastName'),
        postCount: r.get('postCount').toInt(),
        followerCount: r.get('followerCount').toInt(),
        followingCount: r.get('followingCount').toInt(),
        isFollowing: r.get('isFollowing'),
      });
    }

    // 3. Post search count
    const postQ = 'social';
    const postCountRes = await session.run(
      `
      MATCH (p:Post)
      WHERE toLower(p.caption) CONTAINS toLower($q)
      RETURN count(p) AS total
      `,
      { q: postQ }
    );
    const postTotal = postCountRes.records[0].get('total').toInt();
    console.log(`\nPost Search ("${postQ}") Total Matches:`, postTotal);

    // 4. Post search items
    const postItemsRes = await session.run(
      `
      MATCH (p:Post)
      WHERE toLower(p.caption) CONTAINS toLower($q)
      OPTIONAL MATCH (author:User)-[:CREATED]->(p)
      RETURN p.postId AS postId,
             p.caption AS caption,
             p.imageUrl AS imageUrl,
             p.createdAt AS createdAt,
             author.userId AS authorUserId,
             author.username AS authorUsername,
             author.firstName AS authorFirstName,
             author.lastName AS authorLastName,
             author.avatarUrl AS authorAvatarUrl,
             COUNT { (:User)-[:LIKES]->(p) } AS likeCount,
             COUNT { (:Comment)-[:ON_POST]->(p) } AS commentCount,
             EXISTS { (:User { userId: $viewerId })-[:LIKES]->(p) } AS isLiked
      ORDER BY coalesce(p.createdAt, datetime({year: 1970})) DESC, p.postId DESC
      SKIP $skip
      LIMIT $limit
      `,
      {
        q: postQ,
        viewerId,
        skip: neo4j.int(0),
        limit: neo4j.int(10),
      }
    );
    console.log(`Post Items Found: ${postItemsRes.records.length}`);
    for (const r of postItemsRes.records) {
      console.log(' - Post Result:', {
        postId: r.get('postId').toInt(),
        caption: r.get('caption'),
        authorUsername: r.get('authorUsername'),
        likeCount: r.get('likeCount').toInt(),
        commentCount: r.get('commentCount').toInt(),
        isLiked: r.get('isLiked'),
      });
    }

  } catch (err) {
    console.error('Test search query error:', err);
  } finally {
    await session.close();
    await closeDriver();
  }
}

testSearch();
