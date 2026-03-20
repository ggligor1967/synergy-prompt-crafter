import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../server/store.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Each test uses an isolated temp file
// ---------------------------------------------------------------------------
let dbPath: string;
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  dbPath = join(tmpdir(), `synergy-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  store = createStore(dbPath);
});

afterEach(() => {
  if (existsSync(dbPath)) unlinkSync(dbPath);
});

// ---------------------------------------------------------------------------
// getAll
// ---------------------------------------------------------------------------
describe('store.getAll', () => {
  it('returns empty array when file does not exist', () => {
    expect(store.getAll()).toEqual([]);
  });

  it('returns records sorted newest-first', () => {
    store.create({ title: 'Old', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    store.create({ title: 'New', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    const [first] = store.getAll();
    expect(first.title).toBe('New');
  });

  it('filters by title (case-insensitive)', () => {
    store.create({ title: 'Alpha', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    store.create({ title: 'Beta', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    const results = store.getAll({ search: 'alpha' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Alpha');
  });

  it('filters by coreIdea', () => {
    store.create({ title: 'T', coreIdea: 'quantum physics', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    store.create({ title: 'T2', coreIdea: 'machine learning', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    expect(store.getAll({ search: 'quantum' })).toHaveLength(1);
  });

  it('filters by generatedPrompt', () => {
    store.create({ title: 'T', coreIdea: '', promptData: {}, generatedPrompt: 'You are a poet', disciplines: [], tags: [], isFavorite: false });
    store.create({ title: 'T2', coreIdea: '', promptData: {}, generatedPrompt: 'You are a scientist', disciplines: [], tags: [], isFavorite: false });
    expect(store.getAll({ search: 'poet' })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe('store.create', () => {
  it('assigns a UUID id and timestamps', () => {
    const r = store.create({ title: 'Test', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.createdAt).toBeGreaterThan(0);
    expect(r.updatedAt).toBe(r.createdAt);
  });

  it('persists to disk so subsequent reads include it', () => {
    store.create({ title: 'Persisted', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    // Create a fresh store instance reading the same file
    const store2 = createStore(dbPath);
    expect(store2.getAll()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------
describe('store.getById', () => {
  it('returns the record when found', () => {
    const created = store.create({ title: 'X', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    expect(store.getById(created.id)).toMatchObject({ id: created.id, title: 'X' });
  });

  it('returns null when not found', () => {
    expect(store.getById('no-such-id')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------
describe('store.update', () => {
  it('updates fields and bumps updatedAt', async () => {
    const created = store.create({ title: 'Old', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    await new Promise(r => setTimeout(r, 2));
    const updated = store.update(created.id, { title: 'New' });
    expect(updated!.title).toBe('New');
    expect(updated!.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(updated!.createdAt).toBe(created.createdAt);
  });

  it('does not allow overwriting the id', () => {
    const created = store.create({ title: 'T', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    const updated = store.update(created.id, { id: 'hacked', title: 'T2' });
    expect(updated!.id).toBe(created.id);
  });

  it('returns null when id not found', () => {
    expect(store.update('missing', { title: 'x' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------
describe('store.delete', () => {
  it('removes the record and returns true', () => {
    const created = store.create({ title: 'T', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    expect(store.delete(created.id)).toBe(true);
    expect(store.getAll()).toHaveLength(0);
  });

  it('returns false when id not found', () => {
    expect(store.delete('no-such-id')).toBe(false);
  });

  it('only removes the targeted record', () => {
    store.create({ title: 'Keep', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    const toDelete = store.create({ title: 'Remove', coreIdea: '', promptData: {}, generatedPrompt: '', disciplines: [], tags: [], isFavorite: false });
    store.delete(toDelete.id);
    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Keep');
  });
});
