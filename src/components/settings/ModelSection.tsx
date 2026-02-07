import React from 'react';
import { OcrProvider } from '../SettingsModal';

export interface ModelItem {
  name: string;
  source: 'history' | 'custom' | 'recommended';
}

interface ModelSectionProps {
  provider: OcrProvider;
  model: string;
  onModelChange: (value: string) => void;
  isModelListOpen: boolean;
  setIsModelListOpen: (v: boolean) => void;
  isModelFiltering: boolean;
  setIsModelFiltering: (v: boolean) => void;
  modelItems: ModelItem[];
  historyCount: number;
  onSelectModel: (name: string) => void;
  onRemoveHistory: (name: string) => void;
  onRemoveCustom: (name: string) => void;
  onHideRecommended: (name: string) => void;
  openrouterLoading: boolean;
  openrouterError: string | null;
  modelSyncMsg: string | null;
  apiCheckStatus: { status: 'idle' | 'checking' | 'ok' | 'error'; message?: string; latencyMs?: number };
  onApiCheck: () => void;
}

export const ModelSection: React.FC<ModelSectionProps> = ({
  provider,
  model,
  onModelChange,
  isModelListOpen,
  setIsModelListOpen,
  isModelFiltering,
  setIsModelFiltering,
  modelItems,
  historyCount,
  onSelectModel,
  onRemoveHistory,
  onRemoveCustom,
  onHideRecommended,
  openrouterLoading,
  openrouterError,
  modelSyncMsg,
  apiCheckStatus,
  onApiCheck
}) => {
  return (
    <div>
      {provider === 'openrouter' && openrouterError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {openrouterError}
        </div>
      )}
      {modelSyncMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {modelSyncMsg}
        </div>
      )}

      <label className="block text-sm font-medium text-gray-900 mb-1">
        2. 输入模型名称
      </label>
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs text-gray-500">
          支持 <span className="font-bold text-blue-600">自定义输入</span> 或从下拉列表选择历史模型
        </p>
        {provider === 'openrouter' && (
          <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
            {openrouterLoading ? '获取模型列表中…' : (openrouterError ? '使用默认推荐' : '已同步免费多模态模型')}
          </span>
        )}
        {historyCount > 0 && (
          <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
            已记录 {historyCount} 个常用模型
          </span>
        )}
      </div>

      <div className="relative group">
        <input
          type="text"
          value={model}
          onChange={(e) => { setIsModelFiltering(true); onModelChange(e.target.value); }}
          onFocus={() => { setIsModelFiltering(false); setIsModelListOpen(true); }}
          onClick={() => { setIsModelFiltering(false); setIsModelListOpen(true); }}
          placeholder="请输入模型名称，例如: Pro/moonshotai/Kimi-k2.5"
          className="w-full px-4 pr-10 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-sm text-gray-700 font-mono"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => { setIsModelFiltering(false); setIsModelListOpen(!isModelListOpen); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="toggle model list"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isModelListOpen && modelItems.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {modelItems.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-blue-50"
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelectModel(item.name)}
                  className="flex-1 text-left px-1 py-1 text-sm font-mono text-gray-700"
                >
                  {item.name}
                </button>
                {item.source === 'history' && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onRemoveHistory(item.name)}
                    className="text-xs text-gray-400 hover:text-red-500 px-1"
                    aria-label="remove model"
                  >
                    删除
                  </button>
                )}
                {item.source === 'custom' && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onRemoveCustom(item.name)}
                    className="text-xs text-gray-400 hover:text-red-500 px-1"
                    aria-label="remove custom model"
                  >
                    删除
                  </button>
                )}
                {item.source === 'recommended' && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onHideRecommended(item.name)}
                    className="text-xs text-gray-400 hover:text-red-500 px-1"
                    aria-label="hide recommended model"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onApiCheck}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          disabled={apiCheckStatus.status === 'checking'}
        >
          {apiCheckStatus.status === 'checking' ? '检测中…' : '检测可用性'}
        </button>
        {apiCheckStatus.status === 'ok' && (
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
            可用{typeof apiCheckStatus.latencyMs === 'number' ? ` · ${apiCheckStatus.latencyMs}ms` : ''}
          </span>
        )}
        {apiCheckStatus.status === 'error' && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            {apiCheckStatus.message || '不可用'}{typeof apiCheckStatus.latencyMs === 'number' ? ` · ${apiCheckStatus.latencyMs}ms` : ''}
          </span>
        )}
      </div>
    </div>
  );
};
