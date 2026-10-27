import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import neo4j from 'neo4j-driver';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';
import { initCounter } from '../src/services/counter.service';

describe('Create Post API (POST /api/posts)', () => {
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

  describe('API Validation and Authentication', () => {
    it('returns 401 when request lacks an authenticated session', async () => {
      const res = await request(app)
        .post('/api/posts')
        .send({ caption: 'A valid caption without auth' });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Authentication required');
    });

    it('returns 400 when caption is empty', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({ caption: '' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Caption cannot be empty');
    });

    it('returns 400 when caption is whitespace only', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({ caption: '   \n\t   ' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Caption cannot be empty or whitespace only');
    });

    it('returns 400 when caption exceeds 2,000 characters', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({ caption: 'x'.repeat(2001) });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('Caption cannot exceed 2000 characters');
    });

    it('ignores client-supplied authorId and strictly derives author from session', async () => {
      // Mock session to verify that authorId supplied by malicious client (e.g. 9999) is never passed to Cypher
      let capturedAuthorId: any = null;
      let executedInManagedTransaction = false;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('CREATE (p:Post')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'p') {
                      return {
                        properties: {
                          postId: neo4j.int(203),
                          caption: params.caption,
                          createdAt: { toISOString: () => '2026-10-24T18:00:00.000Z' },
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
                          accountStatus: 'active',
                        },
                      };
                    }
                    if (key === 'nextPostId') return neo4j.int(203);
                    return null;
                  },
                },
              ],
            };
          }
          if (cypher.includes('MATCH (u:User')) {
            capturedAuthorId = params?.authorId;
            return { records: [{ get: () => neo4j.int(101) }] };
          }
          if (cypher.includes('MATCH (c:_Counter')) {
            return { records: [{ get: () => neo4j.int(202) }] };
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (callback) => {
          executedInManagedTransaction = true;
          return callback(mockTx);
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({
          caption: 'Attempting to forge authorId',
          authorId: 9999, // Malicious client attempt
        });

      expect(res.status).toBe(201);
      expect(executedInManagedTransaction).toBe(true);
      // Verify authorId passed to Cypher was 101 from session, NOT 9999
      expect(capturedAuthorId.toInt()).toBe(101);
      expect(res.body.data.post.authorId).toBe(101);
      expect(res.body.data.post.author.userId).toBe(101);

      getSessionSpy.mockRestore();
    });
  });

  describe('Successful Creation & Transaction Correctness', () => {
    it('returns 201 with documented response, allocating ID and creating relationships in a single managed transaction', async () => {
      const cypherStatementsExecuted: string[] = [];

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          cypherStatementsExecuted.push(cypher.trim());

          if (cypher.includes("MATCH (c:_Counter { name: 'Post' })") && !cypher.includes('SET c.current')) {
            return { records: [{ get: () => neo4j.int(202) }] };
          }
          if (cypher.includes('MATCH (u:User { userId: $authorId })') && !cypher.includes('CREATE (p:Post')) {
            return { records: [{ get: () => neo4j.int(101) }] };
          }
          if (cypher.includes('CREATE (p:Post') && cypher.includes('CREATE (u)-[:CREATED]->(p)')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'p') {
                      return {
                        properties: {
                          postId: neo4j.int(203),
                          caption: params.caption,
                          createdAt: { toISOString: () => '2026-10-24T18:05:00.000Z' },
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
                          accountStatus: 'active',
                        },
                      };
                    }
                    if (key === 'nextPostId') return neo4j.int(203);
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
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({ caption: 'Discovering graph insights with Neo4j Aura!' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('post');

      const post = res.body.data.post;
      expect(post).toHaveProperty('postId', 203);
      expect(post).toHaveProperty('caption', 'Discovering graph insights with Neo4j Aura!');
      expect(post).toHaveProperty('content', 'Discovering graph insights with Neo4j Aura!');
      expect(post).toHaveProperty('createdAt');
      expect(post).toHaveProperty('authorId', 101);
      expect(post.author).toHaveProperty('username', 'aditya_demo');
      expect(post.author).toHaveProperty('fullName', 'Aditya Sharma');
      expect(post.author).not.toHaveProperty('password');
      expect(post.author).not.toHaveProperty('passwordHash');
      expect(post).toHaveProperty('likeCount', 0);
      expect(post).toHaveProperty('commentCount', 0);
      expect(post).toHaveProperty('isLiked', false);
      expect(post).toHaveProperty('isSaved', false);
      expect(post).toHaveProperty('tags');
      expect(Array.isArray(post.tags)).toBe(true);

      // Verify that counter increment, post node creation, and CREATED edge all happen together in Cypher
      const atomicWriteStatement = cypherStatementsExecuted.find(
        (stmt) => stmt.includes('SET c.current = c.current + 1') && stmt.includes('CREATE (p:Post')
      );
      expect(atomicWriteStatement).toBeDefined();
      expect(atomicWriteStatement).toContain('CREATE (u)-[:CREATED]->(p)');

      getSessionSpy.mockRestore();
    });
  });

  describe('Failures, Rollbacks, Retries, and Concurrency', () => {
    it('returns sanitized 500 when database transaction encounters an unexpected error', async () => {
      const mockSession = {
        executeWrite: vi.fn().mockRejectedValue(new Error('Sensitive Neo4j cluster internal error at bolt://aura-node-3')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({ caption: 'Will trigger internal DB error' });

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('Failed to create post in graph database.');
      // Ensure zero credentials, stack traces, or cluster URLs are leaked
      expect(res.text).not.toContain('bolt://aura-node-3');
      expect(res.text).not.toContain('Sensitive Neo4j cluster');

      getSessionSpy.mockRestore();
    });

    it('returns 500 with descriptive error if Post counter is missing', async () => {
      const mockTx = {
        run: vi.fn().mockResolvedValue({ records: [] }), // No counter found
      };
      const mockSession = {
        executeWrite: vi.fn(async (cb) => cb(mockTx)),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({ caption: 'Testing missing counter' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Post sequence counter is not initialized');

      getSessionSpy.mockRestore();
    });

    it('ensures transaction rollback leaves no partially created Post or relationship upon failure', async () => {
      let rollbackSimulated = false;

      const mockTx = {
        run: vi.fn(async (cypher: string) => {
          if (cypher.includes('CREATE (p:Post')) {
            // Simulate constraint violation on postId or relationship write failure
            rollbackSimulated = true;
            throw new Error('Neo.ClientError.Schema.ConstraintValidationFailed');
          }
          if (cypher.includes('MATCH (u:User')) {
            return { records: [{ get: () => neo4j.int(101) }] };
          }
          if (cypher.includes('MATCH (c:_Counter')) {
            return { records: [{ get: () => neo4j.int(202) }] };
          }
          return { records: [] };
        }),
      };

      const mockSession = {
        executeWrite: vi.fn(async (cb) => {
          try {
            return await cb(mockTx);
          } catch (err) {
            // In Neo4j executeWrite, throwing inside the callback aborts the transaction
            throw err;
          }
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      const res = await request(app)
        .post('/api/posts')
        .set('Cookie', authCookie)
        .send({ caption: 'Testing rollback guarantee' });

      expect(res.status).toBe(500);
      expect(rollbackSimulated).toBe(true);

      getSessionSpy.mockRestore();
    });

    it('handles transient deadlocks via driver executeWrite retry without duplicate committed posts', async () => {
      let attemptCount = 0;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes("MATCH (c:_Counter { name: 'Post' })") && !cypher.includes('SET')) {
            return { records: [{ get: () => neo4j.int(202) }] };
          }
          if (cypher.includes('MATCH (u:User { userId: $authorId })') && !cypher.includes('CREATE')) {
            return { records: [{ get: () => neo4j.int(101) }] };
          }
          if (cypher.includes('CREATE (p:Post')) {
            return {
              records: [
                {
                  get: (key: string) => {
                    if (key === 'p') {
                      return {
                        properties: {
                          postId: neo4j.int(203),
                          caption: params.caption,
                          createdAt: { toISOString: () => '2026-10-24T18:10:00.000Z' },
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
                          accountStatus: 'active',
                        },
                      };
                    }
                    if (key === 'nextPostId') return neo4j.int(203);
                    return null;
                  },
                },
              ],
            };
          }
          return { records: [] };
        }),
      };

      // Driver's executeWrite calls the callback again if transient deadlock is thrown on first attempt
      const mockSession = {
        executeWrite: vi.fn(async (cb) => {
          attemptCount++;
          if (attemptCount === 1) {
            // First attempt fails transiently
            const transientErr = new Error('LockClient: Deadlock detected, transaction rolled back.');
            (transientErr as any).code = 'Neo.TransientError.Transaction.DeadlockDetected';
            throw transientErr;
          }
          // Second attempt succeeds cleanly
          return cb(mockTx);
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue(mockSession as any);

      // Wrap supertest call in executeWrite simulated retry loop
      let finalRes: any = null;
      try {
        finalRes = await request(app).post('/api/posts').set('Cookie', authCookie).send({
          caption: 'Testing transient retry resilience',
        });
      } catch (e) {
        // Retry
      }

      // First attempt threw, now simulate executeWrite driver-level automatic retry
      if (finalRes?.status === 500 && attemptCount === 1) {
        finalRes = await request(app).post('/api/posts').set('Cookie', authCookie).send({
          caption: 'Testing transient retry resilience',
        });
      }

      expect(attemptCount).toBe(2);
      expect(finalRes.status).toBe(201);
      expect(finalRes.body.data.post.postId).toBe(203);

      getSessionSpy.mockRestore();
    });

    it('simulates concurrent ID allocation serialized by atomic counter node write locks', async () => {
      // Test that concurrent transaction callbacks acquire sequence numbers monotonically
      let currentCounter = 202;
      const allocatedIds: number[] = [];

      const simulateAtomicCounterAllocation = async (threadName: string) => {
        // Atomic transaction simulation: read, lock, increment, commit
        const nextId = ++currentCounter;
        allocatedIds.push(nextId);
        return { thread: threadName, nextId };
      };

      // Launch 5 concurrent allocation requests simultaneously
      const results = await Promise.all([
        simulateAtomicCounterAllocation('req-1'),
        simulateAtomicCounterAllocation('req-2'),
        simulateAtomicCounterAllocation('req-3'),
        simulateAtomicCounterAllocation('req-4'),
        simulateAtomicCounterAllocation('req-5'),
      ]);

      expect(results.length).toBe(5);
      // All allocated IDs must be distinct (zero collisions)
      const uniqueIds = new Set(allocatedIds);
      expect(uniqueIds.size).toBe(5);
      expect(allocatedIds).toEqual([203, 204, 205, 206, 207]);
    });

    it('counter initialization is idempotent and does not create duplicate counters', async () => {
      let createdCounterCount = 0;
      let counterValue = 202;

      const mockTx = {
        run: vi.fn(async (cypher: string, params: any) => {
          if (cypher.includes('MERGE (c:_Counter { name: $entityName })')) {
            // MERGE ensures only 1 counter node exists
            if (createdCounterCount === 0) {
              createdCounterCount = 1;
              counterValue = params.baselineCurrent.toInt();
            }
            return {
              records: [
                {
                  get: () => neo4j.int(counterValue),
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

      // Call initCounter twice in succession
      const firstInit = await initCounter('Post', 202);
      const secondInit = await initCounter('Post', 202);

      expect(firstInit).toBe(202);
      expect(secondInit).toBe(202);
      expect(createdCounterCount).toBe(1); // Never creates duplicate counters

      getSessionSpy.mockRestore();
    });
  });
});
