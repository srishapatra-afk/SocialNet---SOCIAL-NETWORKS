import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import neo4j from 'neo4j-driver';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';

describe('User Profile & Follow/Unfollow API (/api/users)', () => {
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
  // 1. GET /api/users/:userId/profile
  // ==========================================
  describe('GET /api/users/:userId/profile', () => {
    it('returns 200 and public profile for existing user as a guest viewer', async () => {
      const res = await request(app).get('/api/users/101/profile');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('profile');

      const profile = res.body.data.profile;
      expect(profile.userId).toBe(101);
      expect(profile.username).toBe('aditya_demo');
      expect(profile.fullName).toBe('Aditya Shaw');
      expect(profile).toHaveProperty('postCount');
      expect(profile).toHaveProperty('followerCount');
      expect(profile).toHaveProperty('followingCount');
      expect(profile.isFollowing).toBe(false);
      expect(profile.isOwnProfile).toBe(false);

      // SECURITY: Ensure private fields and hashes are never exposed
      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('email');
    });

    it('correctly reports isFollowing=true when viewer follows target user', async () => {
      const mockSession = {
        run: vi.fn(async () => ({
          records: [
            {
              get: (key: string) => {
                if (key === 'userId') return neo4j.int(102);
                if (key === 'username') return 'srisha_demo';
                if (key === 'firstName') return 'Srisha';
                if (key === 'lastName') return 'Patra';
                if (key === 'isFollowing') return true;
                if (key === 'postCount') return neo4j.int(1);
                if (key === 'followerCount') return neo4j.int(1);
                if (key === 'followingCount') return neo4j.int(0);
                return null;
              },
            },
          ],
        })),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .get('/api/users/102/profile')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      const profile = res.body.data.profile;
      expect(profile.userId).toBe(102);
      expect(profile.isFollowing).toBe(true);
      expect(profile.isOwnProfile).toBe(false);

      getSessionSpy.mockRestore();
    });

    it('correctly reports isFollowing=false when viewer does not follow target user', async () => {
      // User 102 does NOT follow User 101 in baseline database
      const res = await request(app)
        .get('/api/users/101/profile')
        .set('Cookie', authCookieUser102);

      expect(res.status).toBe(200);
      const profile = res.body.data.profile;
      expect(profile.userId).toBe(101);
      expect(profile.isFollowing).toBe(false);
      expect(profile.isOwnProfile).toBe(false);
    });

    it('correctly reports isOwnProfile=true when user views their own profile', async () => {
      const res = await request(app)
        .get('/api/users/101/profile')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      const profile = res.body.data.profile;
      expect(profile.userId).toBe(101);
      expect(profile.isOwnProfile).toBe(true);
    });

    it('rejects malformed user IDs with 400', async () => {
      const res1 = await request(app).get('/api/users/invalid/profile');
      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('User ID must be a positive integer');

      const res2 = await request(app).get('/api/users/-1/profile');
      expect(res2.status).toBe(400);

      const res3 = await request(app).get('/api/users/0/profile');
      expect(res3.status).toBe(400);
    });

    it('returns 404 when requested user does not exist', async () => {
      const res = await request(app).get('/api/users/99999/profile');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('User with ID 99999 not found');
    });

    it('returns sanitized 500 when database error occurs during profile fetch', async () => {
      const mockSession = {
        run: vi.fn().mockRejectedValue(new Error('Sensitive cluster timeout on bolt://internal-node:7687')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app).get('/api/users/101/profile');
      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('An internal error occurred while retrieving user profile.');
      expect(res.text).not.toContain('bolt://');
      expect(res.text).not.toContain('Sensitive cluster timeout');

      getSessionSpy.mockRestore();
    });
  });

  // ==========================================
  // 2. GET /api/users/:userId/posts
  // ==========================================
  describe('GET /api/users/:userId/posts', () => {
    it('returns 200 and paginated user posts for existing user', async () => {
      const res = await request(app).get('/api/users/101/posts?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('posts');
      expect(res.body.data).toHaveProperty('pagination');

      const { posts, pagination } = res.body.data;
      expect(Array.isArray(posts)).toBe(true);
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('limit', 10);
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('hasMore');

      if (posts.length > 0) {
        const post = posts[0];
        expect(post).toHaveProperty('postId');
        expect(post).toHaveProperty('caption');
        expect(post).toHaveProperty('author');
        expect(post.author.userId).toBe(101);
      }
    });

    it('returns 404 if user does not exist', async () => {
      const res = await request(app).get('/api/users/99999/posts');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('User with ID 99999 not found');
    });

    it('rejects invalid pagination parameters with 400', async () => {
      const res = await request(app).get('/api/users/101/posts?page=0&limit=100');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // 3. PUT /api/users/:userId/follow
  // ==========================================
  describe('PUT /api/users/:userId/follow', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).put('/api/users/102/follow');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Authentication required');
    });

    it('returns 400 when attempting to follow self', async () => {
      const res = await request(app)
        .put('/api/users/101/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('You cannot follow yourself.');
    });

    it('returns 400 for malformed target user ID', async () => {
      const res = await request(app)
        .put('/api/users/invalid/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('User ID must be a positive integer');
    });

    it('returns 404 when target user does not exist', async () => {
      const res = await request(app)
        .put('/api/users/99999/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('User with ID 99999 not found');
    });

    it('atomically creates FOLLOWS relationship using managed write transaction without test writes hitting live database', async () => {
      let executedCypher = '';
      let passedActorId: any = null;
      let passedTargetId: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('MATCH (u:User { userId: $targetUserId })')) {
            return { records: [{ get: () => neo4j.int(102) }] };
          }
          if (cypher.includes('MERGE (actor)-[r:FOLLOWS]->(target)')) {
            executedCypher = cypher;
            passedActorId = params.actingUserId;
            passedTargetId = params.targetUserId;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'followerCount') return neo4j.int(2);
                    if (key === 'followingCount') return neo4j.int(0);
                    if (key === 'isFollowing') return true;
                    return null;
                  },
                },
              ],
            };
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
        .set('Cookie', authCookieUser101)
        .send({ actingUserId: 9999, userId: 9999 }); // Impersonation attempt in body

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual({
        userId: 102,
        followerCount: 2,
        followingCount: 0,
        isFollowing: true,
      });

      // Verify that actorId was derived strictly from session (101), not body (9999)
      expect(passedActorId.toInt()).toBe(101);
      expect(passedTargetId.toInt()).toBe(102);

      // Verify correct relationship direction
      expect(executedCypher).toContain('MERGE (actor)-[r:FOLLOWS]->(target)');
      expect(executedCypher).toContain('ON CREATE SET r.createdAt = datetime()');

      getSessionSpy.mockRestore();
    });

    it('returns sanitized 500 when follow transaction fails', async () => {
      const mockSession = {
        executeWrite: vi.fn().mockRejectedValue(new Error('Neo.TransientError.Transaction.DeadlockDetected on follow')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .put('/api/users/102/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('An internal error occurred while updating follow status.');
      expect(res.text).not.toContain('Neo.TransientError');

      getSessionSpy.mockRestore();
    });
  });

  // ==========================================
  // 4. DELETE /api/users/:userId/follow
  // ==========================================
  describe('DELETE /api/users/:userId/follow', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).delete('/api/users/102/follow');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Authentication required');
    });

    it('returns 400 when attempting to unfollow self', async () => {
      const res = await request(app)
        .delete('/api/users/101/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('You cannot unfollow yourself.');
    });

    it('returns 404 when target user does not exist', async () => {
      const res = await request(app)
        .delete('/api/users/99999/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('User with ID 99999 not found');
    });

    it('atomically deletes only the acting user relationship without affecting other relationships', async () => {
      let executedCypher = '';
      let passedActorId: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('MATCH (u:User { userId: $targetUserId })')) {
            return { records: [{ get: () => neo4j.int(102) }] };
          }
          if (cypher.includes('DELETE r')) {
            executedCypher = cypher;
            passedActorId = params.actingUserId;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'followerCount') return neo4j.int(0);
                    if (key === 'followingCount') return neo4j.int(0);
                    if (key === 'isFollowing') return false;
                    return null;
                  },
                },
              ],
            };
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
        .delete('/api/users/102/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual({
        userId: 102,
        followerCount: 0,
        followingCount: 0,
        isFollowing: false,
      });

      // Verify that actorId was derived strictly from session
      expect(passedActorId.toInt()).toBe(101);

      // Verify scoped deletion: OPTIONAL MATCH (actor)-[r:FOLLOWS]->(target) DELETE r
      expect(executedCypher).toContain('OPTIONAL MATCH (actor:User { userId: $actingUserId })-[r:FOLLOWS]->(target)');
      expect(executedCypher).toContain('DELETE r');

      getSessionSpy.mockRestore();
    });

    it('repeated unfollow requests are safe and idempotent', async () => {
      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (u:User { userId: $targetUserId })')) {
            return { records: [{ get: () => neo4j.int(102) }] };
          }
          if (cypher.includes('DELETE r')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'followerCount') return neo4j.int(0);
                    if (key === 'followingCount') return neo4j.int(0);
                    if (key === 'isFollowing') return false;
                    return null;
                  },
                },
              ],
            };
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      // Second unfollow attempt
      const res = await request(app)
        .delete('/api/users/102/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(200);
      expect(res.body.data.isFollowing).toBe(false);

      getSessionSpy.mockRestore();
    });

    it('returns sanitized 500 when unfollow transaction encounters unexpected failure', async () => {
      const mockSession = {
        executeWrite: vi.fn().mockRejectedValue(new Error('Sensitive cluster disk failure')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .delete('/api/users/102/follow')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('An internal error occurred while updating follow status.');
      expect(res.text).not.toContain('Sensitive cluster disk failure');

      getSessionSpy.mockRestore();
    });
  });
});
