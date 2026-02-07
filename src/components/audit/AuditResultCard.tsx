import React from 'react';
import { ExpenseCategory } from '../../types';
import { ResultCard } from '../ResultCard';
import { buildAuditFilename, buildDiningApplicationFilename, downloadRenamedAuditFile, downloadRenamedDiningApplication } from '../../services/fileService';
import { Badge } from '../common/Badge';
import { AuditItem, DiningAppState } from './types';

interface AuditResultCardProps {
  item: AuditItem;
  diningApp: DiningAppState;
}

export const AuditResultCard: React.FC<AuditResultCardProps> = ({ item, diningApp }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{item.file.name}</span>
        {item.status === 'processing' && <span className="text-blue-600">处理中...</span>}
        {item.status === 'success' && <span className="text-emerald-600">完成</span>}
        {item.status === 'error' && <span className="text-rose-600">失败</span>}
      </div>

      {item.status === 'success' && item.kind === 'application' && (
        <div className="p-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl space-y-2">
          <div className="text-sm font-semibold">业务招待费申请单</div>
          {diningApp.data && diningApp.file?.name === item.file.name ? (
            <div className="text-xs mt-2 space-y-1">
              <div>招待人数：{diningApp.data.guestCount || 0}</div>
              <div>陪同人数：{diningApp.data.staffCount || 0}</div>
              <div>总人数：{(diningApp.data.guestCount || 0) + (diningApp.data.staffCount || 0)}</div>
              <div>申请日期：{diningApp.data.applicationDate || '未识别'}</div>
              <div>预计金额：¥{diningApp.data.estimatedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
          ) : (
            <div className="text-xs mt-2">已识别为申请单</div>
          )}
          {diningApp.data && diningApp.file?.name === item.file.name && (
            <div className="flex items-center justify-between gap-3 text-xs text-blue-700 bg-white/70 border border-blue-100 rounded-lg px-3 py-2">
              <span className="truncate" title={buildDiningApplicationFilename(diningApp.data.estimatedAmount, diningApp.data.applicationDate)}>
                重命名: {buildDiningApplicationFilename(diningApp.data.estimatedAmount, diningApp.data.applicationDate)}
              </span>
              <button
                onClick={() => downloadRenamedDiningApplication(item.file, diningApp.data!.estimatedAmount, diningApp.data!.applicationDate)}
                className="px-2 py-1 border border-blue-200 rounded hover:bg-white text-blue-700 apple-press"
              >
                下载改名文件
              </button>
            </div>
          )}
        </div>
      )}

      {item.status === 'success' && item.result && (
        <div className="flex items-baseline justify-between bg-white/70 border border-gray-100 rounded-2xl px-4 py-3 backdrop-blur">
          <div>
            <div className="text-base font-bold text-gray-900">
              <span className="text-xs text-gray-400 mr-0.5">¥</span>
              {item.result.data.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              税额 ¥{item.result.data.taxAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              {item.result.data.taxRate ? ` · 税率 ${item.result.data.taxRate}` : ''}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {item.result.data.invoiceDate}
          </div>
        </div>
      )}

      {item.status === 'success' && item.result && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge>类型: {item.result.data.expenseType}</Badge>
          <Badge>票种: {item.result.data.documentType}</Badge>
          <Badge>购买方: {item.result.data.buyerName}</Badge>
          {item.result.data.isRefundDetected && (
            <Badge tone="danger">疑似退票/退款</Badge>
          )}
          {item.diningIssues && item.diningIssues.length > 0 && (
            <Badge tone="warning">招待费校验异常</Badge>
          )}
        </div>
      )}

      {item.status === 'success' && item.result && (
        <div className="flex items-center justify-between gap-3 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <span className="truncate" title={buildAuditFilename(item.result)}>
            重命名: {buildAuditFilename(item.result)}
          </span>
          <button
            onClick={() => downloadRenamedAuditFile(item.file, item.result!)}
            className="px-2 py-1 border border-gray-200 rounded hover:bg-white text-gray-700 apple-press"
          >
            下载改名文件
          </button>
        </div>
      )}

      {item.status === 'error' && item.error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl">
          <div className="text-sm font-semibold">识别失败</div>
          <div className="text-xs mt-1">{item.error}</div>
        </div>
      )}

      {item.status === 'success' && item.result && (
        <ResultCard result={item.result} />
      )}

      {item.status === 'success' && item.result?.category === ExpenseCategory.DINING && (
        <div className={`p-4 rounded-xl border ${
          diningApp.data
            ? (item.diningIssues && item.diningIssues.length > 0
                ? 'bg-amber-50 border-amber-100 text-amber-700'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700')
            : 'bg-gray-50 border-gray-100 text-gray-500'
        }`}>
          <div className="text-sm font-semibold">招待费申请单校验</div>
          {!diningApp.data && (
            <div className="text-xs mt-1">未检测到业务招待费申请单，请先上传申请单再校验。</div>
          )}
          {diningApp.data && item.diningIssues && item.diningIssues.length > 0 && (
            <ul className="mt-1 text-xs list-disc pl-4 space-y-1">
              {item.diningIssues.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          )}
          {diningApp.data && (!item.diningIssues || item.diningIssues.length === 0) && (
            <div className="text-xs mt-1">申请单填写符合招待费填报策略。</div>
          )}
        </div>
      )}
    </div>
  );
};
