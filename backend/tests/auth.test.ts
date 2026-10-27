import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server';

describe('Authentication API (/api/auth)', () => {
  describe('POST /api/auth/login', () => {
    it('returns 400 if identifier or password is missing', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 401 generic failure for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'non_existent_user_99999', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid username/email or password');
    });

    it('returns 401 generic failure for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'aditya_demo', password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid username/email or password');
    });

    it('returns 200 and sets session cookie for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'aditya_demo', password: 'Aditya@VIT2026!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.user).toHaveProperty('username', 'aditya_demo');
      expect(res.body.user).toHaveProperty('userId', 101);
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('passwordHash');

      // Verify session cookie is set and is HttpOnly
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const sessionCookie = cookieHeader.find((c: string) => c.startsWith('socialnet.sid='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
    });
  });

  describe('GET /api/auth/me and Session Persistence', () => {
    it('returns 401 when no session cookie is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ authenticated: false });
    });

    it('returns 200 and user profile when valid session cookie is provided', async () => {
      // 1. Log in to get session cookie
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'srisha_demo', password: 'Srisha@VIT2026!' });

      expect(loginRes.status).toBe(200);
      const cookie = loginRes.headers['set-cookie'];

      // 2. Query /api/auth/me with session cookie
      const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(meRes.status).toBe(200);
      expect(meRes.body).toHaveProperty('authenticated', true);
      expect(meRes.body.user).toHaveProperty('username', 'srisha_demo');
      expect(meRes.body.user).toHaveProperty('userId', 102);
      expect(meRes.body.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /api/auth/register Validation', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Test',
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when password is too short (< 8 chars)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Test',
        lastName: 'User',
        username: 'test_short_pwd',
        email: 'test@example.com',
        password: 'short',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8 characters');
    });

    it('returns 409 Conflict when attempting to register existing username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Aditya',
        lastName: 'Duplicate',
        username: 'aditya_demo',
        email: 'completely_different_email_123@example.com',
        password: 'SecurePassword123!',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already taken');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('destroys session and clears session cookie', async () => {
      // 1. Log in
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'aditya_demo', password: 'Aditya@VIT2026!' });

      const cookie = loginRes.headers['set-cookie'];

      // 2. Logout
      const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body).toHaveProperty('status', 'success');

      // 3. Verify /api/auth/me now returns 401 unauthenticated
      const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(meRes.status).toBe(401);
      expect(meRes.body).toEqual({ authenticated: false });
    });
  });
});
