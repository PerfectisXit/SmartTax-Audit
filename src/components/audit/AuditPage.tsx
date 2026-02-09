import React from 'react';
import { AuditFilter } from './AuditFilters';
import { AuditItem, DiningAppState, AuditStats } from './types';
import { AuditList } from './AuditList';
import { AuditResultCard } from './AuditResultCard';
import { ErrorBanner } from '../common/ErrorBanner';
import { LogPanel } from '../common/LogPanel';
import { UiError } from '../../hooks/useErrorReporter';
import { LogEntry } from '../../hooks/useLogStore';

interface AuditPageProps {
  auditItems: AuditItem[];
  pagedAuditItems: AuditItem[];
  auditStats: AuditStats;
  auditFilter: AuditFilter;
  auditIssuesFirst: boolean;
  auditPage: number;
  auditTotalPages: number;
  auditPageSize: number;
  diningApp: DiningAppState;
  isLoading: boolean;
  error: UiError | null;
  logs: LogEntry[];
  notice?: string;
  noticeOnly?: boolean;
  onGoTravel?: () => void;
  onFilterChange: (next: AuditFilter) => void;
  onIssuesFirstChange: (next: boolean) => void;
  onBatchDownload: () => void;
  onClearList: () => void;
  onFileSelect: (files: File[]) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onClearError: () => void;
  onClearLogs: () => void;
}

export const AuditPage: React.FC<AuditPageProps> = ({
  auditItems,
  pagedAuditItems,
  auditStats,
  auditFilter,
  auditIssuesFirst,
  auditPage,
  auditTotalPages,
  auditPageSize,
  diningApp,
  isLoading,
  error,
  logs,
  notice,
  noticeOnly,
  onGoTravel,
  onFilterChange,
  onIssuesFirstChange,
  onBatchDownload,
  onClearList,
  onFileSelect,
  onPrevPage,
  onNextPage,
  onClearError,
  onClearLogs
}) => {
  if (noticeOnly && notice) {
    return (
      <div className="max-w-3xl mx-auto animate-float-in">
        <div className="apple-card p-6 text-center text-amber-700 space-y-4">
          <div>{notice}</div>
          {onGoTravel && (
            <button
              onClick={onGoTravel}
              className="px-4 py-2 bg-blue-600 text-white rounded-full apple-press"
            >
              跳转到差旅报销
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`transition-all duration-500 animate-float-in ${auditItems.length > 0 ? 'grid lg:grid-cols-12 gap-8 items-start' : 'max-w-3xl mx-auto'}`}>
      {/* Left Column: Upload & Preview */}
      <div className={`${auditItems.length > 0 ? 'lg:col-span-5 lg:sticky lg:top-8 z-10' : 'w-full'}`}>
        <div className="apple-card apple-hover apple-press p-6 overflow-hidden relative">
          <AuditList
            items={pagedAuditItems}
            hasItems={auditItems.length > 0}
            isLoading={isLoading}
            stats={auditStats}
            diningApp={diningApp}
            filter={auditFilter}
            onFilterChange={onFilterChange}
            issuesFirst={auditIssuesFirst}
            onIssuesFirstChange={onIssuesFirstChange}
            onBatchDownload={onBatchDownload}
            onClear={onClearList}
            onFileSelect={onFileSelect}
            auditPage={auditPage}
            auditTotalPages={auditTotalPages}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
            showPagination={auditItems.length > auditPageSize}
          />

          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-6 text-center">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">正在智能识别</h3>
              <p className="text-gray-500 text-sm">AI 正在分析票据细节，请稍候...</p>
            </div>
          )}
        </div>

        {notice && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl text-sm">
            {notice}
          </div>
        )}
        <ErrorBanner error={error} onClose={onClearError} />
        <LogPanel logs={logs} onClear={onClearLogs} />
      </div>

      {/* Right Column: Results */}
      {auditItems.length > 0 && (
        <div className="lg:col-span-7 space-y-6 animate-slide-up">
          {pagedAuditItems.map((item) => (
            <AuditResultCard key={item.id} item={item} diningApp={diningApp} />
          ))}
        </div>
      )}
    </div>
  );
};
