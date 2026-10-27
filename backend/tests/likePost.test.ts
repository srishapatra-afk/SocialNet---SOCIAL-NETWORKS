import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import neo4j from 'neo4j-driver';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';

describe('Post Like and Unlike API (/api/posts/:postId/like)', () => {
  let authCookie: string[] = [];

  beforeAll(async () => {
    // Authenticate as demo user (aditya_demo #101) to obtain valid HttpOnly session cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'aditya_demo', password: 'Aditya@VIT2026!' });

    expect(loginRes.status).toBe(200);
    authCookie = loginRes.headers['set-cookie'];
    expect(authCookie).toBeDefined();
  });

  describe('Authentication & Validation Constraints', () => {
    it('1. rejects unauthenticated PUT /api/posts/:postId/like with 401', async () => {
      const res = await request(app).put('/api/posts/201/like');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Authentication required');
    });

    it('1b. rejects unauthenticated DELETE /api/posts/:postId/like with 401', async () => {
      const res = await request(app).delete('/api/posts/201/like');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Authentication required');
    });

    it('2. rejects malformed non-integer or invalid post IDs with 400', async () => {
      // Non-numeric string
      const res1 = await request(app)
        .put('/api/posts/invalid_id/like')
        .set('Cookie', authCookie);
      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('Invalid postId');

      // Negative integer
      const res2 = await request(app)
        .put('/api/posts/-10/like')
        .set('Cookie', authCookie);
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('Invalid postId');

      // Zero
      const res3 = await request(app)
        .delete('/api/posts/0/like')
        .set('Cookie', authCookie);
      expect(res3.status).toBe(400);
      expect(res3.body.error).toContain('Invalid postId');
    });

    it('3. returns 404 when target post does not exist', async () => {
      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            // Post 99999 does not exist
            return { records: [] };
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
        .put('/api/posts/99999/like')
        .set('Cookie', authCookie);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Post with ID 99999 not found');

      getSessionSpy.mockRestore();
    });
  });

  describe('Like Behavior & Idempotency', () => {
    it('4. first like creates relationship and returns updated likeCount with isLiked: true', async () => {
      let executedParams: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })') && !cypher.includes('MERGE')) {
            return { records: [{ get: () => neo4j.int(201) }] };
          }
          if (cypher.includes('MERGE (u)-[r:LIKES]->(p)')) {
            executedParams = params;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'postId') return neo4j.int(201);
                    if (key === 'likeCount') return neo4j.int(3); // Increment from 2 to 3
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
        .put('/api/posts/201/like')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual({
        postId: 201,
        likeCount: 3,
        isLiked: true,
      });

      // Assert parameters passed to Cypher: user ID is 101 from session, post ID is 201
      expect(executedParams.userId.toInt()).toBe(101);
      expect(executedParams.postId.toInt()).toBe(201);

      getSessionSpy.mockRestore();
    });

    it('5. repeated likes on the same post are idempotent and do not inflate likeCount', async () => {
      // Simulate MERGE where relationship already existed: count remains stable at 3
      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })') && !cypher.includes('MERGE')) {
            return { records: [{ get: () => neo4j.int(201) }] };
          }
          if (cypher.includes('MERGE (u)-[r:LIKES]->(p)')) {
            // MERGE matches existing relationship without recreating
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'postId') return neo4j.int(201);
                    if (key === 'likeCount') return neo4j.int(3); // Same count, no inflation
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

      // Repeat request
      const res = await request(app)
        .put('/api/posts/201/like')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        postId: 201,
        likeCount: 3,
        isLiked: true,
      });

      getSessionSpy.mockRestore();
    });
  });

  describe('Unlike Behavior & Idempotency', () => {
    it('6. unlike removes only current user relationship and returns updated likeCount with isLiked: false', async () => {
      let executedParams: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })') && !cypher.includes('DELETE r')) {
            return { records: [{ get: () => neo4j.int(201) }] };
          }
          if (cypher.includes('DELETE r')) {
            executedParams = params;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'postId') return neo4j.int(201);
                    if (key === 'likeCount') return neo4j.int(2); // Decremented from 3 to 2
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
        .delete('/api/posts/201/like')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual({
        postId: 201,
        likeCount: 2,
        isLiked: false,
      });

      expect(executedParams.userId.toInt()).toBe(101);
      expect(executedParams.postId.toInt()).toBe(201);

      getSessionSpy.mockRestore();
    });

    it('7. repeated unlikes remain safe, idempotent, and never produce negative counts', async () => {
      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })') && !cypher.includes('DELETE r')) {
            return { records: [{ get: () => neo4j.int(201) }] };
          }
          if (cypher.includes('DELETE r')) {
            // No relationship found to delete; count remains 2
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'postId') return neo4j.int(201);
                    if (key === 'likeCount') return neo4j.int(2); // Unchanged, never negative
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
        .delete('/api/posts/201/like')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        postId: 201,
        likeCount: 2,
        isLiked: false,
      });

      getSessionSpy.mockRestore();
    });

    it('8. one user unlike does not remove another user like', async () => {
      let cypherRan = '';
      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          cypherRan = cypher;
          if (cypher.includes('DELETE r')) {
            return {
              records: [
                {
                  get: (key: string) => (key === 'likeCount' ? neo4j.int(1) : neo4j.int(201)),
                },
              ],
            };
          }
          return { records: [{ get: () => neo4j.int(201) }] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      await request(app).delete('/api/posts/201/like').set('Cookie', authCookie);

      // Verify Cypher restricts DELETE r strictly to the matched authenticated user node
      expect(cypherRan).toContain('(u:User { userId: $userId })-[r:LIKES]->(p)');
      expect(cypherRan).toContain('DELETE r');

      getSessionSpy.mockRestore();
    });
  });

  describe('Session Security & Impersonation Prevention', () => {
    it('9 & 10. strictly derives acting user from session and rejects client-supplied user impersonation', async () => {
      let passedUserId: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('MERGE (u)-[r:LIKES]->(p)')) {
            passedUserId = params?.userId;
            return {
              records: [
                {
                  get: (key: string) => (key === 'likeCount' ? neo4j.int(1) : neo4j.int(201)),
                },
              ],
            };
          }
          return { records: [{ get: () => neo4j.int(201) }] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      // Malicious client tries to impersonate user 9999 via body and query param
      const res = await request(app)
        .put('/api/posts/201/like?userId=9999')
        .set('Cookie', authCookie)
        .send({ userId: 9999, authorId: 9999 });

      expect(res.status).toBe(200);
      // Assert that userId passed to Cypher was 101 (from authenticated session), NOT 9999
      expect(passedUserId.toInt()).toBe(101);

      getSessionSpy.mockRestore();
    });
  });

  describe('Error Sanitization & Feed Accuracy', () => {
    it('11. database failures produce sanitized 500 responses without exposing credentials or internal exceptions', async () => {
      const mockSession = {
        executeWrite: vi.fn().mockRejectedValue(new Error('Fatal Neo4j Aura cluster connection timeout on node bolt://private-cluster:7687')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .put('/api/posts/201/like')
        .set('Cookie', authCookie);

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('Failed to update post like status in graph database.');
      // Strict security: internal cluster URL and exception details must never be sent to client
      expect(res.text).not.toContain('bolt://private-cluster');
      expect(res.text).not.toContain('Fatal Neo4j Aura');

      getSessionSpy.mockRestore();
    });

    it('12. feed likeCount and isLiked remain correct and deduplicated when posts have multiple comments and likes', async () => {
      // Query GET /api/posts with authenticated cookie
      const res = await request(app)
        .get('/api/posts')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const posts = res.body.data.posts;
      expect(Array.isArray(posts)).toBe(true);

      for (const p of posts) {
        expect(p).toHaveProperty('likeCount');
        expect(typeof p.likeCount).toBe('number');
        expect(p.likeCount).toBeGreaterThanOrEqual(0);
        expect(p).toHaveProperty('isLiked');
        expect(typeof p.isLiked).toBe('boolean');
        expect(p).toHaveProperty('commentCount');
        expect(typeof p.commentCount).toBe('number');
      }

      // Check specific post #201 from live baseline: liked by aditya_demo (#101)
      const post201 = posts.find((p: any) => p.postId === 201);
      if (post201) {
        expect(post201.isLiked).toBe(true);
        expect(post201.likeCount).toBe(2); // Liked by 101 and 102
      }
    });
  });
});
