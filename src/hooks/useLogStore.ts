import { useCallback, useState } from 'react';

export interface LogEntry {
  id: string;
  level: 'info' | 'error';
  message: string;
  context?: string;
  ts: number;
}

export const useLogStore = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const appendLog = useCallback((entry: Omit<LogEntry, 'id' | 'ts'>) => {
    setLogs(prev => [
      { ...entry, id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, ts: Date.now() },
      ...prev
    ].slice(0, 50));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, appendLog, clearLogs };
};
