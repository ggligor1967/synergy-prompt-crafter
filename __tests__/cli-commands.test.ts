import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCommand, getCommand, deleteCommand, exportCommand, createCommand } from '../cli/commands.js';

// ---------------------------------------------------------------------------
// Mock cli/api.js
// ---------------------------------------------------------------------------
vi.mock('../cli/api.js', () => ({
  fetchPrompts: vi.fn(),
  fetchPrompt: vi.fn(),
  deletePrompt: vi.fn(),
  createPrompt: vi.fn(),
  updatePrompt: vi.fn(),
}));

import { fetchPrompts, fetchPrompt, deletePrompt, createPrompt } from '../cli/api.js';

// Capture console output
const logs: string[] = [];
const errors: string[] = [];
beforeEach(() => {
  logs.length = 0;
  errors.length = 0;
  vi.spyOn(console, 'log').mockImplementation((...args) => { logs.push(args.join(' ')); });
  vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.join(' ')); });
  process.exitCode = 0;
  vi.clearAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); });

const BASE = 'http://localhost:3001';
const OPTS = { url: BASE };

const makeRecord = (overrides = {}) => ({
  id: 'abc-123',
  title: 'My Prompt',
  coreIdea: 'AI ethics',
  generatedPrompt: 'You are...',
  isFavorite: false,
  createdAt: new Date('2026-01-15').getTime(),
  updatedAt: new Date('2026-01-15').getTime(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// listCommand
// ---------------------------------------------------------------------------
describe('listCommand', () => {
  it('prints "No prompts found." when list is empty', async () => {
    vi.mocked(fetchPrompts).mockResolvedValue([]);
    await listCommand(OPTS);
    expect(logs.join('')).toMatch(/no prompts found/i);
  });

  it('prints a table row for each prompt', async () => {
    vi.mocked(fetchPrompts).mockResolvedValue([makeRecord()]);
    await listCommand(OPTS);
    expect(logs.join('\n')).toContain('My Prompt');
    expect(logs.join('\n')).toContain('abc-123');
  });

  it('passes search to fetchPrompts', async () => {
    vi.mocked(fetchPrompts).mockResolvedValue([]);
    await listCommand({ ...OPTS, search: 'ethics' });
    expect(fetchPrompts).toHaveBeenCalledWith(BASE, 'ethics');
  });

  it('outputs raw JSON when --json flag is set', async () => {
    const records = [makeRecord()];
    vi.mocked(fetchPrompts).mockResolvedValue(records);
    await listCommand({ ...OPTS, json: true });
    const output = JSON.parse(logs[0]);
    expect(output).toEqual(records);
  });

  it('sets exitCode=1 on API error', async () => {
    vi.mocked(fetchPrompts).mockRejectedValue(new Error('network error'));
    await listCommand(OPTS);
    expect(errors[0]).toContain('network error');
    expect(process.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getCommand
// ---------------------------------------------------------------------------
describe('getCommand', () => {
  it('prints prompt details in human-readable format', async () => {
    vi.mocked(fetchPrompt).mockResolvedValue(makeRecord());
    await getCommand('abc-123', OPTS);
    const out = logs.join('\n');
    expect(out).toContain('abc-123');
    expect(out).toContain('My Prompt');
    expect(out).toContain('AI ethics');
    expect(out).toContain('You are...');
  });

  it('outputs raw JSON when --json flag is set', async () => {
    const record = makeRecord();
    vi.mocked(fetchPrompt).mockResolvedValue(record);
    await getCommand('abc-123', { ...OPTS, json: true });
    expect(JSON.parse(logs[0])).toEqual(record);
  });

  it('sets exitCode=1 on 404', async () => {
    vi.mocked(fetchPrompt).mockRejectedValue(new Error('404: Not found'));
    await getCommand('bad-id', OPTS);
    expect(process.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// deleteCommand
// ---------------------------------------------------------------------------
describe('deleteCommand', () => {
  it('prints confirmation on success', async () => {
    vi.mocked(deletePrompt).mockResolvedValue(undefined);
    await deleteCommand('abc-123', OPTS);
    expect(logs.join('')).toContain('abc-123');
  });

  it('sets exitCode=1 on error', async () => {
    vi.mocked(deletePrompt).mockRejectedValue(new Error('404'));
    await deleteCommand('bad', OPTS);
    expect(process.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// exportCommand
// ---------------------------------------------------------------------------
describe('exportCommand', () => {
  it('exports single prompt as JSON by default', async () => {
    const record = makeRecord();
    vi.mocked(fetchPrompt).mockResolvedValue(record);
    await exportCommand('abc-123', { ...OPTS, format: 'json' });
    expect(JSON.parse(logs[0])).toEqual(record);
  });

  it('exports all prompts as JSON when no id given', async () => {
    const records = [makeRecord(), makeRecord({ id: 'xyz', title: 'Other' })];
    vi.mocked(fetchPrompts).mockResolvedValue(records);
    await exportCommand(undefined, { ...OPTS, format: 'json' });
    expect(JSON.parse(logs[0])).toEqual(records);
  });

  it('exports as markdown', async () => {
    vi.mocked(fetchPrompt).mockResolvedValue(makeRecord());
    await exportCommand('abc-123', { ...OPTS, format: 'markdown' });
    const out = logs.join('\n');
    expect(out).toContain('# My Prompt');
    expect(out).toContain('You are...');
  });

  it('exports as plain text', async () => {
    vi.mocked(fetchPrompt).mockResolvedValue(makeRecord());
    await exportCommand('abc-123', { ...OPTS, format: 'text' });
    const out = logs.join('\n');
    expect(out).toContain('My Prompt');
    expect(out).toContain('You are...');
  });

  it('sets exitCode=1 on error', async () => {
    vi.mocked(fetchPrompt).mockRejectedValue(new Error('fail'));
    await exportCommand('bad', { ...OPTS, format: 'json' });
    expect(process.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// createCommand
// ---------------------------------------------------------------------------
describe('createCommand', () => {
  it('creates a prompt and prints the id', async () => {
    const record = makeRecord();
    vi.mocked(createPrompt).mockResolvedValue(record);
    await createCommand({ ...OPTS, title: 'My Prompt' });
    expect(logs.join('')).toContain('abc-123');
  });

  it('outputs raw JSON when --json flag is set', async () => {
    const record = makeRecord();
    vi.mocked(createPrompt).mockResolvedValue(record);
    await createCommand({ ...OPTS, title: 'My Prompt', json: true });
    expect(JSON.parse(logs[0])).toEqual(record);
  });

  it('sets exitCode=1 when title is missing', async () => {
    await createCommand({ ...OPTS });
    expect(errors[0]).toContain('title');
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode=1 on API error', async () => {
    vi.mocked(createPrompt).mockRejectedValue(new Error('bad request'));
    await createCommand({ ...OPTS, title: 'X' });
    expect(process.exitCode).toBe(1);
  });
});
