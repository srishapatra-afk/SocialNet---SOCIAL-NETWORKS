import { Request, Response } from 'express';
import { z } from 'zod';
import neo4j from 'neo4j-driver';
import { getSession } from '../config/neo4j';
import { formatNeo4jDateTime } from './post.controller';
import { createNotificationInTx } from '../services/notification.service';

/**
 * Validation schema for comment creation.
 * Enforces trimmed text, non-empty, and sensible maximum length of 1,000 characters.
 */
export const createCommentSchema = z.object({
  text: z
    .string({ required_error: 'Comment text is required.' })
    .trim()
    .min(1, 'Comment text cannot be empty or whitespace only.')
    .max(1000, 'Comment text cannot exceed 1000 characters.'),
});

/**
 * Query parameter schema for comment pagination.
 */
export const commentQuerySchema = z.object({
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
 * Validates that an ID parameter is a strictly positive integer.
 */
export function validateIntegerId(param: string | undefined): number | null {
  if (!param || !/^\d+$/.test(param)) return null;
  const num = parseInt(param, 10);
  return !isNaN(num) && num > 0 ? num : null;
}

/**
 * Read comments for a post: GET /api/posts/:postId/comments
 * Validates post ID, returns paginated comments with author details.
 */
export async function getCommentsForPost(req: Request, res: Response): Promise<void> {
  const numericPostId = validateIntegerId(req.params.postId);
  if (!numericPostId) {
    res.status(400).json({
      status: 'error',
      error: 'Invalid postId. Must be a positive integer >= 1.',
    });
    return;
  }

  const queryParse = commentQuerySchema.safeParse(req.query);
  if (!queryParse.success) {
    const errorMessages = queryParse.error.issues.map((i) => i.message);
    res.status(400).json({
      status: 'error',
      error: errorMessages[0],
      details: errorMessages,
    });
    return;
  }

  const { page, limit } = queryParse.data;
  const skip = (page - 1) * limit;

  const session = getSession(neo4j.session.READ);

  try {
    // 1. Verify target post exists
    const postCheck = await session.run(
      `
      MATCH (p:Post { postId: $postId })
      RETURN p.postId AS postId
      `,
      { postId: neo4j.int(numericPostId) }
    );

    if (postCheck.records.length === 0) {
      res.status(404).json({
        status: 'error',
        error: `Post with ID ${numericPostId} not found.`,
      });
      return;
    }

    // 2. Total comment count for pagination
    const countRes = await session.run(
      `
      MATCH (c:Comment)-[:ON_POST]->(p:Post { postId: $postId })
      RETURN count(c) AS total
      `,
      { postId: neo4j.int(numericPostId) }
    );
    const total = countRes.records.length > 0 ? countRes.records[0].get('total').toInt() : 0;

    // 3. Paginated comments with author details, ordered newest first with ID tiebreaker
    const commentsRes = await session.run(
      `
      MATCH (c:Comment)-[:ON_POST]->(p:Post { postId: $postId })
      OPTIONAL MATCH (author:User)-[:WROTE]->(c)
      RETURN c, author
      ORDER BY coalesce(c.createdAt, datetime({year: 1970})) DESC, c.commentId DESC
      SKIP $skip
      LIMIT $limit
      `,
      {
        postId: neo4j.int(numericPostId),
        skip: neo4j.int(skip),
        limit: neo4j.int(limit),
      }
    );

    const comments = commentsRes.records.map((r) => {
      const cNode = r.get('c').properties;
      const authorNode = r.get('author') ? r.get('author').properties : null;
      const commentId = neo4j.isInt(cNode.commentId) ? cNode.commentId.toInt() : Number(cNode.commentId);
      const authorId = authorNode && authorNode.userId
        ? (neo4j.isInt(authorNode.userId) ? authorNode.userId.toInt() : Number(authorNode.userId))
        : 0;

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
          }
        : {
            userId: 0,
            username: 'unknown',
            fullName: 'Unknown Author',
            isVerified: false,
          };

      return {
        commentId,
        postId: numericPostId,
        text: cNode.text || '',
        content: cNode.text || '',
        createdAt: formatNeo4jDateTime(cNode.createdAt),
        likeCount: 0,
        isLiked: false,
        author,
      };
    });

    const hasMore = skip + comments.length < total;

    res.status(200).json({
      status: 'success',
      data: {
        comments,
        pagination: {
          page,
          limit,
          total,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error('[Get Comments Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve comments from graph database.',
    });
  } finally {
    await session.close();
  }
}

/**
 * Create a comment: POST /api/posts/:postId/comments
 * Requires authenticated session.
 * Allocates comment ID from :_Counter { name: 'Comment' }, creates Comment node,
 * and links (:User)-[:WROTE]->(:Comment)-[:ON_POST]->(:Post) in one managed write transaction.
 */
export async function createComment(req: Request, res: Response): Promise<void> {
  const authorId = req.session?.userId;
  if (!authorId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to comment.',
    });
    return;
  }

  const numericPostId = validateIntegerId(req.params.postId);
  if (!numericPostId) {
    res.status(400).json({
      status: 'error',
      error: 'Invalid postId. Must be a positive integer >= 1.',
    });
    return;
  }

  const bodyParse = createCommentSchema.safeParse(req.body);
  if (!bodyParse.success) {
    const errorMessages = bodyParse.error.issues.map((i) => i.message);
    res.status(400).json({
      status: 'error',
      error: errorMessages[0],
      details: errorMessages,
    });
    return;
  }

  const { text } = bodyParse.data;
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

      // 2. Verify author user exists
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

      // 3. Inspect existing Comment counter and comments to reconcile baseline safely
      const counterCheck = await tx.run(
        `
        OPTIONAL MATCH (c:_Counter { name: 'Comment' })
        WITH c
        OPTIONAL MATCH (existing:Comment)
        RETURN c.current AS counterCurrent, coalesce(max(existing.commentId), 302) AS maxExistingCommentId
        `
      );

      let baseline = 302;
      if (counterCheck.records.length > 0) {
        const rawCounter = counterCheck.records[0].get('counterCurrent');
        const rawMaxComment = counterCheck.records[0].get('maxExistingCommentId');
        const counterVal = rawCounter != null ? (neo4j.isInt(rawCounter) ? rawCounter.toInt() : Number(rawCounter)) : null;
        const maxCommentVal = rawMaxComment != null ? (neo4j.isInt(rawMaxComment) ? rawMaxComment.toInt() : Number(rawMaxComment)) : 302;

        baseline = Math.max(302, counterVal ?? 302, maxCommentVal);
      }

      // 4. Atomically ensure/reconcile Comment counter, increment, create node and both relationships in one Cypher statement
      const createRes = await tx.run(
        `
        MERGE (c:_Counter { name: 'Comment' })
        ON CREATE SET c.current = $baseline, c.createdAt = datetime()
        ON MATCH SET c.current = CASE WHEN c.current < $baseline THEN $baseline ELSE c.current END
        SET c.current = c.current + 1
        WITH c.current AS nextCommentId
        MATCH (u:User { userId: $authorId }), (p:Post { postId: $postId })
        OPTIONAL MATCH (postOwner:User)-[:CREATED]->(p)
        CREATE (cNode:Comment {
          commentId: nextCommentId,
          text: $text,
          createdAt: datetime()
        })
        CREATE (u)-[:WROTE]->(cNode)
        CREATE (cNode)-[:ON_POST]->(p)
        RETURN cNode, u, nextCommentId, postOwner.userId AS postOwnerId, u.username AS actorUsername
        `,
        {
          authorId: neo4j.int(authorId),
          postId: neo4j.int(numericPostId),
          text,
          baseline: neo4j.int(baseline),
        }
      );

      if (createRes.records.length === 0) {
        throw new Error('TRANSACTION_WRITE_FAILED');
      }

      const record = createRes.records[0];
      const rawOwnerId = record.get('postOwnerId');
      const postOwnerId = rawOwnerId ? (neo4j.isInt(rawOwnerId) ? rawOwnerId.toNumber() : Number(rawOwnerId)) : null;
      const actorUsername = record.get('actorUsername') || 'Someone';
      const nextCommentId = record.get('nextCommentId').toInt();

      // 5. Atomically generate comment notification if not self-action
      if (postOwnerId && postOwnerId !== Number(authorId)) {
        const snippet = text.length > 50 ? text.substring(0, 47) + '...' : text;
        await createNotificationInTx(tx, {
          recipientId: postOwnerId,
          actorId: Number(authorId),
          type: 'comment',
          message: `@${actorUsername} commented: "${snippet}"`,
          postId: numericPostId,
          commentId: nextCommentId,
        });
      }

      return record;
    });

    const cNode = result.get('cNode').properties;
    const uNode = result.get('u').properties;
    const nextCommentId = result.get('nextCommentId').toInt();
    const numericAuthorId = neo4j.isInt(uNode.userId) ? uNode.userId.toInt() : Number(uNode.userId);

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
    };

    const newComment = {
      commentId: nextCommentId,
      postId: numericPostId,
      text: cNode.text || text,
      content: cNode.text || text,
      createdAt: formatNeo4jDateTime(cNode.createdAt),
      likeCount: 0,
      isLiked: false,
      author,
    };

    res.status(201).json({
      status: 'success',
      data: {
        comment: newComment,
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
        error: 'Comment sequence counter is not initialized. Please contact the administrator.',
      });
      return;
    }

    console.error('[Create Comment Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to create comment in graph database.',
    });
  } finally {
    await session.close();
  }
}

/**
 * Delete a comment: DELETE /api/comments/:commentId
 * Requires authenticated session.
 * Only the original author is permitted to delete their comment (403 if unauthorized).
 * Deletes the Comment node and its relationships (WROTE, ON_POST) without affecting the Post or User.
 */
export async function deleteComment(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to delete comments.',
    });
    return;
  }

  const numericCommentId = validateIntegerId(req.params.commentId);
  if (!numericCommentId) {
    res.status(400).json({
      status: 'error',
      error: 'Invalid commentId. Must be a positive integer >= 1.',
    });
    return;
  }

  const session = getSession(neo4j.session.WRITE);

  try {
    await session.executeWrite(async (tx) => {
      // 1. Verify comment existence and check original author
      const checkRes = await tx.run(
        `
        MATCH (c:Comment { commentId: $commentId })
        OPTIONAL MATCH (author:User)-[:WROTE]->(c)
        RETURN c.commentId AS commentId, author.userId AS authorId
        `,
        { commentId: neo4j.int(numericCommentId) }
      );

      if (checkRes.records.length === 0) {
        throw new Error('COMMENT_NOT_FOUND');
      }

      const rawAuthorId = checkRes.records[0].get('authorId');
      const authorId = rawAuthorId
        ? (neo4j.isInt(rawAuthorId) ? rawAuthorId.toInt() : Number(rawAuthorId))
        : null;

      // 2. Strict authorization: only the author can delete
      if (authorId !== userId) {
        throw new Error('FORBIDDEN');
      }

      // 3. Atomically delete Comment node and its connected relationships
      await tx.run(
        `
        MATCH (c:Comment { commentId: $commentId })
        DETACH DELETE c
        `,
        { commentId: neo4j.int(numericCommentId) }
      );
    });

    res.status(200).json({
      status: 'success',
      message: 'Comment successfully deleted.',
      data: {
        commentId: numericCommentId,
      },
    });
  } catch (error: any) {
    if (error?.message === 'COMMENT_NOT_FOUND') {
      res.status(404).json({
        status: 'error',
        error: `Comment with ID ${numericCommentId} not found.`,
      });
      return;
    }

    if (error?.message === 'FORBIDDEN') {
      res.status(403).json({
        status: 'error',
        error: 'Forbidden. You can only delete your own comments.',
      });
      return;
    }

    console.error('[Delete Comment Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to delete comment from graph database.',
    });
  } finally {
    await session.close();
  }
}
