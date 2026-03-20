import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let dbPath: string;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  dbPath = join(tmpdir(), `synergy-app-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const store = createStore(dbPath);
  app = createApp({ store });
});

afterEach(() => {
  if (existsSync(dbPath)) unlinkSync(dbPath);
});

describe('GET /api/health', () => {
  it('returns 503 when GEMINI_API_KEY is not set', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  });

  it('returns 200 when GEMINI_API_KEY is set', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /api/openapi.json', () => {
  it('returns the OpenAPI spec object', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths).toHaveProperty('/prompts');
  });
});

describe('GET /api/docs', () => {
  it('returns HTML with Swagger UI', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
    expect(res.text).toContain('/api/openapi.json');
  });
});

describe('POST /api/gemini/generate-content', () => {
  it('returns 400 when contents is missing', async () => {
    const res = await request(app).post('/api/gemini/generate-content').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('contents');
  });

  it('returns 400 when contents exceeds 50k characters', async () => {
    const res = await request(app)
      .post('/api/gemini/generate-content')
      .send({ contents: 'x'.repeat(50001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('large');
  });
});

describe('API_SECRET auth', () => {
  it('returns 401 when API_SECRET is set and key is missing', async () => {
    process.env.API_SECRET = 'secret123';
    const store = createStore(dbPath);
    const securedApp = createApp({ store });
    const res = await request(securedApp).get('/api/health');
    expect(res.status).toBe(401);
    delete process.env.API_SECRET;
  });

  it('allows requests with correct API_SECRET', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.API_SECRET = 'secret123';
    const store = createStore(dbPath);
    const securedApp = createApp({ store });
    const res = await request(securedApp)
      .get('/api/health')
      .set('x-api-key', 'secret123');
    expect(res.status).toBe(200);
    delete process.env.API_SECRET;
  });
});
