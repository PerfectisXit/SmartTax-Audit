import { useCallback, useState } from 'react';

export interface UiError {
  message: string;
  context?: string;
  ts: number;
}

export const useErrorReporter = () => {
  const [error, setError] = useState<UiError | null>(null);

  const reportError = useCallback((message: string, context?: string) => {
    setError({ message, context, ts: Date.now() });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, reportError, clearError };
};
