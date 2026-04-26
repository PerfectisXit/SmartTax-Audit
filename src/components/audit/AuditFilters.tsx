import React from 'react';

export type AuditFilter = 'all' | 'error' | 'dining' | 'success';

interface AuditFiltersProps {
  filter: AuditFilter;
  onFilterChange: (next: AuditFilter) => void;
  issuesFirst: boolean;
  onIssuesFirstChange: (next: boolean) => void;
}

export const AuditFilters: React.FC<AuditFiltersProps> = ({
  filter,
  onFilterChange,
  issuesFirst,
  onIssuesFirstChange
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        onClick={() => onFilterChange('all')}
        className={`px-3 py-1.5 rounded-lg border ${filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'} apple-press`}
      >
        全部
      </button>
      <button
        onClick={() => onFilterChange('error')}
        className={`px-3 py-1.5 rounded-lg border ${filter === 'error' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200'} apple-press`}
      >
        异常
      </button>
      <button
        onClick={() => onFilterChange('dining')}
        className={`px-3 py-1.5 rounded-lg border ${filter === 'dining' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200'} apple-press`}
      >
        餐饮
      </button>
      <button
        onClick={() => onFilterChange('success')}
        className={`px-3 py-1.5 rounded-lg border ${filter === 'success' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-200'} apple-press`}
      >
        已完成
      </button>
      <label className="ml-auto inline-flex items-center gap-2 text-gray-500">
        <input
          type="checkbox"
          checked={issuesFirst}
          onChange={(e) => onIssuesFirstChange(e.target.checked)}
        />
        异常优先
      </label>
    </div>
  );
};
