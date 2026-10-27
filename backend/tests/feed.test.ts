import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';

describe('Social Feed API (GET /api/posts)', () => {
  it('returns 200 and documented feed structure with posts and pagination', async () => {
    const res = await request(app).get('/api/posts');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'success');
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
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('caption');
      expect(post).toHaveProperty('createdAt');
      expect(post).toHaveProperty('likeCount');
      expect(post).toHaveProperty('commentCount');
      expect(post).toHaveProperty('author');
      expect(post.author).toHaveProperty('userId');
      expect(post.author).toHaveProperty('username');

      // Strict security assertions: ensure no passwords, hashes, or secrets are exposed
      expect(post.author).not.toHaveProperty('password');
      expect(post.author).not.toHaveProperty('passwordHash');
      expect(res.text).not.toContain('neo4j+s://');
    }
  });

  describe('Query Parameter Validation', () => {
    it('returns 400 when page is less than 1', async () => {
      const res = await request(app).get('/api/posts?page=0');
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('page must be a positive integer');
    });

    it('returns 400 when page is not a number', async () => {
      const res = await request(app).get('/api/posts?page=invalid');
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('returns 400 when limit exceeds maximum of 50', async () => {
      const res = await request(app).get('/api/posts?limit=100');
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toContain('limit must be an integer between 1 and 50');
    });

    it('supports valid custom page and limit parameters', async () => {
      const res = await request(app).get('/api/posts?page=1&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.limit).toBe(1);
      expect(res.body.data.posts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Sanitized Database Error Handling', () => {
    it('returns 500 with sanitized message when database query fails', async () => {
      // Mock session to simulate unexpected database driver exception
      const mockSession = {
        run: vi.fn().mockRejectedValue(new Error('Simulated Bolt connection timeout')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const getSessionSpy = vi
        .spyOn(neo4jConfig, 'getSession')
        .mockReturnValueOnce(mockSession as any);

      const res = await request(app).get('/api/posts');

      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(res.body.error).toBe('Failed to retrieve social feed from graph database.');
      // Strict security: internal exception message must never be sent to client
      expect(res.text).not.toContain('Simulated Bolt connection timeout');

      getSessionSpy.mockRestore();
    });
  });
});
