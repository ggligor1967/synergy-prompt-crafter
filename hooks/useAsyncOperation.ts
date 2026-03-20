import { useState, useCallback, useRef, useEffect } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export function useAsyncOperation<T, A extends unknown[]>(
  asyncFn: (...args: A) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Track mount state; abort any in-flight request on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(async (...args: A) => {
    // Cancel any previous in-flight operation before starting a new one.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({ data: null, error: null, isLoading: true });
    try {
      const result = await asyncFn(...args);
      if (!controller.signal.aborted && mountedRef.current) {
        setState({ data: result, error: null, isLoading: false });
      }
      return result;
    } catch (err) {
      if (!controller.signal.aborted && mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setState({ data: null, error: errorMessage, isLoading: false });
      }
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncFn]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    if (mountedRef.current) {
      setState(prev => prev.isLoading ? { ...prev, isLoading: false } : prev);
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, execute, reset, abort };
}
