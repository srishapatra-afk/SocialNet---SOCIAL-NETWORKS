import { Request, Response } from 'express';
import { z } from 'zod';
import neo4j from 'neo4j-driver';
import { getSession } from '../config/neo4j';
import { createNotificationInTx } from '../services/notification.service';

/**
 * Query parameter schema for feed retrieval.
 */
const feedQuerySchema = z.object({
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
  filter: z.enum(['all', 'text-only', 'media']).optional().default('all'),
});

/**
 * Validation schema for post creation.
 * Strict non-empty caption, max 2000 characters.
 */
export const createPostSchema = z.object({
  caption: z
    .string({ required_error: 'Caption is required' })
    .trim()
    .min(1, 'Caption cannot be empty or whitespace only')
    .max(2000, 'Caption cannot exceed 2000 characters'),
});

export const GRADIENT_THEMES: Array<'sunset' | 'ocean' | 'emerald' | 'berry' | 'midnight' | 'amber'> = [
  'sunset',
  'ocean',
  'emerald',
  'berry',
  'midnight',
  'amber',
];

/**
 * Safely converts Neo4j Date, DateTime, or primitive value into standard ISO string.
 */
export function formatNeo4jDateTime(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as { toISOString?: () => string }).toISOString === 'function') {
    return (val as { toISOString: () => string }).toISOString();
  }
  const obj = val as Record<string, unknown>;
  if (obj.year && obj.month && obj.day) {
    const toNum = (num: unknown) =>
      typeof num === 'object' && num !== null && 'toInt' in num
        ? (num as { toInt: () => number }).toInt()
        : Number(num);

    const y = toNum(obj.year);
    const m = String(toNum(obj.month)).padStart(2, '0');
    const d = String(toNum(obj.day)).padStart(2, '0');
    const h = obj.hour ? String(toNum(obj.hour)).padStart(2, '0') : '00';
    const min = obj.minute ? String(toNum(obj.minute)).padStart(2, '0') : '00';
    const s = obj.second ? String(toNum(obj.second)).padStart(2, '0') : '00';
    return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  }
  return new Date().toISOString();
}

/**
 * Read-only feed endpoint: GET /api/posts
 * Retrieves paginated posts with author details, like counts, and comments.
 */
export async function getFeed(req: Request, res: Response): Promise<void> {
  const parseResult = feedQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map((i) => i.message);
    res.status(400).json({
      status: 'error',
      error: errorMessages[0],
      details: errorMessages,
    });
    return;
  }

  const { page, limit } = parseResult.data;
  const skip = (page - 1) * limit;
  const currentUserId = req.session?.userId ? neo4j.int(req.session.userId) : neo4j.int(-1);

  const session = getSession(neo4j.session.READ);

  try {
    // 1. Total count query for pagination metadata
    const countResult = await session.run(
      `
      MATCH (p:Post)
      RETURN count(p) AS total
      `
    );
    const totalPosts = countResult.records.length > 0 ? countResult.records[0].get('total').toInt() : 0;

    // 2. Fetch paginated posts with author, like status, and comments using parameterized Cypher
    const queryResult = await session.run(
      `
      MATCH (p:Post)
      OPTIONAL MATCH (author:User)-[:CREATED]->(p)
      OPTIONAL MATCH (allLikes:User)-[:LIKES]->(p)
      OPTIONAL MATCH (c:Comment)-[:ON_POST]->(p)
      OPTIONAL MATCH (commentAuthor:User)-[:WROTE]->(c)
      OPTIONAL MATCH (currUser:User { userId: $currentUserId })-[:LIKES]->(p)
      WITH p, author,
           count(DISTINCT allLikes) AS likeCount,
           count(DISTINCT c) AS commentCount,
           (currUser IS NOT NULL) AS isLiked,
           collect(DISTINCT {
             commentId: c.commentId,
             content: c.text,
             createdAt: c.createdAt,
             author: {
               userId: commentAuthor.userId,
               username: commentAuthor.username,
               firstName: commentAuthor.firstName,
               lastName: commentAuthor.lastName
             }
           }) AS rawComments
      ORDER BY coalesce(p.createdAt, datetime({year: 1970})) DESC, p.postId DESC
      SKIP $skip
      LIMIT $limit
      RETURN p, author, likeCount, commentCount, isLiked, rawComments
      `,
      {
        skip: neo4j.int(skip),
        limit: neo4j.int(limit),
        currentUserId,
      }
    );

    const gradientThemes: Array<'sunset' | 'ocean' | 'emerald' | 'berry' | 'midnight' | 'amber'> = [
      'sunset',
      'ocean',
      'emerald',
      'berry',
      'midnight',
      'amber',
    ];

    const posts = queryResult.records.map((record) => {
      const pNode = record.get('p').properties;
      const authorNode = record.get('author') ? record.get('author').properties : null;
      const rawComments = record.get('rawComments') as Array<Record<string, any>>;

      const postId = pNode.postId ? (pNode.postId.toInt ? pNode.postId.toInt() : Number(pNode.postId)) : 0;
      const authorId = authorNode && authorNode.userId
        ? (authorNode.userId.toInt ? authorNode.userId.toInt() : Number(authorNode.userId))
        : 0;

      // Filter out empty comment objects from OPTIONAL MATCH
      const comments = rawComments
        .filter((c) => c && c.commentId !== null)
        .map((c) => ({
          commentId: c.commentId ? (c.commentId.toInt ? c.commentId.toInt() : Number(c.commentId)) : 0,
          postId,
          content: c.content || '',
          createdAt: formatNeo4jDateTime(c.createdAt),
          author: {
            userId: c.author?.userId ? (c.author.userId.toInt ? c.author.userId.toInt() : Number(c.author.userId)) : 0,
            username: c.author?.username || 'anonymous',
            fullName: `${c.author?.firstName || ''} ${c.author?.lastName || ''}`.trim() || c.author?.username || 'Anonymous',
          },
          likeCount: 0,
          isLiked: false,
        }));

      // Map author safely without passwords or hashes
      const author = authorNode
        ? {
            userId: authorId,
            username: authorNode.username || 'unknown',
            fullName: `${authorNode.firstName || ''} ${authorNode.lastName || ''}`.trim() || authorNode.username,
            avatarUrl:
              authorId === 101
                ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
                : authorId === 102
                ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
                : undefined,
            isVerified: true,
            accountStatus: authorNode.accountStatus || 'active',
          }
        : {
            userId: 0,
            username: 'unknown',
            fullName: 'Unknown Author',
            isVerified: false,
          };

      // Decision 2: text-only posts without imageUrl receive curated gradient themes
      const gradientTheme = gradientThemes[Math.abs(postId) % gradientThemes.length];

      return {
        postId,
        authorId,
        content: pNode.caption || '',
        caption: pNode.caption || '',
        imageUrl: pNode.imageUrl || undefined,
        gradientTheme: !pNode.imageUrl ? gradientTheme : undefined,
        createdAt: formatNeo4jDateTime(pNode.createdAt),
        likeCount: record.get('likeCount').toInt(),
        commentCount: record.get('commentCount').toInt(),
        isLiked: Boolean(record.get('isLiked')),
        isSaved: false,
        tags: ['Neo4j', 'DBMS', 'Aura'],
        author,
        comments,
      };
    });

    const hasMore = skip + posts.length < totalPosts;

    res.status(200).json({
      status: 'success',
      data: {
        posts,
        pagination: {
          page,
          limit,
          total: totalPosts,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error('[Feed Retrieval Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve social feed from graph database.',
    });
  } finally {
    await session.close();
  }
}

/**
 * Create post endpoint: POST /api/posts
 * Requires authenticated session (req.session.userId).
 * Executes atomic ID allocation from :_Counter { name: 'Post' }, creates Post node,
 * and links (:User)-[:CREATED]->(:Post) in a single managed write transaction.
 */
export async function createPost(req: Request, res: Response): Promise<void> {
  // 1. Session authentication verification
  const authorId = req.session?.userId;
  if (!authorId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to create a post.',
    });
    return;
  }

  // 2. Body validation with Zod
  const parseResult = createPostSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map((i) => i.message);
    res.status(400).json({
      status: 'error',
      error: errorMessages[0],
      details: errorMessages,
    });
    return;
  }

  const { caption } = parseResult.data;
  const session = getSession(neo4j.session.WRITE);

  try {
    const result = await session.executeWrite(async (tx) => {
      // Step A: Verify counter node exists before incrementing
      const counterCheck = await tx.run(
        `
        MATCH (c:_Counter { name: 'Post' })
        RETURN c.current AS current
        `
      );
      if (counterCheck.records.length === 0) {
        throw new Error('COUNTER_NOT_FOUND');
      }

      // Step B: Verify author node exists
      const userCheck = await tx.run(
        `
        MATCH (u:User { userId: $authorId })
        RETURN u.userId AS userId
        `,
        { authorId: neo4j.int(authorId) }
      );
      if (userCheck.records.length === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      // Step C: Atomically increment counter, create Post node and CREATED edge
      const createRes = await tx.run(
        `
        MATCH (c:_Counter { name: 'Post' })
        SET c.current = c.current + 1
        WITH c.current AS nextPostId
        MATCH (u:User { userId: $authorId })
        CREATE (p:Post {
          postId: nextPostId,
          caption: $caption,
          createdAt: datetime()
        })
        CREATE (u)-[:CREATED]->(p)
        RETURN p, u, nextPostId
        `,
        {
          authorId: neo4j.int(authorId),
          caption,
        }
      );

      if (createRes.records.length === 0) {
        throw new Error('TRANSACTION_WRITE_FAILED');
      }

      return createRes.records[0];
    });

    const pNode = result.get('p').properties;
    const uNode = result.get('u').properties;
    const nextPostId = result.get('nextPostId').toInt();

    const numericAuthorId = uNode.userId?.toInt ? uNode.userId.toInt() : Number(uNode.userId);
    const gradientTheme = GRADIENT_THEMES[Math.abs(nextPostId) % GRADIENT_THEMES.length];

    const author = {
      userId: numericAuthorId,
      username: uNode.username || 'unknown',
      fullName: `${uNode.firstName || ''} ${uNode.lastName || ''}`.trim() || uNode.username,
      avatarUrl:
        numericAuthorId === 101
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
          : numericAuthorId === 102
          ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
          : undefined,
      isVerified: true,
      accountStatus: uNode.accountStatus || 'active',
    };

    const newPost = {
      postId: nextPostId,
      authorId: numericAuthorId,
      content: pNode.caption || caption,
      caption: pNode.caption || caption,
      imageUrl: pNode.imageUrl || undefined,
      gradientTheme: !pNode.imageUrl ? gradientTheme : undefined,
      createdAt: formatNeo4jDateTime(pNode.createdAt),
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
      isSaved: false,
      tags: ['Neo4j', 'DBMS', 'Aura'],
      author,
      comments: [],
    };

    res.status(201).json({
      status: 'success',
      data: {
        post: newPost,
      },
    });
  } catch (error: any) {
    if (error?.message === 'USER_NOT_FOUND') {
      res.status(404).json({
        status: 'error',
        error: 'Authenticated user account not found in graph database.',
      });
      return;
    }

    if (error?.message === 'COUNTER_NOT_FOUND') {
      res.status(500).json({
        status: 'error',
        error: 'Post sequence counter is not initialized. Please contact the administrator.',
      });
      return;
    }

    console.error('[Create Post Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to create post in graph database.',
    });
  } finally {
    await session.close();
  }
}

/**
 * Like a post: PUT /api/posts/:postId/like
 * Requires authenticated session (req.session.userId).
 * Executes atomic MERGE on (:User)-[:LIKES]->(:Post) in a managed write transaction.
 * Repeated requests remain idempotent and do not duplicate relationships or inflate counts.
 */
export async function likePost(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to like posts.',
    });
    return;
  }

  const postIdParam = req.params.postId;
  const numericPostId = parseInt(postIdParam, 10);
  if (!postIdParam || isNaN(numericPostId) || !/^\d+$/.test(postIdParam) || numericPostId <= 0) {
    res.status(400).json({
      status: 'error',
      error: 'Invalid postId. Must be a positive integer >= 1.',
    });
    return;
  }

  const session = getSession(neo4j.session.WRITE);

  try {
    const result = await session.executeWrite(async (tx) => {
      // 1. Verify target post exists
      const postCheck = await tx.run(
        `
        MATCH (p:Post { postId: $postId })
        RETURN p.postId AS postId
        `,
        { postId: neo4j.int(numericPostId) }
      );

      if (postCheck.records.length === 0) {
        throw new Error('POST_NOT_FOUND');
      }

      // 2. Atomically create LIKES relationship if not exists, and count total distinct likes
      const likeRes = await tx.run(
        `
        MATCH (u:User { userId: $userId }), (p:Post { postId: $postId })
        OPTIONAL MATCH (postOwner:User)-[:CREATED]->(p)
        MERGE (u)-[r:LIKES]->(p)
        ON CREATE SET r.createdAt = datetime(), r.newlyCreated = true
        WITH p, u, postOwner, r, r.newlyCreated IS NOT NULL AS isNew
        REMOVE r.newlyCreated
        RETURN p.postId AS postId,
               COUNT { (:User)-[:LIKES]->(p) } AS likeCount,
               isNew,
               postOwner.userId AS postOwnerId,
               u.username AS actorUsername
        `,
        {
          userId: neo4j.int(userId),
          postId: neo4j.int(numericPostId),
        }
      );

      const record = likeRes.records[0];
      const isNew = Boolean(record.get('isNew'));
      const rawOwnerId = record.get('postOwnerId');
      const postOwnerId = rawOwnerId ? (neo4j.isInt(rawOwnerId) ? rawOwnerId.toNumber() : Number(rawOwnerId)) : null;
      const actorUsername = record.get('actorUsername') || 'Someone';

      // 3. Atomically generate like notification if newly created and not self-action
      if (isNew && postOwnerId && postOwnerId !== Number(userId)) {
        await createNotificationInTx(tx, {
          recipientId: postOwnerId,
          actorId: Number(userId),
          type: 'like',
          message: `@${actorUsername} liked your post.`,
          postId: numericPostId,
        });
      }

      return record;
    });

    const rawCount = result.get('likeCount');
    const likeCount = neo4j.isInt(rawCount) ? rawCount.toInt() : Number(rawCount);

    res.status(200).json({
      status: 'success',
      data: {
        postId: numericPostId,
        likeCount,
        isLiked: true,
      },
    });
  } catch (error: any) {
    if (error?.message === 'POST_NOT_FOUND') {
      res.status(404).json({
        status: 'error',
        error: `Post with ID ${numericPostId} not found.`,
      });
      return;
    }

    console.error('[Like Post Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to update post like status in graph database.',
    });
  } finally {
    await session.close();
  }
}

/**
 * Unlike a post: DELETE /api/posts/:postId/like
 * Requires authenticated session (req.session.userId).
 * Removes only the authenticated user's LIKES relationship to the post in a managed write transaction.
 * Repeated requests remain safe, idempotent, and never produce negative counts.
 */
export async function unlikePost(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to unlike posts.',
    });
    return;
  }

  const postIdParam = req.params.postId;
  const numericPostId = parseInt(postIdParam, 10);
  if (!postIdParam || isNaN(numericPostId) || !/^\d+$/.test(postIdParam) || numericPostId <= 0) {
    res.status(400).json({
      status: 'error',
      error: 'Invalid postId. Must be a positive integer >= 1.',
    });
    return;
  }

  const session = getSession(neo4j.session.WRITE);

  try {
    const result = await session.executeWrite(async (tx) => {
      // 1. Verify target post exists
      const postCheck = await tx.run(
        `
        MATCH (p:Post { postId: $postId })
        RETURN p.postId AS postId
        `,
        { postId: neo4j.int(numericPostId) }
      );

      if (postCheck.records.length === 0) {
        throw new Error('POST_NOT_FOUND');
      }

      // 2. Remove LIKES relationship for this authenticated user only
      const unlikeRes = await tx.run(
        `
        MATCH (p:Post { postId: $postId })
        OPTIONAL MATCH (u:User { userId: $userId })-[r:LIKES]->(p)
        DELETE r
        WITH p
        OPTIONAL MATCH (allLikes:User)-[:LIKES]->(p)
        RETURN p.postId AS postId, count(DISTINCT allLikes) AS likeCount
        `,
        {
          userId: neo4j.int(userId),
          postId: neo4j.int(numericPostId),
        }
      );

      return unlikeRes.records[0];
    });

    const rawCount = result.get('likeCount');
    const likeCount = neo4j.isInt(rawCount) ? rawCount.toInt() : Number(rawCount);

    res.status(200).json({
      status: 'success',
      data: {
        postId: numericPostId,
        likeCount,
        isLiked: false,
      },
    });
  } catch (error: any) {
    if (error?.message === 'POST_NOT_FOUND') {
      res.status(404).json({
        status: 'error',
        error: `Post with ID ${numericPostId} not found.`,
      });
      return;
    }

    console.error('[Unlike Post Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to update post like status in graph database.',
    });
  } finally {
    await session.close();
  }
}

