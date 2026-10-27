import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import neo4j from 'neo4j-driver';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';
import { createNotificationInTx } from '../src/services/notification.service';

describe('Notifications API (/api/notifications)', () => {
  let authCookieUser101: string[] = [];
  let authCookieUser102: string[] = [];

  beforeAll(async () => {
    // 1. Authenticate user 101 (aditya_demo)
    const loginRes101 = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'aditya_demo', password: 'Aditya@VIT2026!' });
    expect(loginRes101.status).toBe(200);
    authCookieUser101 = loginRes101.headers['set-cookie'];

    // 2. Authenticate user 102 (srisha_demo)
    const loginRes102 = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'srisha_demo', password: 'Srisha@VIT2026!' });
    expect(loginRes102.status).toBe(200);
    authCookieUser102 = loginRes102.headers['set-cookie'];
  });

  // ==========================================
  // 1. GET /api/notifications (Listing & Pagination)
  // ==========================================
  describe('GET /api/notifications', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Authentication required');
    });

    it('returns 200 and notifications for authenticated user (user isolation verified)', async () => {
      // User 102 in baseline database has notification '102-1'
      const res = await request(app)
        .get('/api/notifications?page=1&limit=20')
        .set('Cookie', authCookieUser102);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('notifications');
      expect(res.body.data).toHaveProperty('pagination');

      const { notifications, pagination } = res.body.data;
      expect(Array.isArray(notifications)).toBe(true);
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(20);

      if (notifications.length > 0) {
        const notif = notifications[0];
        expect(notif).toHaveProperty('notificationId');
        // Isolation check: notification ID prefix must belong to user 102
        expect(notif.notificationId.startsWith('102-')).toBe(true);
        expect(notif).toHaveProperty('message');
        expect(notif).toHaveProperty('isRead');
        expect(notif).toHaveProperty('createdAt');
      }
    });

    it('rejects invalid pagination parameters with 400', async () => {
      const res1 = await request(app)
        .get('/api/notifications?page=0&limit=10')
        .set('Cookie', authCookieUser101);
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .get('/api/notifications?page=1&limit=999')
        .set('Cookie', authCookieUser101);
      expect(res2.status).toBe(400);
    });

    it('returns sanitized 500 when database error occurs during listing', async () => {
      const mockSession = {
        run: vi.fn().mockRejectedValue(new Error('Internal Bolt cluster connection drop on node 2')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('An internal error occurred while retrieving notifications.');
      expect(res.text).not.toContain('Internal Bolt cluster');

      getSessionSpy.mockRestore();
    });
  });

  // ==========================================
  // 2. GET /api/notifications/unread-count
  // ==========================================
  describe('GET /api/notifications/unread-count', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).get('/api/notifications/unread-count');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('returns 200 and unread count for authenticated user', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Cookie', authCookieUser102);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('unreadCount');
      expect(typeof res.body.data.unreadCount).toBe('number');
    });
  });

  // ==========================================
  // 3. PATCH /api/notifications/:notificationId/read
  // ==========================================
  describe('PATCH /api/notifications/:notificationId/read', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).patch('/api/notifications/101-1/read');
      expect(res.status).toBe(401);
    });

    it('rejects invalid notification IDs with 400', async () => {
      const res = await request(app)
        .patch('/api/notifications/invalid$$$/read')
        .set('Cookie', authCookieUser101);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid notificationId');
    });

    it('returns 404 when notification does not exist or belongs to another user', async () => {
      // User 101 attempting to mark User 102's notification '102-1' as read
      const res = await request(app)
        .patch('/api/notifications/102-1/read')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('not found or does not belong to you');
    });

    it('marks the authenticated user notification as read in a write transaction', async () => {
      let executedCypher = '';
      let passedUserId: any = null;
      let passedNotifId = '';

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          executedCypher = cypher;
          passedUserId = params.userId;
          passedNotifId = params.notificationId;
          return {
            records: [
              {
                get: (key: string) => {
                  if (key === 'notificationId') return '101-1';
                  if (key === 'isRead') return true;
                  return null;
                },
              },
            ],
          };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .patch('/api/notifications/101-1/read')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual({
        notificationId: '101-1',
        isRead: true,
      });

      // Verify strict user scoping in Cypher
      expect(executedCypher).toContain('MATCH (u:User { userId: $userId })-[:RECEIVES_NOTIFICATION]->(n:Notification { notificationId: $notificationId })');
      expect(passedUserId.toInt()).toBe(101);
      expect(passedNotifId).toBe('101-1');

      getSessionSpy.mockRestore();
    });
  });

  // ==========================================
  // 4. PATCH /api/notifications/read-all
  // ==========================================
  describe('PATCH /api/notifications/read-all', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).patch('/api/notifications/read-all');
      expect(res.status).toBe(401);
    });

    it('marks all notifications as read for authenticated user', async () => {
      const mockTx = {
        run: vi.fn(async () => ({
          records: [{ get: () => neo4j.int(3) }],
        })),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.updatedCount).toBe(3);

      getSessionSpy.mockRestore();
    });
  });

  // ==========================================
  // 5. Atomic Notification Generation with Originating Events
  // ==========================================
  describe('Originating Event Notification Generation Logic', () => {
    it('createNotificationInTx strictly rejects self-notifications', async () => {
      const mockTx = { run: vi.fn() };
      const notifId = await createNotificationInTx(mockTx, {
        recipientId: 101,
        actorId: 101, // Self-action
        type: 'like',
        message: 'You liked your post',
      });

      expect(notifId).toBeNull();
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('createNotificationInTx creates Notification node and RECEIVES_NOTIFICATION edge', async () => {
      let executedCypher = '';
      let passedParams: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          executedCypher = cypher;
          passedParams = params;
          return {
            records: [{ get: () => '102-2' }],
          };
        }),
      };

      const notifId = await createNotificationInTx(mockTx, {
        recipientId: 102,
        actorId: 101,
        type: 'follow',
        message: '@aditya_demo started following you.',
      });

      expect(notifId).toBe('102-2');
      expect(executedCypher).toContain('CREATE (recipient)-[:RECEIVES_NOTIFICATION]->(n)');
      expect(executedCypher).toContain('WHERE recipient.userId <> actor.userId');
      expect(passedParams.recipientId.toInt()).toBe(102);
      expect(passedParams.actorId.toInt()).toBe(101);
      expect(passedParams.type).toBe('follow');
    });

    it('followUser atomically invokes createNotificationInTx when follow relationship is new', async () => {
      let followCypher = '';
      let notifCreated = false;

      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (u:User { userId: $targetUserId })')) {
            return { records: [{ get: () => neo4j.int(102) }] };
          }
          if (cypher.includes('MERGE (actor)-[r:FOLLOWS]->(target)')) {
            followCypher = cypher;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'followerCount') return neo4j.int(1);
                    if (key === 'followingCount') return neo4j.int(0);
                    if (key === 'isNew') return true;
                    if (key === 'actorUsername') return 'aditya_demo';
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes('RECEIVES_NOTIFICATION')) {
            notifCreated = true;
            return { records: [{ get: () => '102-2' }] };
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .put('/api/users/102/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(followCypher).toContain('MERGE (actor)-[r:FOLLOWS]->(target)');
      expect(notifCreated).toBe(true);

      getSessionSpy.mockRestore();
    });

    it('repeated follow requests (isNew=false) do NOT trigger notification creation', async () => {
      let notifCreated = false;

      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (u:User { userId: $targetUserId })')) {
            return { records: [{ get: () => neo4j.int(102) }] };
          }
          if (cypher.includes('MERGE (actor)-[r:FOLLOWS]->(target)')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'followerCount') return neo4j.int(1);
                    if (key === 'followingCount') return neo4j.int(0);
                    if (key === 'isNew') return false; // Already following
                    if (key === 'actorUsername') return 'aditya_demo';
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes('RECEIVES_NOTIFICATION')) {
            notifCreated = true;
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .put('/api/users/102/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(notifCreated).toBe(false);

      getSessionSpy.mockRestore();
    });

    it('likePost atomically invokes createNotificationInTx when like is new and actor is not post owner', async () => {
      let notifCreated = false;

      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [{ get: () => neo4j.int(202) }] };
          }
          if (cypher.includes('MERGE (u)-[r:LIKES]->(p)')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'likeCount') return neo4j.int(1);
                    if (key === 'isNew') return true;
                    if (key === 'postOwnerId') return neo4j.int(102); // Post belongs to user 102
                    if (key === 'actorUsername') return 'aditya_demo';
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes('RECEIVES_NOTIFICATION')) {
            notifCreated = true;
            return { records: [{ get: () => '102-3' }] };
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .put('/api/posts/202/like')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(notifCreated).toBe(true);

      getSessionSpy.mockRestore();
    });

    it('self-like does NOT generate notification', async () => {
      let notifCreated = false;

      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [{ get: () => neo4j.int(201) }] };
          }
          if (cypher.includes('MERGE (u)-[r:LIKES]->(p)')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'likeCount') return neo4j.int(1);
                    if (key === 'isNew') return true;
                    if (key === 'postOwnerId') return neo4j.int(101); // Post belongs to actor (self-like)
                    if (key === 'actorUsername') return 'aditya_demo';
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes('RECEIVES_NOTIFICATION')) {
            notifCreated = true;
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .put('/api/posts/201/like')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(notifCreated).toBe(false);

      getSessionSpy.mockRestore();
    });

    it('unlikePost does NOT generate any notification', async () => {
      let notifCreated = false;

      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [{ get: () => neo4j.int(201) }] };
          }
          if (cypher.includes('DELETE r')) {
            return {
              records: [{ get: () => neo4j.int(0) }],
            };
          }
          if (cypher.includes('RECEIVES_NOTIFICATION')) {
            notifCreated = true;
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .delete('/api/posts/201/like')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(notifCreated).toBe(false);

      getSessionSpy.mockRestore();
    });
  });
});
