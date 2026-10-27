import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/server';
import * as neo4jConfig from '../src/config/neo4j';

describe('GET /api/health', () => {
  it('returns 200 and database connected when Neo4j is available', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('database', 'connected');
    expect(res.body).toHaveProperty('timestamp');

    // Strict security check: ensure no secrets, stack traces or queries are leaked
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('uri');
    expect(res.body).not.toHaveProperty('error');
    expect(res.text).not.toContain('neo4j+s://');
  });

  it('returns 503 and database disconnected when Neo4j connectivity fails', async () => {
    // Simulate database outage by mocking checkDatabaseConnectivity to return false
    const connectivitySpy = vi
      .spyOn(neo4jConfig, 'checkDatabaseConnectivity')
      .mockResolvedValueOnce(false);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'degraded');
    expect(res.body).toHaveProperty('database', 'disconnected');
    expect(res.body).toHaveProperty('timestamp');

    // Strict security check: no internal error details or stack traces
    expect(res.body).not.toHaveProperty('error');
    expect(res.body).not.toHaveProperty('stack');
    expect(res.text).not.toContain('neo4j+s://');

    connectivitySpy.mockRestore();
  });
});
