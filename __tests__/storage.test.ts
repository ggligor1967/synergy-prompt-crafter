import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  savePrompt,
  updatePrompt,
  deletePrompt,
  getAllPrompts,
  toggleFavorite,
  _resetDB,
} from '../services/storage';
import { PromptData } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makePromptData = (): PromptData => ({
  role: 'researcher',
  context: 'academic paper',
  task: 'summarize findings',
  keywords: ['AI', 'ethics'],
  constraints: 'under 200 words',
  tone: 'formal',
  format: 'paragraph',
  audience: 'experts',
});

const makeRecord = (overrides?: object) => ({
  title: 'Test Prompt',
  coreIdea: 'AI ethics research',
  promptData: makePromptData(),
  generatedPrompt: 'You are a researcher...',
  disciplines: ['Philosophy', 'Computer Science'],
  tags: [],
  isFavorite: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Reset to a fresh in-memory database before every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).indexedDB = new IDBFactory();
  _resetDB(null);
});

// ---------------------------------------------------------------------------
// savePrompt
// ---------------------------------------------------------------------------
describe('storage — savePrompt', () => {
  it('assigns a uuid id and timestamps', async () => {
    const saved = await savePrompt(makeRecord());
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.createdAt).toBeGreaterThan(0);
    expect(saved.updatedAt).toBe(saved.createdAt);
  });

  it('persists so getAllPrompts returns it', async () => {
    const saved = await savePrompt(makeRecord({ title: 'My Prompt' }));
    const all = await getAllPrompts();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(saved.id);
    expect(all[0].title).toBe('My Prompt');
  });

  it('preserves all fields', async () => {
    const saved = await savePrompt(makeRecord());
    expect(saved.coreIdea).toBe('AI ethics research');
    expect(saved.disciplines).toEqual(['Philosophy', 'Computer Science']);
    expect(saved.isFavorite).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAllPrompts
// ---------------------------------------------------------------------------
describe('storage — getAllPrompts', () => {
  it('returns empty array when store is empty', async () => {
    const all = await getAllPrompts();
    expect(all).toEqual([]);
  });

  it('returns all saved records', async () => {
    await savePrompt(makeRecord({ title: 'A' }));
    await savePrompt(makeRecord({ title: 'B' }));
    const all = await getAllPrompts();
    expect(all).toHaveLength(2);
  });

  it('sorts newest first', async () => {
    await savePrompt(makeRecord({ title: 'First' }));
    await new Promise(r => setTimeout(r, 2));
    await savePrompt(makeRecord({ title: 'Second' }));
    const all = await getAllPrompts();
    expect(all[0].title).toBe('Second');
    expect(all[1].title).toBe('First');
  });
});

// ---------------------------------------------------------------------------
// updatePrompt
// ---------------------------------------------------------------------------
describe('storage — updatePrompt', () => {
  it('updates fields and bumps updatedAt', async () => {
    const saved = await savePrompt(makeRecord());
    await new Promise(r => setTimeout(r, 2));

    const updated = await updatePrompt(saved.id, { title: 'Renamed' });
    expect(updated.title).toBe('Renamed');
    expect(updated.updatedAt).toBeGreaterThan(saved.updatedAt);
    expect(updated.createdAt).toBe(saved.createdAt);
  });

  it('does not alter other fields', async () => {
    const saved = await savePrompt(makeRecord());
    const updated = await updatePrompt(saved.id, { title: 'X' });
    expect(updated.coreIdea).toBe(saved.coreIdea);
    expect(updated.generatedPrompt).toBe(saved.generatedPrompt);
  });

  it('throws when record does not exist', async () => {
    await expect(updatePrompt('nonexistent-id', { title: 'X' })).rejects.toThrow('nonexistent-id');
  });
});

// ---------------------------------------------------------------------------
// deletePrompt
// ---------------------------------------------------------------------------
describe('storage — deletePrompt', () => {
  it('removes the record', async () => {
    const saved = await savePrompt(makeRecord());
    await deletePrompt(saved.id);
    const all = await getAllPrompts();
    expect(all).toHaveLength(0);
  });

  it('only removes the targeted record', async () => {
    await savePrompt(makeRecord({ title: 'Keep' }));
    const toDelete = await savePrompt(makeRecord({ title: 'Remove' }));
    await deletePrompt(toDelete.id);
    const all = await getAllPrompts();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Keep');
  });

  it('does not throw when id does not exist', async () => {
    await expect(deletePrompt('no-such-id')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toggleFavorite
// ---------------------------------------------------------------------------
describe('storage — toggleFavorite', () => {
  it('sets isFavorite to true when it was false', async () => {
    const saved = await savePrompt(makeRecord({ isFavorite: false }));
    const updated = await toggleFavorite(saved.id);
    expect(updated.isFavorite).toBe(true);
  });

  it('sets isFavorite to false when it was true', async () => {
    const saved = await savePrompt(makeRecord({ isFavorite: true }));
    const updated = await toggleFavorite(saved.id);
    expect(updated.isFavorite).toBe(false);
  });

  it('double toggle returns to original value', async () => {
    const saved = await savePrompt(makeRecord({ isFavorite: false }));
    await toggleFavorite(saved.id);
    const final = await toggleFavorite(saved.id);
    expect(final.isFavorite).toBe(false);
  });

  it('throws when record does not exist', async () => {
    await expect(toggleFavorite('no-such-id')).rejects.toThrow('no-such-id');
  });
});
