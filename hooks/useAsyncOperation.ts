import { useState, useCallback } from 'react';

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

  const execute = useCallback(async (...args: A) => {
    setState({ data: null, error: null, isLoading: true });
    try {
      const result = await asyncFn(...args);
      setState({ data: result, error: null, isLoading: false });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState({ data: null, error: errorMessage, isLoading: false });
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncFn]);

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, execute, reset };
}
