import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

describe('useAsyncOperation', () => {
  it('initializes with data=null, error=null, isLoading=false', () => {
    const { result } = renderHook(() => useAsyncOperation(async () => 'value'));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading=true while the operation is pending', async () => {
    let resolve!: (v: string) => void;
    const promise = new Promise<string>(res => { resolve = res; });

    const { result } = renderHook(() => useAsyncOperation(() => promise));

    act(() => { result.current.execute(); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolve('done'); });
    expect(result.current.isLoading).toBe(false);
  });

  it('stores returned data on successful execution', async () => {
    const { result } = renderHook(() => useAsyncOperation(async () => 42));
    await act(async () => { await result.current.execute(); });

    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('passes arguments through to the async function', async () => {
    const { result } = renderHook(() =>
      useAsyncOperation(async (a: number, b: number) => a + b)
    );
    await act(async () => { await result.current.execute(3, 7); });
    expect(result.current.data).toBe(10);
  });

  it('stores the error message on failure', async () => {
    const { result } = renderHook(() =>
      useAsyncOperation(async () => { throw new Error('something went wrong'); })
    );

    await act(async () => {
      try { await result.current.execute(); } catch { /* expected */ }
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('something went wrong');
    expect(result.current.isLoading).toBe(false);
  });

  it('converts non-Error throws to string error messages', async () => {
    const { result } = renderHook(() =>
      useAsyncOperation(async () => { throw 'raw string error'; })
    );

    await act(async () => {
      try { await result.current.execute(); } catch { /* expected */ }
    });

    expect(result.current.error).toBe('raw string error');
  });

  it('re-throws so callers can catch the error', async () => {
    const { result } = renderHook(() =>
      useAsyncOperation(async () => { throw new Error('thrown'); })
    );

    await expect(
      act(async () => { await result.current.execute(); })
    ).rejects.toThrow('thrown');
  });

  it('reset clears data, error, and isLoading', async () => {
    const { result } = renderHook(() => useAsyncOperation(async () => 'abc'));
    await act(async () => { await result.current.execute(); });
    expect(result.current.data).toBe('abc');

    act(() => { result.current.reset(); });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('exposes an abort() method', () => {
    const { result } = renderHook(() => useAsyncOperation(async () => 'value'));
    expect(typeof result.current.abort).toBe('function');
  });

  it('clears previous data/error at the start of a new execution', async () => {
    let shouldFail = true;
    const { result } = renderHook(() =>
      useAsyncOperation(async () => {
        if (shouldFail) throw new Error('first call error');
        return 'success';
      })
    );

    // First call — fails
    await act(async () => {
      try { await result.current.execute(); } catch { /* expected */ }
    });
    expect(result.current.error).toBe('first call error');

    // Second call — succeeds; should clear the previous error
    shouldFail = false;
    await act(async () => { await result.current.execute(); });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// abort() behaviour
// ---------------------------------------------------------------------------
describe('useAsyncOperation — abort', () => {
  it('abort() while loading sets isLoading to false', async () => {
    let resolve!: (v: string) => void;
    const promise = new Promise<string>(res => { resolve = res; });
    const { result } = renderHook(() => useAsyncOperation(() => promise));

    act(() => { result.current.execute(); });
    expect(result.current.isLoading).toBe(true);

    act(() => { result.current.abort(); });
    expect(result.current.isLoading).toBe(false);

    // Silence the unhandled rejection from execute() when the promise eventually resolves
    await act(async () => { resolve('too late'); });
  });

  it('abort() prevents data from being set when the promise later resolves', async () => {
    let resolve!: (v: string) => void;
    const promise = new Promise<string>(res => { resolve = res; });
    const { result } = renderHook(() => useAsyncOperation(() => promise));

    act(() => { result.current.execute(); });
    act(() => { result.current.abort(); });

    await act(async () => { resolve('should be ignored'); });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('abort() while not loading is a no-op', () => {
    const { result } = renderHook(() => useAsyncOperation(async () => 'value'));
    // Should not throw
    expect(() => act(() => { result.current.abort(); })).not.toThrow();
    expect(result.current.isLoading).toBe(false);
  });

  it('a new execute() after abort() works correctly', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    const { result } = renderHook(() => useAsyncOperation(fn));

    // First call
    await act(async () => { await result.current.execute(); });
    expect(result.current.data).toBe('first');

    // Abort (no-op, already done), then re-execute
    act(() => { result.current.abort(); });
    await act(async () => { await result.current.execute(); });
    expect(result.current.data).toBe('second');
  });
});
