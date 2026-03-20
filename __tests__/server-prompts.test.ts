import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createPromptsRouter } from '../server/routes/prompts.js';
import { createStore } from '../server/store.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Per-test isolated Express app + store
// ---------------------------------------------------------------------------
let dbPath: string;
let app: ReturnType<typeof express>;

beforeEach(() => {
  dbPath = join(tmpdir(), `synergy-api-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const store = createStore(dbPath);
  app = express();
  app.use(express.json());
  app.use('/api/prompts', createPromptsRouter(store));
});

afterEach(() => {
  if (existsSync(dbPath)) unlinkSync(dbPath);
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const makeBody = (overrides = {}) => ({
  title: 'Test Prompt',
  coreIdea: 'AI ethics',
  generatedPrompt: 'You are a researcher...',
  disciplines: ['Philosophy'],
  tags: [],
  isFavorite: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// GET /api/prompts
// ---------------------------------------------------------------------------
describe('GET /api/prompts', () => {
  it('returns empty array when no prompts', async () => {
    const res = await request(app).get('/api/prompts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all prompts sorted newest-first', async () => {
    await request(app).post('/api/prompts').send(makeBody({ title: 'First' }));
    await request(app).post('/api/prompts').send(makeBody({ title: 'Second' }));
    const res = await request(app).get('/api/prompts');
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Second');
    expect(res.body[1].title).toBe('First');
  });

  it('filters by search query', async () => {
    await request(app).post('/api/prompts').send(makeBody({ title: 'Alpha Prompt' }));
    await request(app).post('/api/prompts').send(makeBody({ title: 'Beta Prompt' }));
    const res = await request(app).get('/api/prompts?search=alpha');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Alpha Prompt');
  });
});

// ---------------------------------------------------------------------------
// POST /api/prompts
// ---------------------------------------------------------------------------
describe('POST /api/prompts', () => {
  it('creates a prompt and returns 201 with the record', async () => {
    const res = await request(app).post('/api/prompts').send(makeBody());
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.title).toBe('Test Prompt');
    expect(res.body.createdAt).toBeGreaterThan(0);
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/prompts').send({ coreIdea: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 when title is empty string', async () => {
    const res = await request(app).post('/api/prompts').send(makeBody({ title: '  ' }));
    expect(res.status).toBe(400);
  });

  it('defaults optional fields to empty values', async () => {
    const res = await request(app).post('/api/prompts').send({ title: 'Minimal' });
    expect(res.status).toBe(201);
    expect(res.body.coreIdea).toBe('');
    expect(res.body.disciplines).toEqual([]);
    expect(res.body.isFavorite).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/prompts/:id
// ---------------------------------------------------------------------------
describe('GET /api/prompts/:id', () => {
  it('returns the prompt when found', async () => {
    const create = await request(app).post('/api/prompts').send(makeBody());
    const res = await request(app).get(`/api/prompts/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(create.body.id);
  });

  it('returns 404 when not found', async () => {
    const res = await request(app).get('/api/prompts/no-such-id');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/prompts/:id
// ---------------------------------------------------------------------------
describe('PUT /api/prompts/:id', () => {
  it('updates and returns the record', async () => {
    const create = await request(app).post('/api/prompts').send(makeBody());
    const res = await request(app).put(`/api/prompts/${create.body.id}`).send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('does not change the id', async () => {
    const create = await request(app).post('/api/prompts').send(makeBody());
    const originalId = create.body.id;
    const res = await request(app).put(`/api/prompts/${originalId}`).send({ id: 'hacked', title: 'X' });
    expect(res.body.id).toBe(originalId);
  });

  it('returns 404 when not found', async () => {
    const res = await request(app).put('/api/prompts/missing').send({ title: 'X' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/prompts/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/prompts/:id', () => {
  it('deletes and returns 204', async () => {
    const create = await request(app).post('/api/prompts').send(makeBody());
    const res = await request(app).delete(`/api/prompts/${create.body.id}`);
    expect(res.status).toBe(204);
    const list = await request(app).get('/api/prompts');
    expect(list.body).toHaveLength(0);
  });

  it('returns 404 when not found', async () => {
    const res = await request(app).delete('/api/prompts/missing');
    expect(res.status).toBe(404);
  });
});
