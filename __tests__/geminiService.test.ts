import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseJsonFromText } from '../services/jsonParser';
import { GeminiProvider } from '../services/geminiService';

describe('parseJsonFromText', () => {
  it('parses a plain JSON object', () => {
    const result = parseJsonFromText<{ a: number }>('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  it('parses a JSON array', () => {
    const result = parseJsonFromText<string[]>('["x", "y"]');
    expect(result).toEqual(['x', 'y']);
  });

  it('strips markdown fences before parsing', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(parseJsonFromText<{ key: string }>(input)).toEqual({ key: 'value' });
  });

  it('strips plain code fences before parsing', () => {
    const input = '```\n[1,2,3]\n```';
    expect(parseJsonFromText<number[]>(input)).toEqual([1, 2, 3]);
  });

  it('returns null for invalid JSON', () => {
    expect(parseJsonFromText('not json at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseJsonFromText('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GeminiProvider.status — mocking global fetch
// ---------------------------------------------------------------------------
describe('GeminiProvider.status', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('AbortSignal', { timeout: vi.fn().mockReturnValue(new AbortController().signal) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns configured:true when proxy health endpoint responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    const result = await GeminiProvider.status();
    expect(result.configured).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns configured:false with error message when proxy responds non-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const result = await GeminiProvider.status();
    expect(result.configured).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns configured:false with instructional message when proxy is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await GeminiProvider.status();
    expect(result.configured).toBe(false);
    expect(result.error).toMatch(/proxy|server|running/i);
  });
});

// ---------------------------------------------------------------------------
// GeminiProvider.generateConcepts — mocking fetch
// ---------------------------------------------------------------------------
describe('GeminiProvider.generateConcepts', () => {
  const mockConcepts = {
    Physics: ['Wave-particle duality', 'Quantum entanglement'],
    Mathematics: ['Topology', 'Set theory'],
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed AiConcepts from proxy response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify(mockConcepts) }),
    } as unknown as Response);

    const result = await GeminiProvider.generateConcepts('Quantum reality', ['Physics', 'Mathematics']);
    expect(result).toEqual(mockConcepts);
  });

  it('returns empty object when response contains no parseable JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'I cannot help with that.' }),
    } as unknown as Response);

    const result = await GeminiProvider.generateConcepts('idea', ['Philosophy']);
    expect(result).toEqual({});
  });

  it('throws when proxy returns an error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'API quota exceeded' }),
    } as unknown as Response);

    await expect(
      GeminiProvider.generateConcepts('idea', ['History'])
    ).rejects.toThrow(/API quota exceeded/i);
  });
});
