import React from 'react';
import { UiError } from '../../hooks/useErrorReporter';

interface ErrorBannerProps {
  error: UiError | null;
  onClose?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onClose }) => {
  if (!error) return null;
  return (
    <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start shadow-sm animate-fade-in">
      <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-red-500 mr-3">
        <svg fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{error.message}</div>
        {error.context && <div className="text-xs mt-1 text-red-600/80">{error.context}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className="text-xs text-red-500 hover:text-red-700 ml-3">
          关闭
        </button>
      )}
    </div>
  );
};
