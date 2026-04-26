import React from 'react';
import { AuditStats, DiningAppState } from './types';

interface AuditSummaryBarProps {
  stats: AuditStats;
  diningApp: DiningAppState;
}

export const AuditSummaryBar: React.FC<AuditSummaryBarProps> = ({ stats, diningApp }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="p-4 rounded-xl bg-white/70 border border-gray-100 backdrop-blur">
        <div className="text-[11px] text-gray-400 uppercase tracking-wider">总数</div>
        <div className="text-xl font-bold text-gray-900">{stats.total}</div>
      </div>
      <div className="p-4 rounded-xl bg-white/70 border border-gray-100 backdrop-blur">
        <div className="text-[11px] text-amber-500 uppercase tracking-wider">处理中</div>
        <div className="text-xl font-bold text-amber-600">{stats.processing}</div>
      </div>
      <div className="p-4 rounded-xl bg-white/70 border border-gray-100 backdrop-blur">
        <div className="text-[11px] text-emerald-500 uppercase tracking-wider">已完成</div>
        <div className="text-xl font-bold text-emerald-600">{stats.success}</div>
      </div>
      <div className="p-4 rounded-xl bg-white/70 border border-gray-100 backdrop-blur">
        <div className="text-[11px] text-rose-500 uppercase tracking-wider">异常</div>
        <div className="text-xl font-bold text-rose-600">{stats.issueCount}</div>
      </div>
      <div className="p-4 rounded-xl bg-white/70 border border-gray-100 backdrop-blur">
        <div className="text-[11px] text-indigo-500 uppercase tracking-wider">餐饮</div>
        <div className="text-xl font-bold text-indigo-600">{stats.diningCount}</div>
      </div>
      <div className="p-4 rounded-xl bg-white/70 border border-gray-100 backdrop-blur">
        <div className="text-[11px] text-gray-400 uppercase tracking-wider">申请单</div>
        <div className={`text-sm font-semibold ${diningApp.data ? 'text-emerald-600' : 'text-gray-500'}`}>
          {diningApp.data ? '已识别' : '未识别'}
        </div>
      </div>
    </div>
  );
};
