import React from 'react';
import { FileUpload } from '../FileUpload';
import { FileThumbnail } from '../FileThumbnail';
import { AuditFilters, AuditFilter } from './AuditFilters';
import { AuditItem, AuditStats, DiningAppState } from './types';
import { AuditSummaryBar } from './AuditSummaryBar';

interface AuditListProps {
  items: AuditItem[];
  hasItems: boolean;
  isLoading: boolean;
  stats: AuditStats;
  diningApp: DiningAppState;
  filter: AuditFilter;
  onFilterChange: (next: AuditFilter) => void;
  issuesFirst: boolean;
  onIssuesFirstChange: (next: boolean) => void;
  onBatchDownload: () => void;
  onClear: () => void;
  onFileSelect: (files: File[]) => void;
  auditPage: number;
  auditTotalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  showPagination: boolean;
}

export const AuditList: React.FC<AuditListProps> = ({
  items,
  hasItems,
  isLoading,
  stats,
  diningApp,
  filter,
  onFilterChange,
  issuesFirst,
  onIssuesFirstChange,
  onBatchDownload,
  onClear,
  onFileSelect,
  auditPage,
  auditTotalPages,
  onPrevPage,
  onNextPage,
  showPagination
}) => {
  if (!hasItems) {
    return (
      <div className="animate-fade-in">
        <FileUpload onFileSelect={onFileSelect} isLoading={isLoading} multiple={true} />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 animate-fade-in">
      <AuditSummaryBar stats={stats} diningApp={diningApp} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">已导入票据</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onBatchDownload}
            className="text-xs text-gray-700 hover:text-blue-600 border border-gray-200 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur apple-press"
          >
            批量下载改名文件
          </button>
          <button
            onClick={onClear}
            className="text-xs text-gray-600 hover:text-rose-600 border border-gray-200 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur apple-press"
          >
            清空列表
          </button>
        </div>
      </div>

      {diningApp.status !== 'idle' && (
        <div className={`p-3 rounded-lg border text-xs ${
          diningApp.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
          diningApp.status === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' :
          'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          {diningApp.status === 'processing' && '正在识别业务招待费申请单...'}
          {diningApp.status === 'success' && `已识别业务招待费申请单：${diningApp.file?.name || ''}`}
          {diningApp.status === 'error' && `申请单识别失败：${diningApp.error || ''}`}
        </div>
      )}

      <AuditFilters
        filter={filter}
        onFilterChange={onFilterChange}
        issuesFirst={issuesFirst}
        onIssuesFirstChange={onIssuesFirstChange}
      />

      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded-xl border border-gray-100 bg-white/70 backdrop-blur apple-hover apple-press">
            <div className="flex items-center gap-3 min-w-0">
              <FileThumbnail file={item.file} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{item.file.name}</div>
                <div className="text-xs text-gray-500">
                  {item.status === 'pending' && '等待处理'}
                  {item.status === 'processing' && '处理中...'}
                  {item.status === 'success' && (item.kind === 'application' ? '申请单' : '已完成')}
                  {item.status === 'error' && '失败'}
                </div>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${
              item.status === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
              item.status === 'error' ? 'text-rose-700 bg-rose-50 border-rose-200' :
              'text-gray-500 bg-white border-gray-200'
            }`}>
              {item.file.type === 'application/pdf' ? 'PDF' : 'IMG'}
            </span>
          </div>
        ))}
      </div>

      {showPagination && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <button
            onClick={onPrevPage}
            className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 apple-press"
          >
            上一页
          </button>
          <span>第 {auditPage} / {auditTotalPages} 页</span>
          <button
            onClick={onNextPage}
            className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 apple-press"
          >
            下一页
          </button>
        </div>
      )}

      <FileUpload onFileSelect={onFileSelect} isLoading={isLoading} multiple={true} compact={true} />
    </div>
  );
};
