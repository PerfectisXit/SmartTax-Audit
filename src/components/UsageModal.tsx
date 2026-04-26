import React, { useEffect, useState } from 'react';
import { getUsage, getBatchUsage, resetUsage, UsageData, UsageBucket } from '../services/usageService';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QWEN_MODEL = 'Qwen/Qwen3-VL-32B-Instruct';
const QWEN_INPUT_RATE = 1; // ¥ / 1M tokens
const QWEN_OUTPUT_RATE = 4; // ¥ / 1M tokens

const getMonthKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

const calcCost = (bucket: UsageBucket | undefined) => {
  if (!bucket) return 0;
  return (bucket.prompt / 1_000_000) * QWEN_INPUT_RATE + (bucket.completion / 1_000_000) * QWEN_OUTPUT_RATE;
};

const emptyBucket = (): UsageBucket => ({ prompt: 0, completion: 0, total: 0 });

export const UsageModal: React.FC<UsageModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<UsageData>(() => getUsage());
  const [batch, setBatch] = useState(() => getBatchUsage());

  useEffect(() => {
    if (!isOpen) return;
    setData(getUsage());
    setBatch(getBatchUsage());
  }, [isOpen]);

  if (!isOpen) return null;

  const monthKey = getMonthKey();
  const monthly = data.monthly[monthKey] || { prompt: 0, completion: 0, total: 0 };
  const qwenTotal = data.models[QWEN_MODEL]?.total;
  const qwenMonthly = data.models[QWEN_MODEL]?.monthly?.[monthKey];
  const batchQwen = batch.models[QWEN_MODEL];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tokens 用量统计</h2>
            <p className="text-xs text-gray-500 mt-1">仅统计成功返回且包含 usage 字段的请求</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
            <div className="text-xs text-gray-500">累计 Tokens</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{fmt(data.total.total)}</div>
            <div className="text-[10px] text-gray-500">输入 {fmt(data.total.prompt)} · 输出 {fmt(data.total.completion)}</div>
          </div>
          <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
            <div className="text-xs text-gray-500">本月 Tokens</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{fmt(monthly.total)}</div>
            <div className="text-[10px] text-gray-500">输入 {fmt(monthly.prompt)} · 输出 {fmt(monthly.completion)}</div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Qwen/Qwen3-VL-32B-Instruct 费用</div>
              <div className="text-[10px] text-gray-500 mt-0.5">输入 ¥1 / 1M · 输出 ¥4 / 1M</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">¥{fmt(calcCost(qwenTotal))}</div>
              <div className="text-[10px] text-gray-500">本月 ¥{fmt(calcCost(qwenMonthly))}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">本次报销用量</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{batch.active ? (batch.label || '进行中') : '已结束'}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">{fmt(batch.total.total)}</div>
              <div className="text-[10px] text-gray-500">输入 {fmt(batch.total.prompt)} · 输出 {fmt(batch.total.completion)}</div>
              <div className="text-[10px] text-gray-500">费用 ¥{fmt(calcCost(batchQwen))}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-100 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">按供应商与模型统计</div>
          <div className="space-y-3 max-h-64 overflow-auto pr-1">
            {Object.keys(data.providers).length === 0 && (
              <div className="text-xs text-gray-400">暂无统计数据</div>
            )}
            {Object.entries(data.providers).map(([provider, pData]) => (
              <div key={provider} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-gray-700 uppercase">{provider}</div>
                  <div className="text-xs text-gray-500">累计 {fmt(pData.total.total)}</div>
                </div>
                <div className="text-[10px] text-gray-500 mb-2">本月 {fmt((pData.monthly[monthKey] || emptyBucket()).total)}</div>
                <div className="space-y-1">
                  {Object.entries(pData.models).map(([model, mData]) => (
                    <div key={model} className="flex items-center justify-between text-[10px] text-gray-600">
                      <span className="truncate max-w-[220px]" title={model}>{model}</span>
                      <span>{fmt(mData.total.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => { resetUsage(); setData(getUsage()); }}
            className="px-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 apple-press"
          >
            清空统计
          </button>
        </div>
      </div>
    </div>
  );
};
