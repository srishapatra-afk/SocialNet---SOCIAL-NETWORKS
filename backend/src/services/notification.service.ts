import neo4j from 'neo4j-driver';

export interface CreateNotificationParams {
  recipientId: number;
  actorId: number;
  type: 'follow' | 'like' | 'comment';
  message: string;
  postId?: number;
  commentId?: number;
}

/**
 * Creates a Notification node and (:User)-[:RECEIVES_NOTIFICATION]->(:Notification) edge
 * atomically inside an existing managed Neo4j transaction.
 *
 * Rules:
 * - Recipient and actor must be different users (self-notifications are strictly prevented).
 * - Generates deterministic "<recipientId>-<seq>" identifier.
 * - Rolls back automatically if the parent transaction fails.
 */
export async function createNotificationInTx(
  tx: any,
  params: CreateNotificationParams
): Promise<string | null> {
  const { recipientId, actorId, type, message, postId, commentId } = params;

  // Rule: Never generate a notification for self-actions
  if (recipientId === actorId) {
    return null;
  }

  const result = await tx.run(
    `
    MATCH (recipient:User { userId: $recipientId }), (actor:User { userId: $actorId })
    WHERE recipient.userId <> actor.userId
    WITH recipient, actor,
         coalesce(recipient.notificationSeq, COUNT { (recipient)-[:RECEIVES_NOTIFICATION]->(:Notification) }) + 1 AS nextSeq
    SET recipient.notificationSeq = nextSeq
    WITH recipient, actor, nextSeq, toString(recipient.userId) + '-' + toString(nextSeq) AS notifId
    CREATE (n:Notification {
      notificationId: notifId,
      notificationSequence: nextSeq,
      type: $type,
      message: $message,
      actorId: actor.userId,
      actorUsername: actor.username,
      actorName: coalesce(trim(coalesce(actor.firstName, '') + ' ' + coalesce(actor.lastName, '')), actor.username),
      actorAvatarUrl: actor.avatarUrl,
      postId: $postId,
      commentId: $commentId,
      isRead: false,
      createdAt: datetime()
    })
    CREATE (recipient)-[:RECEIVES_NOTIFICATION]->(n)
    RETURN n.notificationId AS notificationId
    `,
    {
      recipientId: neo4j.int(recipientId),
      actorId: neo4j.int(actorId),
      type,
      message,
      postId: postId !== undefined ? neo4j.int(postId) : null,
      commentId: commentId !== undefined ? neo4j.int(commentId) : null,
    }
  );

  if (result.records.length > 0) {
    return result.records[0].get('notificationId');
  }

  return null;
}
