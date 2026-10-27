import { Request, Response } from 'express';
import { z } from 'zod';
import neo4j from 'neo4j-driver';
import { getSession } from '../config/neo4j';
import { formatNeo4jDateTime } from './post.controller';

/**
 * Pagination schema for notifications.
 */
const notificationQuerySchema = z.object({
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
    .default('20')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 50, {
      message: 'limit must be an integer between 1 and 50',
    }),
});

/**
 * Validate notification ID (expected format "<recipientUserId>-<sequence>" or alphanumeric string).
 */
export function validateNotificationId(rawId: string): boolean {
  if (!rawId || typeof rawId !== 'string') return false;
  const trimmed = rawId.trim();
  return /^[a-zA-Z0-9_\-]+$/.test(trimmed) && trimmed.length <= 50;
}

/**
 * GET /api/notifications
 * List paginated notifications for the authenticated user, ordered newest first.
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in to view notifications.',
    });
    return;
  }

  const parseResult = notificationQuerySchema.safeParse(req.query);
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

  const session = getSession(neo4j.session.READ);
  try {
    // 1. Total count
    const countRes = await session.run(
      `
      MATCH (:User { userId: $userId })-[:RECEIVES_NOTIFICATION]->(n:Notification)
      RETURN count(n) AS total
      `,
      { userId: neo4j.int(userId) }
    );

    const totalRaw = countRes.records[0]?.get('total');
    const total = neo4j.isInt(totalRaw) ? totalRaw.toNumber() : Number(totalRaw || 0);

    // 2. Fetch notifications with actor join
    const queryResult = await session.run(
      `
      MATCH (u:User { userId: $userId })-[:RECEIVES_NOTIFICATION]->(n:Notification)
      OPTIONAL MATCH (actor:User { userId: n.actorId })
      RETURN n, actor
      ORDER BY coalesce(n.createdAt, datetime({year: 1970})) DESC, n.notificationSequence DESC
      SKIP $skip
      LIMIT $limit
      `,
      {
        userId: neo4j.int(userId),
        skip: neo4j.int(skip),
        limit: neo4j.int(limit),
      }
    );

    const notifications = queryResult.records.map((record) => {
      const nProps = record.get('n').properties;
      const actorNode = record.get('actor') ? record.get('actor').properties : null;

      // Extract actor details, favoring live node properties, then stored snapshot, then defaults
      const actorId = actorNode?.userId
        ? neo4j.isInt(actorNode.userId)
          ? actorNode.userId.toNumber()
          : Number(actorNode.userId)
        : nProps.actorId
        ? neo4j.isInt(nProps.actorId)
          ? nProps.actorId.toNumber()
          : Number(nProps.actorId)
        : null;

      const actorUsername = actorNode?.username || nProps.actorUsername || 'user';
      const actorFullName = actorNode
        ? `${actorNode.firstName || ''} ${actorNode.lastName || ''}`.trim() || actorUsername
        : nProps.actorName || actorUsername;

      const actorAvatarUrl =
        actorNode?.avatarUrl ||
        nProps.actorAvatarUrl ||
        (actorId === 101
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
          : actorId === 102
          ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80');

      // Detect event type (backward compatible with baseline nodes that have message only)
      let type: 'follow' | 'like' | 'comment' | 'system' = nProps.type || 'system';
      if (!nProps.type && nProps.message) {
        const msg = String(nProps.message).toLowerCase();
        if (msg.includes('follower') || msg.includes('follow')) type = 'follow';
        else if (msg.includes('like')) type = 'like';
        else if (msg.includes('comment')) type = 'comment';
      }

      const postId = nProps.postId
        ? neo4j.isInt(nProps.postId)
          ? nProps.postId.toNumber()
          : Number(nProps.postId)
        : undefined;

      const commentId = nProps.commentId
        ? neo4j.isInt(nProps.commentId)
          ? nProps.commentId.toNumber()
          : Number(nProps.commentId)
        : undefined;

      const notificationSequence = nProps.notificationSequence
        ? neo4j.isInt(nProps.notificationSequence)
          ? nProps.notificationSequence.toNumber()
          : Number(nProps.notificationSequence)
        : 1;

      return {
        notificationId: String(nProps.notificationId),
        notificationSequence,
        type,
        message: String(nProps.message || 'New notification'),
        isRead: Boolean(nProps.isRead),
        createdAt: formatNeo4jDateTime(nProps.createdAt),
        actor: actorId
          ? {
              userId: actorId,
              username: actorUsername,
              fullName: actorFullName,
              avatarUrl: actorAvatarUrl,
              isVerified: true,
            }
          : undefined,
        postId,
        commentId,
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + notifications.length < total,
        },
      },
    });
  } catch (error) {
    console.error('[Get Notifications Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while retrieving notifications.',
    });
  } finally {
    await session.close();
  }
}

/**
 * GET /api/notifications/unread-count
 * Return unread notification count for the authenticated user.
 */
export async function getUnreadNotificationCount(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in.',
    });
    return;
  }

  const session = getSession(neo4j.session.READ);
  try {
    const result = await session.run(
      `
      MATCH (:User { userId: $userId })-[:RECEIVES_NOTIFICATION]->(n:Notification { isRead: false })
      RETURN count(n) AS unreadCount
      `,
      { userId: neo4j.int(userId) }
    );

    const rawCount = result.records[0]?.get('unreadCount');
    const unreadCount = neo4j.isInt(rawCount) ? rawCount.toNumber() : Number(rawCount || 0);

    res.status(200).json({
      status: 'success',
      data: { unreadCount },
    });
  } catch (error) {
    console.error('[Get Unread Count Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while retrieving unread notification count.',
    });
  } finally {
    await session.close();
  }
}

/**
 * PATCH /api/notifications/:notificationId/read
 * Mark one of the authenticated user's notifications as read.
 */
export async function markNotificationAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in.',
    });
    return;
  }

  const notificationId = req.params.notificationId;
  if (!validateNotificationId(notificationId)) {
    res.status(400).json({
      status: 'error',
      error: 'Invalid notificationId parameter.',
    });
    return;
  }

  const session = getSession(neo4j.session.WRITE);
  try {
    const result = await session.executeWrite(async (tx) => {
      const updateRes = await tx.run(
        `
        MATCH (u:User { userId: $userId })-[:RECEIVES_NOTIFICATION]->(n:Notification { notificationId: $notificationId })
        SET n.isRead = true
        RETURN n.notificationId AS notificationId, n.isRead AS isRead
        `,
        {
          userId: neo4j.int(userId),
          notificationId,
        }
      );

      if (updateRes.records.length === 0) {
        return null;
      }
      return updateRes.records[0];
    });

    if (!result) {
      res.status(404).json({
        status: 'error',
        error: `Notification with ID '${notificationId}' not found or does not belong to you.`,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        notificationId,
        isRead: true,
      },
    });
  } catch (error) {
    console.error('[Mark Notification Read Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while updating notification status.',
    });
  } finally {
    await session.close();
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications for the authenticated user as read.
 */
export async function markAllNotificationsAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. Please log in.',
    });
    return;
  }

  const session = getSession(neo4j.session.WRITE);
  try {
    const result = await session.executeWrite(async (tx) => {
      const updateRes = await tx.run(
        `
        MATCH (u:User { userId: $userId })-[:RECEIVES_NOTIFICATION]->(n:Notification { isRead: false })
        SET n.isRead = true
        RETURN count(n) AS updatedCount
        `,
        { userId: neo4j.int(userId) }
      );
      const rawCount = updateRes.records[0]?.get('updatedCount');
      return neo4j.isInt(rawCount) ? rawCount.toNumber() : Number(rawCount || 0);
    });

    res.status(200).json({
      status: 'success',
      data: {
        updatedCount: result,
      },
    });
  } catch (error) {
    console.error('[Mark All Read Error]:', error);
    res.status(500).json({
      status: 'error',
      error: 'An internal error occurred while marking all notifications as read.',
    });
  } finally {
    await session.close();
  }
}
