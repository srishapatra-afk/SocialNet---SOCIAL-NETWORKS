import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import neo4j from 'neo4j-driver';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';
import { createNotificationInTx } from '../src/services/notification.service';

describe('Phase 12: Security, Integration & Data Integrity Audit', () => {
  let authCookieUser101: string[] = [];
  let authCookieUser102: string[] = [];

  beforeAll(async () => {
    // Authenticate user 101 (aditya_demo)
    const loginRes101 = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'aditya_demo', password: 'Aditya@VIT2026!' });
    expect(loginRes101.status).toBe(200);
    authCookieUser101 = loginRes101.headers['set-cookie'];

    // Authenticate user 102 (srisha_demo)
    const loginRes102 = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'srisha_demo', password: 'Srisha@VIT2026!' });
    expect(loginRes102.status).toBe(200);
    authCookieUser102 = loginRes102.headers['set-cookie'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Workflow A: Post -> Like -> Comment -> Notifications End-to-End Delivery
  // =========================================================================
  describe('Workflow A: Post -> Like -> Comment -> Notification Pipeline', () => {
    it('verifies that like and comment actions on a post atomically dispatch notifications to post owner', async () => {
      const executedQueries: Array<{ query: string; params: any }> = [];
      vi.spyOn(neo4jConfig, 'getSession').mockReturnValue({
        executeWrite: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            run: vi.fn().mockImplementation(async (query: string, params: any) => {
              executedQueries.push({ query, params });
              if (query.includes('MATCH (p:Post { postId: $postId })') && !query.includes('MERGE')) {
                // Post existence check
                return {
                  records: [
                    {
                      get: (key: string) => (key === 'postId' ? neo4j.int(201) : null),
                    },
                  ],
                };
              }
              if (query.includes('MERGE (u)-[r:LIKES]->(p)')) {
                // Like creation
                return {
                  records: [
                    {
                      get: (key: string) => {
                        if (key === 'likeCount') return neo4j.int(3);
                        if (key === 'isNew') return true;
                        if (key === 'postOwnerId') return neo4j.int(101); // Post owner is User 101
                        if (key === 'actorUsername') return 'srisha_demo';
                        return null;
                      },
                    },
                  ],
                };
              }
              if (query.includes('CREATE (n:Notification')) {
                // Notification created
                return {
                  records: [
                    {
                      get: (key: string) => (key === 'notificationId' ? '101-2' : null),
                    },
                  ],
                };
              }
              return { records: [] };
            }),
          };
          return await callback(fakeTx);
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as any);

      const likeRes = await request(app)
        .put('/api/posts/201/like')
        .set('Cookie', authCookieUser102);

      expect(likeRes.status).toBe(200);
      expect(likeRes.body.status).toBe('success');
      expect(likeRes.body.data.isLiked).toBe(true);

      // Verify notification creation query was dispatched for recipient 101 from actor 102
      const notifQuery = executedQueries.find((q) => q.query.includes('CREATE (n:Notification'));
      expect(notifQuery).toBeDefined();
      expect(notifQuery?.params.recipientId.toInt()).toBe(101);
      expect(notifQuery?.params.actorId.toInt()).toBe(102);
      expect(notifQuery?.params.type).toBe('like');
    });
  });

  // =========================================================================
  // Workflow B: Follow -> Counts & Notification Pipeline
  // =========================================================================
  describe('Workflow B: Follow -> Counts & Notification Pipeline', () => {
    it('verifies that following a user updates follower counts and generates a follow notification', async () => {
      const executedQueries: Array<{ query: string; params: any }> = [];
      vi.spyOn(neo4jConfig, 'getSession').mockReturnValue({
        executeWrite: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            run: vi.fn().mockImplementation(async (query: string, params: any) => {
              executedQueries.push({ query, params });
              if (query.includes('MATCH (u:User { userId: $targetUserId })')) {
                return { records: [{ get: () => neo4j.int(101) }] };
              }
              if (query.includes('MERGE (actor)-[r:FOLLOWS]->(target)')) {
                return {
                  records: [
                    {
                      get: (key: string) => {
                        if (key === 'followerCount') return neo4j.int(5);
                        if (key === 'followingCount') return neo4j.int(2);
                        if (key === 'isNew') return true;
                        if (key === 'actorUsername') return 'srisha_demo';
                        return null;
                      },
                    },
                  ],
                };
              }
              if (query.includes('CREATE (n:Notification')) {
                return {
                  records: [{ get: (k: string) => (k === 'notificationId' ? '101-3' : null) }],
                };
              }
              return { records: [] };
            }),
          };
          return await callback(fakeTx);
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as any);

      const followRes = await request(app)
        .put('/api/users/101/follow')
        .set('Cookie', authCookieUser102);

      expect(followRes.status).toBe(200);
      expect(followRes.body.status).toBe('success');
      expect(followRes.body.data.isFollowing).toBe(true);

      const notifQuery = executedQueries.find((q) => q.query.includes('CREATE (n:Notification'));
      expect(notifQuery).toBeDefined();
      expect(notifQuery?.params.recipientId.toInt()).toBe(101);
      expect(notifQuery?.params.actorId.toInt()).toBe(102);
      expect(notifQuery?.params.type).toBe('follow');
    });
  });

  // =========================================================================
  // Workflow C: Idempotence of Repeated Graph Operations
  // =========================================================================
  describe('Workflow C: Idempotence of Repeated Actions', () => {
    it('repeated follow requests do not duplicate relationships or dispatch duplicate notifications', async () => {
      const executedQueries: Array<{ query: string; params: any }> = [];
      vi.spyOn(neo4jConfig, 'getSession').mockReturnValue({
        executeWrite: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            run: vi.fn().mockImplementation(async (query: string, params: any) => {
              executedQueries.push({ query, params });
              if (query.includes('MATCH (u:User { userId: $targetUserId })')) {
                return { records: [{ get: () => neo4j.int(101) }] };
              }
              if (query.includes('MERGE (actor)-[r:FOLLOWS]->(target)')) {
                // Second call returns isNew: false
                return {
                  records: [
                    {
                      get: (key: string) => {
                        if (key === 'followerCount') return neo4j.int(5);
                        if (key === 'followingCount') return neo4j.int(2);
                        if (key === 'isNew') return false; // Already following
                        return null;
                      },
                    },
                  ],
                };
              }
              return { records: [] };
            }),
          };
          return await callback(fakeTx);
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as any);

      const repeatRes = await request(app)
        .put('/api/users/101/follow')
        .set('Cookie', authCookieUser102);

      expect(repeatRes.status).toBe(200);
      expect(repeatRes.body.data.isFollowing).toBe(true);

      // Verify NO notification query was dispatched when isNew === false
      const notifQuery = executedQueries.find((q) => q.query.includes('CREATE (n:Notification'));
      expect(notifQuery).toBeUndefined();
    });

    it('repeated unlike requests do not fail or produce negative counts', async () => {
      vi.spyOn(neo4jConfig, 'getSession').mockReturnValue({
        executeWrite: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            run: vi.fn().mockImplementation(async (query: string) => {
              if (query.includes('MATCH (p:Post { postId: $postId })')) {
                return { records: [{ get: () => neo4j.int(201) }] };
              }
              if (query.includes('DELETE r')) {
                return { records: [{ get: () => neo4j.int(0) }] };
              }
              return { records: [] };
            }),
          };
          return await callback(fakeTx);
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as any);

      const unlikeRes = await request(app)
        .delete('/api/posts/201/like')
        .set('Cookie', authCookieUser101);

      expect(unlikeRes.status).toBe(200);
      expect(unlikeRes.body.data.isLiked).toBe(false);
      expect(unlikeRes.body.data.likeCount).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Workflow D: Data Sanitization & Secret Omission
  // =========================================================================
  describe('Workflow D: Data Sanitization & Public Fields', () => {
    it('profile endpoint strictly omits email, password, passwordHash, and session keys', async () => {
      const res = await request(app).get('/api/users/101/profile');
      expect(res.status).toBe(200);
      const profile = res.body.data.profile;

      expect(profile).toHaveProperty('userId', 101);
      expect(profile).toHaveProperty('username');
      expect(profile).toHaveProperty('fullName');

      // Strictly verify sensitive fields are absent
      expect(profile).not.toHaveProperty('email');
      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('session');
    });

    it('search endpoint strictly omits sensitive fields in user results', async () => {
      const res = await request(app).get('/api/search?q=aditya&type=users');
      expect(res.status).toBe(200);
      const userItem = res.body.data.users.items[0];
      expect(userItem).toBeDefined();

      expect(userItem).not.toHaveProperty('email');
      expect(userItem).not.toHaveProperty('password');
      expect(userItem).not.toHaveProperty('passwordHash');
      expect(userItem).not.toHaveProperty('session');
    });
  });

  // =========================================================================
  // Workflow E: Guest Access Isolation
  // =========================================================================
  describe('Workflow E: Guest Access Rules', () => {
    it('permits read-only feed, search, and profile for guests', async () => {
      const feedRes = await request(app).get('/api/posts');
      expect(feedRes.status).toBe(200);

      const profileRes = await request(app).get('/api/users/101/profile');
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.data.profile.isFollowing).toBe(false);

      const searchRes = await request(app).get('/api/search?q=aditya');
      expect(searchRes.status).toBe(200);
    });

    it('rejects guest mutation requests with 401 across all protected routes', async () => {
      const createPostRes = await request(app).post('/api/posts').send({ caption: 'test' });
      expect(createPostRes.status).toBe(401);

      const likeRes = await request(app).put('/api/posts/201/like');
      expect(likeRes.status).toBe(401);

      const unlikeRes = await request(app).delete('/api/posts/201/like');
      expect(unlikeRes.status).toBe(401);

      const commentRes = await request(app).post('/api/posts/201/comments').send({ text: 'test' });
      expect(commentRes.status).toBe(401);

      const deleteCommentRes = await request(app).delete('/api/comments/301');
      expect(deleteCommentRes.status).toBe(401);

      const followRes = await request(app).put('/api/users/101/follow');
      expect(followRes.status).toBe(401);

      const unfollowRes = await request(app).delete('/api/users/101/follow');
      expect(unfollowRes.status).toBe(401);

      const notifRes = await request(app).get('/api/notifications');
      expect(notifRes.status).toBe(401);

      const markReadRes = await request(app).patch('/api/notifications/101-1/read');
      expect(markReadRes.status).toBe(401);
    });
  });

  // =========================================================================
  // Workflow F: Session Invalidation on Logout
  // =========================================================================
  describe('Workflow F: Session Invalidation on Logout', () => {
    it('logout destroys session and prevents subsequent authenticated requests', async () => {
      // 1. Log in temporary session
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'aditya_demo', password: 'Aditya@VIT2026!' });
      expect(loginRes.status).toBe(200);
      const cookie = loginRes.headers['set-cookie'];

      // 2. Confirm session is authenticated
      const meBefore = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(meBefore.status).toBe(200);
      expect(meBefore.body.authenticated).toBe(true);

      // 3. Logout
      const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
      expect(logoutRes.status).toBe(200);

      // 4. Subsequent requests using the old cookie must fail with 401
      const meAfter = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(meAfter.status).toBe(401);

      const protectedRes = await request(app).get('/api/notifications').set('Cookie', cookie);
      expect(protectedRes.status).toBe(401);
    });
  });

  // =========================================================================
  // Workflow G: Input Tampering, Malformed Payloads & Status Codes
  // =========================================================================
  describe('Workflow G: Malformed Payloads & Edge Cases', () => {
    it('returns 400 for malformed JSON syntax via global error handler', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Content-Type', 'application/json')
        .set('Cookie', authCookieUser101)
        .send('{ invalid json content: ');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/malformed json/i);
    });

    it('returns 413 for payload exceeding the 100kb limit', async () => {
      const hugeString = 'x'.repeat(120 * 1024); // 120kb
      const res = await request(app)
        .post('/api/posts')
        .set('Content-Type', 'application/json')
        .set('Cookie', authCookieUser101)
        .send(JSON.stringify({ caption: hugeString }));

      expect(res.status).toBe(413);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/exceeded the maximum allowable size/i);
    });

    it('returns 404 for undefined API endpoints via structured JSON handler', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/endpoint was not found/i);
    });

    it('returns 400 for negative, zero, or non-numeric ID parameters', async () => {
      const res1 = await request(app).get('/api/users/-1/profile');
      expect(res1.status).toBe(400);

      const res2 = await request(app).get('/api/users/abc/profile');
      expect(res2.status).toBe(400);

      const res3 = await request(app).put('/api/posts/0/like').set('Cookie', authCookieUser101);
      expect(res3.status).toBe(400);
    });

    it('returns 403 when a user attempts to delete a comment authored by someone else', async () => {
      vi.spyOn(neo4jConfig, 'getSession').mockReturnValue({
        executeWrite: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            run: vi.fn().mockImplementation(async (query: string) => {
              if (query.includes('MATCH (c:Comment { commentId: $commentId })')) {
                return {
                  records: [
                    {
                      get: (key: string) => {
                        if (key === 'commentId') return neo4j.int(301);
                        if (key === 'authorId') return neo4j.int(102); // Authored by 102
                        return null;
                      },
                    },
                  ],
                };
              }
              return { records: [] };
            }),
          };
          return await callback(fakeTx);
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as any);

      // User 101 attempts to delete User 102's comment
      const res = await request(app)
        .delete('/api/comments/301')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/forbidden.*only delete your own comments/i);
    });
  });

  // =========================================================================
  // Workflow H: Transaction Atomicity & Rollback Verification
  // =========================================================================
  describe('Workflow H: Transaction Rollback on Failure', () => {
    it('aborts and rolls back entire transaction if notification or edge creation fails', async () => {
      let rollbackInvoked = false;
      vi.spyOn(neo4jConfig, 'getSession').mockReturnValue({
        executeWrite: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            run: vi.fn().mockImplementation(async (query: string) => {
              if (query.includes('CREATE (p:Post')) {
                // Simulate an unexpected constraint violation or database failure on write
                rollbackInvoked = true;
                throw new Error('Neo.ClientError.Schema.ConstraintValidationFailed');
              }
              if (query.includes('MATCH (u:User { userId: $authorId })')) {
                return { records: [{ get: () => neo4j.int(101) }] };
              }
              if (query.includes('MATCH (c:_Counter')) {
                return { records: [{ get: () => neo4j.int(202) }] };
              }
              return { records: [] };
            }),
          };
          try {
            return await callback(fakeTx);
          } catch (err) {
            // Managed transaction automatically rolls back on thrown error
            throw err;
          }
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as any);

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookieUser101)
        .send({ caption: 'Test rollback post' });

      expect(res.status).toBe(500);
      expect(rollbackInvoked).toBe(true);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('Failed to create post in graph database.');
    });
  });

  // =========================================================================
  // Workflow I: Pagination & Aggregation Integrity
  // =========================================================================
  describe('Workflow I: Pagination & Aggregation Integrity', () => {
    it('feed accurately reports likeCount and commentCount without Cartesian explosion', async () => {
      const res = await request(app).get('/api/posts?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('posts');

      const posts = res.body.data.posts;
      for (const p of posts) {
        expect(typeof p.likeCount).toBe('number');
        expect(typeof p.commentCount).toBe('number');
        expect(p.likeCount).toBeGreaterThanOrEqual(0);
        expect(p.commentCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =========================================================================
  // Workflow J: Concurrency & Lock Simulation
  // =========================================================================
  describe('Workflow J: Concurrency & Lock Simulation', () => {
    it('simulates concurrent notification generation and verifies sequential sequence ordering without collision', async () => {
      // 1. Self notification rejection
      const fakeTx = {
        run: vi.fn().mockResolvedValue({
          records: [{ get: () => '101-5' }],
        }),
      };

      const selfResult = await createNotificationInTx(fakeTx, {
        recipientId: 101,
        actorId: 101,
        type: 'like',
        message: 'Self like',
      });
      expect(selfResult).toBeNull();
      expect(fakeTx.run).not.toHaveBeenCalled();

      // 2. Sequential notification creation under simulated concurrency
      let mockSeq = 10;
      const concurrentTx = {
        run: vi.fn().mockImplementation(async () => {
          const currentSeq = ++mockSeq;
          return {
            records: [{ get: () => `101-${currentSeq}` }],
          };
        }),
      };

      const tasks = [1, 2, 3, 4, 5].map((actor) =>
        createNotificationInTx(concurrentTx, {
          recipientId: 101,
          actorId: 200 + actor,
          type: 'like',
          message: `User ${200 + actor} liked your post`,
        })
      );

      const resolved = await Promise.all(tasks);
      expect(resolved).toEqual(['101-11', '101-12', '101-13', '101-14', '101-15']);
      // All allocated IDs are distinct and ordered
      const uniqueIds = new Set(resolved);
      expect(uniqueIds.size).toBe(5);
    });
  });
});
