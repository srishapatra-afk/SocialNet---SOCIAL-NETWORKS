import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import neo4j from 'neo4j-driver';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';

describe('Comments API (/api/posts/:postId/comments & /api/comments/:commentId)', () => {
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

  describe('GET /api/posts/:postId/comments (Read Comments & Pagination)', () => {
    it('returns 200 and paginated comments structure for existing post', async () => {
      const res = await request(app).get('/api/posts/201/comments?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('comments');
      expect(res.body.data).toHaveProperty('pagination');

      const { comments, pagination } = res.body.data;
      expect(Array.isArray(comments)).toBe(true);
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('limit', 10);
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('hasMore');

      if (comments.length > 0) {
        const c = comments[0];
        expect(c).toHaveProperty('commentId');
        expect(c).toHaveProperty('postId', 201);
        expect(c).toHaveProperty('text');
        expect(c).toHaveProperty('content');
        expect(c).toHaveProperty('createdAt');
        expect(c).toHaveProperty('author');
        expect(c.author).toHaveProperty('userId');
        expect(c.author).toHaveProperty('username');
        // Security check: passwords/hashes must never be exposed
        expect(c.author).not.toHaveProperty('password');
        expect(c.author).not.toHaveProperty('passwordHash');
      }
    });

    it('rejects malformed post IDs with 400', async () => {
      const res1 = await request(app).get('/api/posts/invalid/comments');
      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('Invalid postId');

      const res2 = await request(app).get('/api/posts/-1/comments');
      expect(res2.status).toBe(400);

      const res3 = await request(app).get('/api/posts/0/comments');
      expect(res3.status).toBe(400);
    });

    it('rejects invalid pagination parameters with 400', async () => {
      const res1 = await request(app).get('/api/posts/201/comments?page=0');
      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('page must be a positive integer');

      const res2 = await request(app).get('/api/posts/201/comments?limit=100');
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('limit must be an integer between 1 and 50');
    });

    it('returns 404 when target post does not exist', async () => {
      const mockSession = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [] }; // Post 99999 not found
          }
          return { records: [] };
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app).get('/api/posts/99999/comments');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Post with ID 99999 not found');

      getSessionSpy.mockRestore();
    });
  });

  describe('POST /api/posts/:postId/comments (Create Comment & Validation)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/posts/201/comments')
        .send({ text: 'Valid comment text' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects empty comment text with 400', async () => {
      const res = await request(app)
        .post('/api/posts/201/comments')
        .set('Cookie', authCookieUser101)
        .send({ text: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Comment text cannot be empty');
    });

    it('rejects whitespace-only comment text with 400', async () => {
      const res = await request(app)
        .post('/api/posts/201/comments')
        .set('Cookie', authCookieUser101)
        .send({ text: '    \n\t   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Comment text cannot be empty or whitespace only');
    });

    it('rejects oversized comment text (> 1,000 chars) with 400', async () => {
      const res = await request(app)
        .post('/api/posts/201/comments')
        .set('Cookie', authCookieUser101)
        .send({ text: 'c'.repeat(1001) });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cannot exceed 1000 characters');
    });

    it('returns 404 when attempting to comment on non-existent post', async () => {
      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [] }; // Post 99999 not found
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
        .post('/api/posts/99999/comments')
        .set('Cookie', authCookieUser101)
        .send({ text: 'Valid text on missing post' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Post with ID 99999 not found');

      getSessionSpy.mockRestore();
    });

    it('creates comment with both relationships in single managed transaction, strictly deriving author from session', async () => {
      let executedCypher = '';
      let passedAuthorId: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('CREATE (cNode:Comment')) {
            executedCypher = cypher;
            passedAuthorId = params?.authorId;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'cNode') {
                      return {
                        properties: {
                          commentId: neo4j.int(303),
                          text: params.text,
                          createdAt: { toISOString: () => '2026-10-24T18:30:00.000Z' },
                        },
                      };
                    }
                    if (key === 'u') {
                      return {
                        properties: {
                          userId: neo4j.int(101),
                          username: 'aditya_demo',
                          firstName: 'Aditya',
                          lastName: 'Sharma',
                        },
                      };
                    }
                    if (key === 'nextCommentId') return neo4j.int(303);
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes("MATCH (c:_Counter { name: 'Comment' })")) {
            return { records: [{ get: () => neo4j.int(302) }] };
          }
          if (cypher.includes('MATCH (u:User { userId: $authorId })')) {
            return { records: [{ get: () => neo4j.int(101) }] };
          }
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [{ get: () => neo4j.int(201) }] };
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
        .post('/api/posts/201/comments')
        .set('Cookie', authCookieUser101)
        .send({
          text: 'Super insightful graph post!',
          authorId: 9999, // Impersonation attempt
          userId: 9999,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('comment');

      const comment = res.body.data.comment;
      expect(comment.commentId).toBe(303);
      expect(comment.postId).toBe(201);
      expect(comment.text).toBe('Super insightful graph post!');
      expect(comment.content).toBe('Super insightful graph post!');
      expect(comment.author.userId).toBe(101);
      expect(comment.author.username).toBe('aditya_demo');

      // Verify that authorId in Cypher came strictly from session (101), not body (9999)
      expect(passedAuthorId.toInt()).toBe(101);

      // Verify both relationships are created in the same statement
      expect(executedCypher).toContain('CREATE (u)-[:WROTE]->(cNode)');
      expect(executedCypher).toContain('CREATE (cNode)-[:ON_POST]->(p)');
      expect(executedCypher).toContain('SET c.current = c.current + 1');

      getSessionSpy.mockRestore();
    });

    it('safely auto-initializes and reconciles Comment counter when missing without throwing 500 error', async () => {
      let executedMerge = '';
      let passedBaseline: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('CREATE (cNode:Comment')) {
            executedMerge = cypher;
            passedBaseline = params?.baseline;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'cNode') {
                      return {
                        properties: {
                          commentId: neo4j.int(303),
                          text: params.text,
                          createdAt: { toISOString: () => '2026-10-24T18:30:00.000Z' },
                        },
                      };
                    }
                    if (key === 'u') {
                      return {
                        properties: {
                          userId: neo4j.int(101),
                          username: 'aditya_demo',
                        },
                      };
                    }
                    if (key === 'nextCommentId') return neo4j.int(303);
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes("OPTIONAL MATCH (c:_Counter { name: 'Comment' })")) {
            // Counter node does not exist in graph yet; highest existing commentId is 302
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'counterCurrent') return null;
                    if (key === 'maxExistingCommentId') return neo4j.int(302);
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes('MATCH (u:User { userId: $authorId })')) {
            return { records: [{ get: () => neo4j.int(101) }] };
          }
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [{ get: () => neo4j.int(201) }] };
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
        .post('/api/posts/201/comments')
        .set('Cookie', authCookieUser101)
        .send({ text: 'Testing safe counter auto-initialization' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.comment.commentId).toBe(303);

      // Verify MERGE is used to atomically initialize counter if missing
      expect(executedMerge).toContain("MERGE (c:_Counter { name: 'Comment' })");
      expect(executedMerge).toContain('ON CREATE SET c.current = $baseline');
      expect(passedBaseline.toInt()).toBe(302);

      getSessionSpy.mockRestore();
    });

    it('reconciles counter against existing comment IDs greater than 302 and never resets to lower value', async () => {
      let passedBaseline: any = null;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('CREATE (cNode:Comment')) {
            passedBaseline = params?.baseline;
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'cNode') {
                      return {
                        properties: {
                          commentId: neo4j.int(401),
                          text: params.text,
                          createdAt: { toISOString: () => '2026-10-24T18:30:00.000Z' },
                        },
                      };
                    }
                    if (key === 'u') {
                      return {
                        properties: {
                          userId: neo4j.int(101),
                          username: 'aditya_demo',
                        },
                      };
                    }
                    if (key === 'nextCommentId') return neo4j.int(401);
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes("OPTIONAL MATCH (c:_Counter { name: 'Comment' })")) {
            // Counter node is 302, but a comment with ID 400 exists in database
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'counterCurrent') return neo4j.int(302);
                    if (key === 'maxExistingCommentId') return neo4j.int(400);
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes('MATCH (u:User { userId: $authorId })')) {
            return { records: [{ get: () => neo4j.int(101) }] };
          }
          if (cypher.includes('MATCH (p:Post { postId: $postId })')) {
            return { records: [{ get: () => neo4j.int(201) }] };
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
        .post('/api/posts/201/comments')
        .set('Cookie', authCookieUser101)
        .send({ text: 'Testing reconciliation against ID 400' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.comment.commentId).toBe(401);

      // Reconciled baseline must be 400, never resetting to 302
      expect(passedBaseline.toInt()).toBe(400);

      getSessionSpy.mockRestore();
    });
  });

  describe('DELETE /api/comments/:commentId (Delete Comment & Authorization)', () => {
    it('rejects unauthenticated deletion with 401', async () => {
      const res = await request(app).delete('/api/comments/301');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects malformed comment IDs with 400', async () => {
      const res = await request(app)
        .delete('/api/comments/invalid_id')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid commentId');
    });

    it('returns 404 when target comment does not exist', async () => {
      const mockTx = {
        run: vi.fn(async () => ({ records: [] })), // Comment not found
      };
      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .delete('/api/comments/99999')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Comment with ID 99999 not found');

      getSessionSpy.mockRestore();
    });

    it('returns 403 Forbidden when a non-author attempts to delete another user comment', async () => {
      // Comment 301 is authored by user 102 (srisha_demo). User 101 tries to delete it.
      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('MATCH (c:Comment { commentId: $commentId })')) {
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
      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .delete('/api/comments/301')
        .set('Cookie', authCookieUser101); // User 101 attempting delete

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden. You can only delete your own comments');

      getSessionSpy.mockRestore();
    });

    it('allows author to successfully delete their own comment, isolating deletion strictly to the comment node', async () => {
      let deleteCypher = '';

      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('DETACH DELETE c')) {
            deleteCypher = cypher;
            return { records: [] };
          }
          if (cypher.includes('MATCH (c:Comment { commentId: $commentId })')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'commentId') return neo4j.int(302);
                    if (key === 'authorId') return neo4j.int(101); // Authored by 101
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
        .delete('/api/comments/302')
        .set('Cookie', authCookieUser101); // User 101 deleting own comment 302

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('Comment successfully deleted');
      expect(res.body.data.commentId).toBe(302);

      // Verify deletion only targets c:Comment and does NOT touch Post or User nodes
      expect(deleteCypher).toContain('MATCH (c:Comment { commentId: $commentId })');
      expect(deleteCypher).toContain('DETACH DELETE c');
      expect(deleteCypher).not.toContain('DELETE p');
      expect(deleteCypher).not.toContain('DELETE u');

      getSessionSpy.mockRestore();
    });

    it('repeated deletion attempts are safe and return 404 once deleted', async () => {
      // Simulate comment already deleted from graph
      const mockTx = {
        run: vi.fn(async () => ({ records: [] })),
      };
      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .delete('/api/comments/302')
        .set('Cookie', authCookieUser101);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');

      getSessionSpy.mockRestore();
    });
  });

  describe('Database Error Sanitization', () => {
    it('returns sanitized 500 when database transaction encounters unexpected failure', async () => {
      const mockSession = {
        executeWrite: vi.fn().mockRejectedValue(new Error('Fatal connection fault to neo4j+s://private-cluster.databases.neo4j.io:7687')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .post('/api/posts/201/comments')
        .set('Cookie', authCookieUser101)
        .send({ text: 'Testing database error sanitization' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create comment in graph database.');
      // Ensure zero sensitive URLs or stack traces are leaked
      expect(res.text).not.toContain('neo4j+s://');
      expect(res.text).not.toContain('private-cluster');

      getSessionSpy.mockRestore();
    });
  });
});
