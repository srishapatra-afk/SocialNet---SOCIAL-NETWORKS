import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import neo4j from 'neo4j-driver';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';

describe('Search & Discovery API (/api/search)', () => {
  let authCookieUser101: string[] = [];

  beforeAll(async () => {
    // Authenticate user 101 (aditya_demo)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'aditya_demo', password: 'Aditya@VIT2026!' });
    expect(loginRes.status).toBe(200);
    authCookieUser101 = loginRes.headers['set-cookie'];
  });

  // ==========================================
  // 1. Input Validation & Edge Cases
  // ==========================================
  describe('Input Validation & Error Responses', () => {
    it('rejects missing search query with 400', async () => {
      const res = await request(app).get('/api/search');
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/required/i);
    });

    it('rejects empty query with 400', async () => {
      const res = await request(app).get('/api/search?q=');
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/cannot be empty/i);
    });

    it('rejects whitespace-only query with 400', async () => {
      const res = await request(app).get('/api/search?q=   ');
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/cannot be empty or whitespace only/i);
    });

    it('rejects query exceeding 100 characters with 400', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await request(app).get(`/api/search?q=${longQuery}`);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/cannot exceed 100 characters/i);
    });

    it('rejects invalid search type with 400', async () => {
      const res = await request(app).get('/api/search?q=test&type=invalid_type');
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toMatch(/type must be one of/i);
    });

    it('rejects invalid page number (< 1 or non-numeric) with 400', async () => {
      const res1 = await request(app).get('/api/search?q=test&page=0');
      expect(res1.status).toBe(400);
      expect(res1.body.status).toBe('error');

      const res2 = await request(app).get('/api/search?q=test&page=abc');
      expect(res2.status).toBe(400);
      expect(res2.body.status).toBe('error');
    });

    it('rejects invalid limit (<= 0 or > 50) with 400', async () => {
      const res1 = await request(app).get('/api/search?q=test&limit=0');
      expect(res1.status).toBe(400);
      expect(res1.body.status).toBe('error');

      const res2 = await request(app).get('/api/search?q=test&limit=100');
      expect(res2.status).toBe(400);
      expect(res2.body.status).toBe('error');
    });
  });

  // ==========================================
  // 2. User Search Functionality
  // ==========================================
  describe('User Search Semantics', () => {
    it('finds user by exact username (case-insensitive)', async () => {
      const res = await request(app).get('/api/search?q=ADITYA_DEMO&type=users');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.users.items.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.users.items.find(
        (u: any) => u.username === 'aditya_demo'
      );
      expect(found).toBeDefined();
      expect(found.userId).toBe(101);
      expect(found.fullName).toBe('Aditya Shaw');
    });

    it('finds user by partial name (firstName or lastName)', async () => {
      const res = await request(app).get('/api/search?q=Patra&type=users');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const found = res.body.data.users.items.find(
        (u: any) => u.username === 'srisha_demo'
      );
      expect(found).toBeDefined();
      expect(found.userId).toBe(102);
      expect(found.fullName).toBe('Srisha Patra');
    });

    it('sanitizes public user fields and never exposes email or password hashes', async () => {
      const res = await request(app).get('/api/search?q=aditya&type=users');
      expect(res.status).toBe(200);

      const user = res.body.data.users.items[0];
      expect(user).toBeDefined();
      expect(user).toHaveProperty('userId');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('fullName');
      expect(user).toHaveProperty('avatarUrl');
      expect(user).toHaveProperty('followerCount');
      expect(user).toHaveProperty('followingCount');
      expect(user).toHaveProperty('postCount');

      // Strict security verification
      expect(user).not.toHaveProperty('email');
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('session');
    });

    it('correctly sets isFollowing=false for guests and computes isFollowing for authenticated viewer', async () => {
      // Guest query
      const guestRes = await request(app).get('/api/search?q=srisha&type=users');
      expect(guestRes.status).toBe(200);
      const guestUser = guestRes.body.data.users.items.find((u: any) => u.userId === 102);
      expect(guestUser?.isFollowing).toBe(false);

      // Authenticated User 101 query (computes isFollowing for authenticated viewer)
      const authRes = await request(app)
        .get('/api/search?q=srisha&type=users')
        .set('Cookie', authCookieUser101);
      expect(authRes.status).toBe(200);
      const authUser = authRes.body.data.users.items.find((u: any) => u.userId === 102);
      expect(typeof authUser?.isFollowing).toBe('boolean');
    });
  });

  // ==========================================
  // 3. Post Search Functionality
  // ==========================================
  describe('Post Search Semantics', () => {
    it('finds post by caption keyword (case-insensitive)', async () => {
      const res = await request(app).get('/api/search?q=BEAUTIFUL&type=posts');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.posts.items.length).toBeGreaterThanOrEqual(1);

      const post = res.body.data.posts.items[0];
      expect(post.postId).toBe(202);
      expect(post.content).toMatch(/beautiful day/i);
      expect(post.author).toBeDefined();
      expect(post.author.username).toBeDefined();
      expect(post).toHaveProperty('likeCount');
      expect(post).toHaveProperty('commentCount');
    });

    it('computes accurate like and comment counts without join explosion', async () => {
      const res = await request(app).get('/api/search?q=first%20social&type=posts');
      expect(res.status).toBe(200);

      const post = res.body.data.posts.items.find((p: any) => p.postId === 201);
      expect(post).toBeDefined();
      expect(post.likeCount).toBe(2);
      expect(post.commentCount).toBeGreaterThanOrEqual(1);
    });

    it('sets isLiked=false for guests and reports accurate isLiked for authenticated viewer', async () => {
      // Guest query for Post 201
      const guestRes = await request(app).get('/api/search?q=first%20social&type=posts');
      const guestPost = guestRes.body.data.posts.items.find((p: any) => p.postId === 201);
      expect(guestPost?.isLiked).toBe(false);

      // User 101 has liked Post 201 in baseline graph
      const authRes = await request(app)
        .get('/api/search?q=first%20social&type=posts')
        .set('Cookie', authCookieUser101);
      const authPost = authRes.body.data.posts.items.find((p: any) => p.postId === 201);
      expect(authPost?.isLiked).toBe(true);
    });
  });

  // ==========================================
  // 4. Combined Search & Type Filtering
  // ==========================================
  describe('Combined Search & Type Filtering', () => {
    it('returns both users and posts when type=all (default)', async () => {
      const res = await request(app).get('/api/search?q=a');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('posts');
      expect(res.body.data.type).toBe('all');
      expect(Array.isArray(res.body.data.users.items)).toBe(true);
      expect(Array.isArray(res.body.data.posts.items)).toBe(true);
    });

    it('returns empty posts array when type=users', async () => {
      const res = await request(app).get('/api/search?q=a&type=users');
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('users');
      expect(res.body.data.users.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.posts.items).toEqual([]);
      expect(res.body.data.posts.total).toBe(0);
    });

    it('returns empty users array when type=posts', async () => {
      const res = await request(app).get('/api/search?q=a&type=posts');
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('posts');
      expect(res.body.data.posts.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.users.items).toEqual([]);
      expect(res.body.data.users.total).toBe(0);
    });

    it('safely handles special characters without Cypher injection or error', async () => {
      const specialQuery = ".*+?^${}()|[]\\'";
      const res = await request(app).get(`/api/search?q=${encodeURIComponent(specialQuery)}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.users.items).toEqual([]);
      expect(res.body.data.posts.items).toEqual([]);
    });

    it('supports pagination metadata and limit', async () => {
      const res = await request(app).get('/api/search?q=a&page=1&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.data.users.limit).toBe(1);
      expect(res.body.data.users.page).toBe(1);
      expect(res.body.data.users.items.length).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================
  // 5. Sanitized Database Error Handling
  // ==========================================
  describe('Database Error Sanitization', () => {
    it('returns sanitized 500 when database query throws without leaking internal details', async () => {
      const sessionSpy = vi.spyOn(neo4jConfig, 'getSession').mockReturnValue({
        run: vi.fn().mockRejectedValue(new Error('Internal Neo4j Aura cluster connection reset')),
        close: vi.fn().mockResolvedValue(undefined),
      } as any);

      const res = await request(app).get('/api/search?q=test');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('An internal error occurred while processing your search request.');
      // Verify no sensitive cluster or Cypher details leaked
      expect(JSON.stringify(res.body)).not.toMatch(/cluster/i);
      expect(JSON.stringify(res.body)).not.toMatch(/neo4j/i);

      sessionSpy.mockRestore();
    });
  });
});
