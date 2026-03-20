import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseJsonFromText, OllamaProvider, listModels, OLLAMA_MODEL_STORAGE_KEY } from '../services/ollamaService';

/**
 * Unit tests for services/ollamaService.ts
 *
 * All HTTP calls are intercepted by stubbing the global `fetch` function so
 * that no real network requests are made.  Each suite restores stubs in
 * `afterEach` to prevent cross-test pollution.
 *
 * Suites:
 *  1. parseJsonFromText  — pure parsing logic, no I/O
 *  2. OllamaProvider.status     — connectivity check via GET /api/tags
 *  3. OllamaProvider.generateConcepts — concept generation via POST /api/generate
 *  4. listModels                — model list fetched from GET /api/tags
 *  5. model resolution via localStorage — getModel() priority chain
 */

// ---------------------------------------------------------------------------
// parseJsonFromText (Ollama variant — includes regex JSON-block extraction)
//
// Tests cover all three code paths in the function:
//   a) markdown/plain fenced blocks   → stripped by the fence regex
//   b) JSON embedded in prose         → extracted by the block regex
//   c) null returns for invalid input → both missing and malformed JSON
// ---------------------------------------------------------------------------
describe('parseJsonFromText (OllamaService)', () => {
  it('parses a clean JSON object', () => {
    expect(parseJsonFromText<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses a clean JSON array', () => {
    expect(parseJsonFromText<string[]>('["x", "y"]')).toEqual(['x', 'y']);
  });

  it('strips markdown json fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(parseJsonFromText<{ key: string }>(input)).toEqual({ key: 'value' });
  });

  it('strips plain code fences', () => {
    const input = '```\n[1,2,3]\n```';
    expect(parseJsonFromText<number[]>(input)).toEqual([1, 2, 3]);
  });

  it('extracts a JSON object embedded in surrounding prose', () => {
    const input = 'Here is your result:\n{"discipline": ["concept A", "concept B"]}\nEnd of response.';
    expect(parseJsonFromText<{ discipline: string[] }>(input)).toEqual({
      discipline: ['concept A', 'concept B'],
    });
  });

  it('extracts a JSON array embedded in surrounding prose', () => {
    const input = 'The variations are: ["Variation 1", "Variation 2"] — hope that helps!';
    expect(parseJsonFromText<string[]>(input)).toEqual(['Variation 1', 'Variation 2']);
  });

  it('returns null for text with no extractable JSON', () => {
    expect(parseJsonFromText('This is just plain text with no JSON.')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseJsonFromText('')).toBeNull();
  });

  it('returns null for structurally invalid JSON block', () => {
    // Braces present but content is not valid JSON
    expect(parseJsonFromText('{ not: valid json }')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// OllamaProvider.status — mocking global fetch
//
// Verifies the three reachability outcomes:
//   ok:true  → configured:true, no error
//   ok:false → configured:false, error message set
//   throw    → configured:false, error contains 'ollama serve' hint
// ---------------------------------------------------------------------------
describe('OllamaProvider.status', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('AbortSignal', { timeout: vi.fn().mockReturnValue(new AbortController().signal) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns configured:true when Ollama /api/tags responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    const result = await OllamaProvider.status();
    expect(result.configured).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns configured:false with error message when Ollama responds with non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const result = await OllamaProvider.status();
    expect(result.configured).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns configured:false with instructional error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));
    const result = await OllamaProvider.status();
    expect(result.configured).toBe(false);
    expect(result.error).toMatch(/ollama serve/i);
  });
});

// ---------------------------------------------------------------------------
// OllamaProvider.generateConcepts — mocking fetch
//
// Verifies:
//   • Happy path: pure JSON response → parsed AiConcepts object
//   • Resilience: JSON embedded in prose → parseJsonFromText extracts it
//   • Error: unparseable response → throws with /parse/i message
//   • Error: non-ok HTTP status   → forwards the model error message
// ---------------------------------------------------------------------------
describe('OllamaProvider.generateConcepts', () => {
  const mockConcepts = {
    History: ['Impact of event X', 'Primary sources'],
    Philosophy: ['Ethical implications', 'Epistemology'],
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed AiConcepts when Ollama responds with valid JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: JSON.stringify(mockConcepts) }),
    } as unknown as Response);

    const result = await OllamaProvider.generateConcepts('Test idea', ['History', 'Philosophy']);
    expect(result).toEqual(mockConcepts);
  });

  it('returns parsed AiConcepts when response has surrounding prose', async () => {
    const prose = `Sure! Here you go:\n${JSON.stringify(mockConcepts)}\nLet me know if you need more.`;
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: prose }),
    } as unknown as Response);

    const result = await OllamaProvider.generateConcepts('Test idea', ['History', 'Philosophy']);
    expect(result).toEqual(mockConcepts);
  });

  it('throws when Ollama returns invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'This is not JSON at all.' }),
    } as unknown as Response);

    await expect(
      OllamaProvider.generateConcepts('idea', ['Physics'])
    ).rejects.toThrow(/parse/i);
  });

  it('throws when Ollama returns an error status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'model not found' }),
    } as unknown as Response);

    await expect(
      OllamaProvider.generateConcepts('idea', ['Physics'])
    ).rejects.toThrow(/model not found/i);
  });
});

// ---------------------------------------------------------------------------
// listModels — fetches available model names from GET /api/tags
//
// Tests the full surface of the safe-by-default contract:
//   • success   → array of name strings
//   • non-ok    → empty array (no throw)
//   • fetch throw (Ollama not running) → empty array (no throw)
//   • missing `models` key in response → empty array (no throw)
//   • empty `models` array             → empty array (no throw)
// ---------------------------------------------------------------------------
describe('listModels', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('AbortSignal', { timeout: vi.fn().mockReturnValue(new AbortController().signal) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an array of model names when /api/tags responds ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'gemma3:4b-cloud' },
          { name: 'qwen3-coder:480b-cloud' },
          { name: 'deepseek-v3.2:cloud' },
        ],
      }),
    } as unknown as Response);

    const result = await listModels();
    expect(result).toEqual(['gemma3:4b-cloud', 'qwen3-coder:480b-cloud', 'deepseek-v3.2:cloud']);
  });

  it('returns empty array when /api/tags responds with non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    expect(await listModels()).toEqual([]);
  });

  it('returns empty array when fetch throws (Ollama not running)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));
    expect(await listModels()).toEqual([]);
  });

  it('returns empty array when models key is absent from response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as unknown as Response);
    expect(await listModels()).toEqual([]);
  });

  it('returns empty array when models list is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    } as unknown as Response);
    expect(await listModels()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// OLLAMA_MODEL_STORAGE_KEY / getModel — model resolved from localStorage
//
// getModel() resolution order (highest to lowest priority):
//   1. localStorage[OLLAMA_MODEL_STORAGE_KEY]  (set via Settings panel)
//   2. import.meta.env.VITE_OLLAMA_MODEL        (build-time env var)
//   3. DEFAULT_MODEL ('llama3')                 (hard-coded fallback)
//
// These tests drive behaviour through a real API call so we can inspect
// the `model` field serialised into the POST body of /api/generate.
// ---------------------------------------------------------------------------
describe('model resolution via localStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sends the model stored in localStorage as the model field in /api/generate requests', async () => {
    localStorage.setItem(OLLAMA_MODEL_STORAGE_KEY, 'gemma3:4b-cloud');

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: JSON.stringify({ Physics: ['concept A'] }) }),
    } as unknown as Response);

    await OllamaProvider.generateConcepts('idea', ['Physics']);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('gemma3:4b-cloud');
  });

  it('falls back to default model when localStorage is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: JSON.stringify({ Physics: ['concept A'] }) }),
    } as unknown as Response);

    await OllamaProvider.generateConcepts('idea', ['Physics']);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    // Default is 'llama3' when no localStorage entry and no env var
    expect(body.model).toBe('llama3');
  });
});

