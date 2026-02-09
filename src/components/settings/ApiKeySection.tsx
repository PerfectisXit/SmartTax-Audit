import React from 'react';
import type { OcrProvider } from '../../domain/provider';

interface ApiKeySectionProps {
  provider: OcrProvider;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ApiKeySection: React.FC<ApiKeySectionProps> = ({ provider, value, onChange, disabled = false }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-900">
          3. API Key
        </label>
        <span className="text-xs font-mono text-gray-400 uppercase">
          {provider} KEY
        </span>
      </div>
      <div className="relative">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`请输入 ${provider === 'siliconflow' ? 'sk-...' : provider === 'openrouter' ? 'sk-or-...' : 'API Key'}`}
          disabled={disabled}
          className={`w-full pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 justify-end text-xs">
        {provider === 'siliconflow' && <a href="https://cloud.siliconflow.cn/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">获取 SiliconFlow Key <span className="ml-1">↗</span></a>}
        {provider === 'kimi' && <a href="https://platform.moonshot.cn/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">获取 Moonshot Key <span className="ml-1">↗</span></a>}
        {provider === 'minimax' && <a href="https://platform.minimaxi.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">获取 MiniMax Key <span className="ml-1">↗</span></a>}
        {provider === 'zhipu' && <a href="https://open.bigmodel.cn/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">获取 Zhipu AI Key <span className="ml-1">↗</span></a>}
        {provider === 'dashscope' && <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">获取 Aliyun DashScope Key <span className="ml-1">↗</span></a>}
        {provider === 'openrouter' && !disabled && <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">获取 OpenRouter Key <span className="ml-1">↗</span></a>}
      </div>
      {provider === 'openrouter' && disabled && (
        <div className="text-[10px] text-gray-400 mt-1 text-right">
          OpenRouter Key 已移至服务端环境变量配置
        </div>
      )}
    </div>
  );
};
