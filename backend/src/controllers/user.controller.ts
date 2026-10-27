import { Request, Response } from 'express';
import { z } from 'zod';
import neo4j from 'neo4j-driver';
import { getSession } from '../config/neo4j';
import { formatNeo4jDateTime, GRADIENT_THEMES } from './post.controller';
import { createNotificationInTx } from '../services/notification.service';

/**
 * Validate that an ID parameter is a strictly positive integer.
 */
export function validateIntegerId(rawId: string, paramName = 'ID'): { valid: boolean; value: number; error?: string } {
  if (!rawId || typeof rawId !== 'string') {
    return { valid: false, value: 0, error: `${paramName} must be provided.` };
  }
  const trimmed = rawId.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, value: 0, error: `${paramName} must be a positive integer.` };
  }
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return { valid: false, value: 0, error: `${paramName} must be greater than 0.` };
  }
  return { valid: true, value: parsed };
}

/**
 * Pagination query schema for user posts.
 */
const userPostsQuerySchema = z.object({
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
 * GET /api/users/:userId/profile
 * Retrieve public profile for a user with aggregated post, follower, and following counts.
 */
export async function getUserProfile(req: Request, res: Response): Promise<void> {
  const { valid, value: targetUserId, error } = validateIntegerId(req.params.userId, 'User ID');
  if (!valid) {
    res.status(400).json({ status: 'error', error });
    return;
  }

  const viewerId = req.session?.userId ? Number(req.session.userId) : null;
  const isOwnProfile = viewerId !== null && viewerId === targetUserId;

  const session = getSession(neo4j.session.READ);
  try {
    const result = await session.run(
      `
      MATCH (u:User { userId: $targetUserId })
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
      LIMIT 1
      `,
      {
        targetUserId: neo4j.int(targetUserId),
        viewerId: viewerId ? neo4j.int(viewerId) : neo4j.int(-1),
      }
    );

    if (result.records.length === 0) {
      res.status(404).json({
        status: 'error',
        error: `User with ID ${targetUserId} not found.`,
      });
      return;
    }

    const record = result.records[0];
    const rawUserId = record.get('userId');
    const uId = neo4j.isInt(rawUserId) ? rawUserId.toNumber() : Number(rawUserId);

    const firstName = record.get('firstName') || '';
    const lastName = record.get('lastName') || '';
    const fullName = `${firstName} ${lastName}`.trim() || record.get('username');

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

    const profile = {
      userId: uId,
      username: record.get('username'),
      firstName,
      lastName,
      fullName,
      bio: defaultBio,
      avatarUrl: record.get('avatarUrl') || defaultAvatar,
      isVerified: record.get('isVerified') ?? true,
      createdAt: formatNeo4jDateTime(record.get('createdAt')),
      postCount: neo4j.isInt(rawPostCount) ? rawPostCount.toNumber() : Number(rawPostCount || 0),
      followerCount: neo4j.isInt(rawFollowerCount) ? rawFollowerCount.toNumber() : Number(rawFollowerCount || 0),
      followingCount: neo4j.isInt(rawFollowingCount) ? rawFollowingCount.toNumber() : Number(rawFollowingCount || 0),
      isFollowing: Boolean(record.get('isFollowing')),
      isOwnProfile,
    };

    res.status(200).json({
      status: 'success',
      data: { profile },
    });
  } catch (error) {
    console.error('[Get Profile Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while retrieving user profile.',
    });
  } finally {
    await session.close();
  }
}

/**
 * GET /api/users/:userId/posts
 * Retrieve paginated posts created by a specific user.
 */
export async function getUserPosts(req: Request, res: Response): Promise<void> {
  const { valid, value: targetUserId, error } = validateIntegerId(req.params.userId, 'User ID');
  if (!valid) {
    res.status(400).json({ status: 'error', error });
    return;
  }

  const parseResult = userPostsQuerySchema.safeParse(req.query);
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
    // 1. Verify user exists
    const userCheck = await session.run(
      'MATCH (u:User { userId: $targetUserId }) RETURN u.userId AS userId LIMIT 1',
      { targetUserId: neo4j.int(targetUserId) }
    );
    if (userCheck.records.length === 0) {
      res.status(404).json({
        status: 'error',
        error: `User with ID ${targetUserId} not found.`,
      });
      return;
    }

    // 2. Count total posts authored by user
    const countRes = await session.run(
      'MATCH (:User { userId: $targetUserId })-[:CREATED]->(p:Post) RETURN count(p) AS total',
      { targetUserId: neo4j.int(targetUserId) }
    );
    const totalRaw = countRes.records[0].get('total');
    const total = neo4j.isInt(totalRaw) ? totalRaw.toNumber() : Number(totalRaw || 0);

    // 3. Retrieve user's posts
    const queryResult = await session.run(
      `
      MATCH (author:User { userId: $targetUserId })-[:CREATED]->(p:Post)
      OPTIONAL MATCH (currUser:User { userId: $currentUserId })-[:LIKES]->(p)
      OPTIONAL MATCH (c:Comment)-[:ON_POST]->(p)
      OPTIONAL MATCH (commentAuthor:User)-[:WROTE]->(c)
      WITH p, author, currUser, c, commentAuthor
      ORDER BY coalesce(c.createdAt, datetime({year: 1970})) DESC, c.commentId DESC
      WITH p, author, currUser,
           COUNT { (:User)-[:LIKES]->(p) } AS likeCount,
           COUNT { (:Comment)-[:ON_POST]->(p) } AS commentCount,
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
        targetUserId: neo4j.int(targetUserId),
        skip: neo4j.int(skip),
        limit: neo4j.int(limit),
        currentUserId,
      }
    );

    const posts = queryResult.records.map((record) => {
      const pNode = record.get('p').properties;
      const authorNode = record.get('author') ? record.get('author').properties : null;
      const rawComments = record.get('rawComments') as Array<Record<string, any>>;

      const postId = pNode.postId ? (neo4j.isInt(pNode.postId) ? pNode.postId.toNumber() : Number(pNode.postId)) : 0;
      const authorId = authorNode && authorNode.userId
        ? (neo4j.isInt(authorNode.userId) ? authorNode.userId.toNumber() : Number(authorNode.userId))
        : 0;

      const comments = rawComments
        .filter((c) => c && c.commentId !== null)
        .map((c) => ({
          commentId: c.commentId ? (neo4j.isInt(c.commentId) ? c.commentId.toNumber() : Number(c.commentId)) : 0,
          postId,
          content: c.content || '',
          text: c.content || '',
          createdAt: formatNeo4jDateTime(c.createdAt),
          likeCount: 0,
          isLiked: false,
          author: {
            userId: c.author?.userId ? (neo4j.isInt(c.author.userId) ? c.author.userId.toNumber() : Number(c.author.userId)) : 0,
            username: c.author?.username || 'user',
            fullName: `${c.author?.firstName || ''} ${c.author?.lastName || ''}`.trim() || 'User',
            avatarUrl: `https://images.unsplash.com/photo-${c.author?.userId === 101 ? '1534528741775-53994a69daeb' : '1494790108377-be9c29b29330'}?auto=format&fit=crop&w=256&q=80`,
            isVerified: true,
          },
        }));

      const rawLikes = record.get('likeCount');
      const rawComm = record.get('commentCount');
      const themeIndex = postId % GRADIENT_THEMES.length;
      const gradientTheme = GRADIENT_THEMES[themeIndex];

      return {
        postId,
        caption: pNode.caption || '',
        imageUrl: pNode.imageUrl || undefined,
        createdAt: formatNeo4jDateTime(pNode.createdAt),
        likeCount: neo4j.isInt(rawLikes) ? rawLikes.toNumber() : Number(rawLikes || 0),
        commentCount: neo4j.isInt(rawComm) ? rawComm.toNumber() : Number(rawComm || 0),
        isLiked: Boolean(record.get('isLiked')),
        comments,
        gradientTheme,
        author: {
          userId: authorId,
          username: authorNode?.username || 'user',
          fullName: `${authorNode?.firstName || ''} ${authorNode?.lastName || ''}`.trim() || 'User',
          avatarUrl: `https://images.unsplash.com/photo-${authorId === 101 ? '1534528741775-53994a69daeb' : '1494790108377-be9c29b29330'}?auto=format&fit=crop&w=256&q=80`,
          isVerified: true,
        },
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + posts.length < total,
        },
      },
    });
  } catch (error) {
    console.error('[Get User Posts Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while retrieving user posts.',
    });
  } finally {
    await session.close();
  }
}

/**
 * PUT /api/users/:userId/follow
 * Authenticated endpoint to follow a user.
 * Idempotently creates (:User)-[:FOLLOWS]->(:User).
 */
export async function followUser(req: Request, res: Response): Promise<void> {
  const actingUserId = req.session?.userId;
  if (!actingUserId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to follow users.',
    });
    return;
  }

  const { valid, value: targetUserId, error } = validateIntegerId(req.params.userId, 'User ID');
  if (!valid) {
    res.status(400).json({ status: 'error', error });
    return;
  }

  // Reject self-follow attempts
  if (Number(actingUserId) === targetUserId) {
    res.status(400).json({
      status: 'error',
      error: 'You cannot follow yourself.',
    });
    return;
  }

  const session = getSession(neo4j.session.WRITE);
  try {
    const result = await session.executeWrite(async (tx) => {
      // 1. Verify target user exists
      const targetCheck = await tx.run(
        'MATCH (u:User { userId: $targetUserId }) RETURN u.userId AS userId LIMIT 1',
        { targetUserId: neo4j.int(targetUserId) }
      );
      if (targetCheck.records.length === 0) {
        return { notFound: true };
      }

      // 2. Atomically MERGE the FOLLOWS edge
      const writeRes = await tx.run(
        `
        MATCH (actor:User { userId: $actingUserId })
        MATCH (target:User { userId: $targetUserId })
        MERGE (actor)-[r:FOLLOWS]->(target)
        ON CREATE SET r.createdAt = datetime(), r.followDate = date(), r.newlyCreated = true
        WITH target, actor, r, r.newlyCreated IS NOT NULL AS isNew
        REMOVE r.newlyCreated
        RETURN COUNT { (:User)-[:FOLLOWS]->(target) } AS followerCount,
               COUNT { (target)-[:FOLLOWS]->(:User) } AS followingCount,
               isNew,
               actor.username AS actorUsername
        `,
        {
          actingUserId: neo4j.int(actingUserId),
          targetUserId: neo4j.int(targetUserId),
        }
      );

      const record = writeRes.records[0];
      const rawFollower = record.get('followerCount');
      const rawFollowing = record.get('followingCount');
      const isNew = Boolean(record.get('isNew'));
      const actorUsername = record.get('actorUsername') || 'Someone';

      // 3. Atomically generate follow notification if newly created and not self-action
      if (isNew && Number(actingUserId) !== targetUserId) {
        await createNotificationInTx(tx, {
          recipientId: targetUserId,
          actorId: Number(actingUserId),
          type: 'follow',
          message: `@${actorUsername} started following you.`,
        });
      }

      return {
        notFound: false,
        followerCount: neo4j.isInt(rawFollower) ? rawFollower.toNumber() : Number(rawFollower || 0),
        followingCount: neo4j.isInt(rawFollowing) ? rawFollowing.toNumber() : Number(rawFollowing || 0),
        isFollowing: true,
      };
    });

    if (result.notFound) {
      res.status(404).json({
        status: 'error',
        error: `User with ID ${targetUserId} not found.`,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        userId: targetUserId,
        followerCount: result.followerCount,
        followingCount: result.followingCount,
        isFollowing: result.isFollowing,
      },
    });
  } catch (err) {
    console.error('[Follow User Error]:', err);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while updating follow status.',
    });
  } finally {
    await session.close();
  }
}

/**
 * DELETE /api/users/:userId/follow
 * Authenticated endpoint to unfollow a user.
 * Idempotently removes (:User)-[:FOLLOWS]->(:User).
 */
export async function unfollowUser(req: Request, res: Response): Promise<void> {
  const actingUserId = req.session?.userId;
  if (!actingUserId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to unfollow users.',
    });
    return;
  }

  const { valid, value: targetUserId, error } = validateIntegerId(req.params.userId, 'User ID');
  if (!valid) {
    res.status(400).json({ status: 'error', error });
    return;
  }

  // Reject self-unfollow attempts
  if (Number(actingUserId) === targetUserId) {
    res.status(400).json({
      status: 'error',
      error: 'You cannot unfollow yourself.',
    });
    return;
  }

  const session = getSession(neo4j.session.WRITE);
  try {
    const result = await session.executeWrite(async (tx) => {
      // 1. Verify target user exists
      const targetCheck = await tx.run(
        'MATCH (u:User { userId: $targetUserId }) RETURN u.userId AS userId LIMIT 1',
        { targetUserId: neo4j.int(targetUserId) }
      );
      if (targetCheck.records.length === 0) {
        return { notFound: true };
      }

      // 2. Remove only the acting user's FOLLOWS relationship
      const writeRes = await tx.run(
        `
        MATCH (target:User { userId: $targetUserId })
        OPTIONAL MATCH (actor:User { userId: $actingUserId })-[r:FOLLOWS]->(target)
        DELETE r
        WITH target
        RETURN COUNT { (:User)-[:FOLLOWS]->(target) } AS followerCount,
               COUNT { (target)-[:FOLLOWS]->(:User) } AS followingCount,
               false AS isFollowing
        `,
        {
          actingUserId: neo4j.int(actingUserId),
          targetUserId: neo4j.int(targetUserId),
        }
      );

      const record = writeRes.records[0];
      const rawFollower = record.get('followerCount');
      const rawFollowing = record.get('followingCount');

      return {
        notFound: false,
        followerCount: neo4j.isInt(rawFollower) ? rawFollower.toNumber() : Number(rawFollower || 0),
        followingCount: neo4j.isInt(rawFollowing) ? rawFollowing.toNumber() : Number(rawFollowing || 0),
        isFollowing: false,
      };
    });

    if (result.notFound) {
      res.status(404).json({
        status: 'error',
        error: `User with ID ${targetUserId} not found.`,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        userId: targetUserId,
        followerCount: result.followerCount,
        followingCount: result.followingCount,
        isFollowing: result.isFollowing,
      },
    });
  } catch (err) {
    console.error('[Unfollow User Error]:', err);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while updating follow status.',
    });
  } finally {
    await session.close();
  }
}
