import { Request, Response } from 'express';
import { z } from 'zod';
import neo4j from 'neo4j-driver';
import { getSession } from '../config/neo4j';
import { formatNeo4jDateTime, GRADIENT_THEMES } from './post.controller';

/**
 * Zod validation schema for Search API query parameters.
 * Minimum query length: 1 non-whitespace character.
 * Maximum query length: 100 characters.
 * Supported types: 'all', 'users', 'posts'.
 */
export const searchQuerySchema = z.object({
  q: z
    .string({ required_error: 'Search query is required' })
    .trim()
    .min(1, 'Search query cannot be empty or whitespace only')
    .max(100, 'Search query cannot exceed 100 characters'),
  type: z
    .enum(['all', 'users', 'posts'], {
      errorMap: () => ({ message: "type must be one of 'all', 'users', or 'posts'" }),
    })
    .optional()
    .default('all'),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: 'page must be a positive integer >= 1',
    }),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 50, {
      message: 'limit must be an integer between 1 and 50',
    }),
});

/**
 * GET /api/search?q=<query>&type=all&page=1&limit=10
 *
 * Search across users and posts using parameterized Cypher.
 * Enforces pagination, deterministic ordering, safe public projection,
 * and sanitized error handling.
 */
export async function search(req: Request, res: Response): Promise<void> {
  const parseResult = searchQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map((i) => i.message);
    res.status(400).json({
      status: 'error',
      error: errorMessages[0],
      details: errorMessages,
    });
    return;
  }

  const { q, type, page, limit } = parseResult.data;
  const skip = (page - 1) * limit;

  // Derive viewerId from validated server-side session (or -1 for guest)
  const viewerId = req.session?.userId ? neo4j.int(req.session.userId) : neo4j.int(-1);

  const session = getSession(neo4j.session.READ);

  try {
    let usersData = {
      items: [] as any[],
      total: 0,
      page,
      limit,
      hasMore: false,
    };

    let postsData = {
      items: [] as any[],
      total: 0,
      page,
      limit,
      hasMore: false,
    };

    // 1. User search if type is 'all' or 'users'
    if (type === 'all' || type === 'users') {
      // Total count query for users
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
      const userTotal =
        userCountRes.records.length > 0
          ? userCountRes.records[0].get('total').toInt()
          : 0;

      // Deterministic paginated user items
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
          skip: neo4j.int(skip),
          limit: neo4j.int(limit),
        }
      );

      const userItems = userItemsRes.records.map((record) => {
        const rawUserId = record.get('userId');
        const uId = neo4j.isInt(rawUserId) ? rawUserId.toNumber() : Number(rawUserId);
        const firstName = record.get('firstName') || '';
        const lastName = record.get('lastName') || '';
        const username = record.get('username') || '';
        const fullName = `${firstName} ${lastName}`.trim() || username;

        const defaultAvatar =
          uId === 101
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
            : uId === 102
            ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
            : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80';

        const defaultBio =
          record.get('bio') ||
          (uId === 101
            ? 'Exploring graph databases, social network algorithms, and distributed systems.'
            : uId === 102
            ? 'Full-stack developer passionate about Neo4j, Cypher, and modern UI architectures.'
            : 'Member of SocialNet Neo4j Graph Community.');

        const rawPostCount = record.get('postCount');
        const rawFollowerCount = record.get('followerCount');
        const rawFollowingCount = record.get('followingCount');

        return {
          userId: uId,
          username,
          fullName,
          firstName,
          lastName,
          avatarUrl: record.get('avatarUrl') || defaultAvatar,
          bio: defaultBio,
          isVerified: record.get('isVerified') ?? true,
          followerCount: neo4j.isInt(rawFollowerCount) ? rawFollowerCount.toNumber() : Number(rawFollowerCount || 0),
          followingCount: neo4j.isInt(rawFollowingCount) ? rawFollowingCount.toNumber() : Number(rawFollowingCount || 0),
          postCount: neo4j.isInt(rawPostCount) ? rawPostCount.toNumber() : Number(rawPostCount || 0),
          isFollowing: Boolean(record.get('isFollowing')),
        };
      });

      usersData = {
        items: userItems,
        total: userTotal,
        page,
        limit,
        hasMore: skip + userItems.length < userTotal,
      };
    }

    // 2. Post search if type is 'all' or 'posts'
    if (type === 'all' || type === 'posts') {
      // Total count query for posts matching caption
      const postCountRes = await session.run(
        `
        MATCH (p:Post)
        WHERE toLower(p.caption) CONTAINS toLower($q)
        RETURN count(p) AS total
        `,
        { q }
      );
      const postTotal =
        postCountRes.records.length > 0
          ? postCountRes.records[0].get('total').toInt()
          : 0;

      // Deterministic paginated post items
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
          q,
          viewerId,
          skip: neo4j.int(skip),
          limit: neo4j.int(limit),
        }
      );

      const postItems = postItemsRes.records.map((record) => {
        const rawPostId = record.get('postId');
        const postId = neo4j.isInt(rawPostId) ? rawPostId.toNumber() : Number(rawPostId);

        const rawAuthorId = record.get('authorUserId');
        const authorId = rawAuthorId
          ? neo4j.isInt(rawAuthorId)
            ? rawAuthorId.toNumber()
            : Number(rawAuthorId)
          : 0;

        const authorUsername = record.get('authorUsername') || 'anonymous';
        const authorFirstName = record.get('authorFirstName') || '';
        const authorLastName = record.get('authorLastName') || '';
        const authorFullName = `${authorFirstName} ${authorLastName}`.trim() || authorUsername;

        const authorAvatar =
          record.get('authorAvatarUrl') ||
          (authorId === 101
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
            : authorId === 102
            ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
            : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80');

        const rawLikeCount = record.get('likeCount');
        const rawCommentCount = record.get('commentCount');
        const themeIndex = postId % GRADIENT_THEMES.length;
        const gradientTheme = GRADIENT_THEMES[themeIndex];

        return {
          postId,
          authorId,
          content: record.get('caption') || '',
          imageUrl: record.get('imageUrl') || undefined,
          gradientTheme,
          createdAt: formatNeo4jDateTime(record.get('createdAt')),
          likeCount: neo4j.isInt(rawLikeCount) ? rawLikeCount.toNumber() : Number(rawLikeCount || 0),
          commentCount: neo4j.isInt(rawCommentCount) ? rawCommentCount.toNumber() : Number(rawCommentCount || 0),
          isLiked: Boolean(record.get('isLiked')),
          isSaved: false,
          author: {
            userId: authorId,
            username: authorUsername,
            fullName: authorFullName,
            avatarUrl: authorAvatar,
            isVerified: true,
            followerCount: 0,
            followingCount: 0,
            postCount: 0,
          },
        };
      });

      postsData = {
        items: postItems,
        total: postTotal,
        page,
        limit,
        hasMore: skip + postItems.length < postTotal,
      };
    }

    res.status(200).json({
      status: 'success',
      data: {
        query: q,
        type,
        users: usersData,
        posts: postsData,
      },
    });
  } catch (error) {
    console.error('[Search API Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while processing your search request.',
    });
  } finally {
    await session.close();
  }
}
