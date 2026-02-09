import React from 'react';
import type { OcrProvider } from '../../domain/provider';

interface ProviderSelectorProps {
  provider: OcrProvider;
  onChange: (p: OcrProvider) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ provider, onChange }) => {
  const options = [
    { id: 'siliconflow', label: 'SiliconFlow (硅基流动)' },
    { id: 'dashscope', label: 'Aliyun (通义千问)' },
    { id: 'zhipu', label: 'Zhipu AI (智谱)' },
    { id: 'kimi', label: 'Kimi (Moonshot)' },
    { id: 'minimax', label: 'MiniMax (海螺)' },
    { id: 'openrouter', label: 'OpenRouter' }
  ] as const;

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3">1. 选择 AI 服务商</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {options.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`py-2.5 px-2 text-xs sm:text-sm rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1 min-h-[50px] ${
              provider === p.id
                ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold shadow-sm ring-1 ring-blue-500'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {provider === p.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mb-0.5"></span>}
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};
