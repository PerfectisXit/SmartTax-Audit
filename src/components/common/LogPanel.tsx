import React from 'react';
import { LogEntry } from '../../hooks/useLogStore';

interface LogPanelProps {
  title?: string;
  logs: LogEntry[];
  onClear?: () => void;
}

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

export const LogPanel: React.FC<LogPanelProps> = ({ title = '识别日志', logs, onClear }) => {
  if (logs.length === 0) return null;
  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-700">{title}</div>
        {onClear && (
          <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700">
            清空
          </button>
        )}
      </div>
      <div className="space-y-1 max-h-40 overflow-auto text-xs">
        {logs.map(log => (
          <div key={log.id} className={`flex items-start gap-2 ${log.level === 'error' ? 'text-rose-600' : 'text-gray-600'}`}>
            <span className="text-[10px] text-gray-400 mt-0.5">{formatTime(log.ts)}</span>
            <span className="flex-1">{log.message}</span>
            {log.context && <span className="text-[10px] text-gray-400">{log.context}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
