import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPrompts, fetchPrompt, createPrompt, updatePrompt, deletePrompt } from '../cli/api.js';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const BASE = 'http://localhost:3001';

const ok = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    statusText: 'OK',
  } as Response);

const fail = (status: number, error: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
    statusText: 'Error',
  } as Response);

beforeEach(() => mockFetch.mockReset());

// ---------------------------------------------------------------------------
// fetchPrompts
// ---------------------------------------------------------------------------
describe('fetchPrompts', () => {
  it('calls GET /api/prompts and returns the array', async () => {
    mockFetch.mockReturnValue(ok([{ id: '1', title: 'A' }]));
    const result = await fetchPrompts(BASE);
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/prompts`);
    expect(result).toEqual([{ id: '1', title: 'A' }]);
  });

  it('appends search param when provided', async () => {
    mockFetch.mockReturnValue(ok([]));
    await fetchPrompts(BASE, 'my query');
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/prompts?search=my+query`);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockReturnValue(fail(500, 'Server error'));
    await expect(fetchPrompts(BASE)).rejects.toThrow('500');
  });
});

// ---------------------------------------------------------------------------
// fetchPrompt
// ---------------------------------------------------------------------------
describe('fetchPrompt', () => {
  it('calls GET /api/prompts/:id', async () => {
    mockFetch.mockReturnValue(ok({ id: 'abc', title: 'Test' }));
    const result = await fetchPrompt(BASE, 'abc');
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/prompts/abc`);
    expect(result.title).toBe('Test');
  });

  it('throws on 404', async () => {
    mockFetch.mockReturnValue(fail(404, 'Not found'));
    await expect(fetchPrompt(BASE, 'bad-id')).rejects.toThrow('404');
  });
});

// ---------------------------------------------------------------------------
// createPrompt
// ---------------------------------------------------------------------------
describe('createPrompt', () => {
  it('POSTs to /api/prompts with JSON body', async () => {
    const record = { id: 'new', title: 'My Prompt' };
    mockFetch.mockReturnValue(ok(record, 201));
    const result = await createPrompt(BASE, { title: 'My Prompt' });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/api/prompts`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(record);
  });

  it('throws on 400', async () => {
    mockFetch.mockReturnValue(fail(400, '`title` is required'));
    await expect(createPrompt(BASE, {})).rejects.toThrow('400');
  });
});

// ---------------------------------------------------------------------------
// updatePrompt
// ---------------------------------------------------------------------------
describe('updatePrompt', () => {
  it('PUTs to /api/prompts/:id', async () => {
    mockFetch.mockReturnValue(ok({ id: 'abc', title: 'Updated' }));
    await updatePrompt(BASE, 'abc', { title: 'Updated' });
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/api/prompts/abc`,
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

// ---------------------------------------------------------------------------
// deletePrompt
// ---------------------------------------------------------------------------
describe('deletePrompt', () => {
  it('sends DELETE to /api/prompts/:id', async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null), statusText: 'No Content' } as Response));
    await deletePrompt(BASE, 'abc');
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/api/prompts/abc`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws on 404', async () => {
    mockFetch.mockReturnValue(fail(404, 'Not found'));
    await expect(deletePrompt(BASE, 'bad')).rejects.toThrow('404');
  });
});
