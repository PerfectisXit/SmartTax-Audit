
import React, { useState, useEffect, useRef } from 'react';
import {
  addHistoryModel,
  getApiKey,
  getAuditConcurrency,
  getHiddenModels,
  getHistoryModels,
  getModel,
  getProvider,
  hideRecommendedModel as persistHiddenModel,
  removeHistoryModel as persistRemoveHistory,
  setApiKey,
  setAuditConcurrency,
  setModel,
  setProvider
} from '../services/storageService';
import { ProviderSelector } from './settings/ProviderSelector';
import { ModelSection, ModelItem } from './settings/ModelSection';
import { ApiKeySection } from './settings/ApiKeySection';

export type OcrProvider = 'siliconflow' | 'kimi' | 'minimax' | 'zhipu' | 'dashscope' | 'openrouter';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: () => void;
}

// Default recommended vision models for each provider
const RECOMMENDED_MODELS: Record<OcrProvider, string[]> = {
  siliconflow: [
    'Qwen/Qwen3-VL-32B-Instruct',
    'Pro/moonshotai/Kimi-k2.5',
    'Pro/Qwen/Qwen2-VL-7B-Instruct',
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen2.5-72B-Instruct',
    'TeleAI/TeleMM'
  ],
  kimi: [
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k'
  ],
  minimax: [
    'abab6.5s-chat',
    'abab5.5s-chat'
  ],
  zhipu: [
    'glm-4v',
    'glm-4v-plus',
    'glm-4-alltools'
  ],
  dashscope: [
    'qwen-vl-max',
    'qwen-vl-plus',
    'qwen-vl-v1'
  ],
  openrouter: [
    'openrouter/free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-4b-it:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-27b-it:free'
  ]
};

const PROVIDER_URLS: Record<Exclude<OcrProvider, 'kimi' | 'openrouter'>, string> = {
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  minimax: 'https://api.minimax.chat/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
};
const KIMI_CHAT_URL = 'https://api.moonshot.cn/v1/chat/completions';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsChange }) => {
  const [provider, setProvider] = useState<OcrProvider>('siliconflow');
  const [openrouterModels, setOpenrouterModels] = useState<string[] | null>(null);
  const [openrouterLoading, setOpenrouterLoading] = useState(false);
  const [openrouterError, setOpenrouterError] = useState<string | null>(null);
  const [openrouterErrorCode, setOpenrouterErrorCode] = useState<number | null>(null);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [isModelFiltering, setIsModelFiltering] = useState(false);
  const [apiCheckStatus, setApiCheckStatus] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; message?: string; latencyMs?: number }>({ status: 'idle' });
  const [customModels, setCustomModels] = useState<Record<string, string[]>>({});
  const [hiddenRecommended, setHiddenRecommended] = useState<Record<string, string[]>>({});
  const [modelSyncMsg, setModelSyncMsg] = useState<string | null>(null);
  const [auditConcurrency, setAuditConcurrency] = useState<number>(() => getAuditConcurrency());
  const modelListRef = useRef<HTMLDivElement | null>(null);
  
  // Current selections
  const [models, setModels] = useState<Record<string, string>>({
    siliconflow: 'Qwen/Qwen3-VL-32B-Instruct',
    kimi: 'moonshot-v1-8k',
    minimax: 'abab6.5s-chat',
    zhipu: 'glm-4v',
    dashscope: 'qwen-vl-max',
    openrouter: 'openai/gpt-4o-mini'
  });

  const [keys, setKeys] = useState<Record<string, string>>({
    siliconflow: '',
    kimi: '',
    minimax: '',
    zhipu: '',
    dashscope: '',
    openrouter: ''
  });

  // History state
  const [historyModels, setHistoryModels] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const storedProvider = getProvider() as OcrProvider | null;
    if (storedProvider) setProvider(storedProvider);

    // Load models
    const storedOpenrouter = getModel('openrouter');
    const openrouterDefault = storedOpenrouter === 'openai/gpt-4o-mini' ? 'openrouter/free' : (storedOpenrouter || 'openrouter/free');
    setModels({
      siliconflow: getModel('siliconflow') || 'Qwen/Qwen3-VL-32B-Instruct',
      kimi: getModel('kimi') || 'moonshot-v1-8k',
      minimax: getModel('minimax') || 'abab6.5s-chat',
      zhipu: getModel('zhipu') || 'glm-4v',
      dashscope: getModel('dashscope') || 'qwen-vl-max',
      openrouter: openrouterDefault
    });

    // Load keys
    setKeys({
      siliconflow: getApiKey('siliconflow'),
      kimi: getApiKey('kimi'),
      minimax: getApiKey('minimax'),
      zhipu: getApiKey('zhipu'),
      dashscope: getApiKey('dashscope'),
      openrouter: getApiKey('openrouter')
    });

    // Load history
    setHistoryModels({
      siliconflow: getHistoryModels('siliconflow'),
      kimi: getHistoryModels('kimi'),
      minimax: getHistoryModels('minimax'),
      zhipu: getHistoryModels('zhipu'),
      dashscope: getHistoryModels('dashscope'),
      openrouter: getHistoryModels('openrouter')
    });
    setHiddenRecommended({
      siliconflow: getHiddenModels('siliconflow'),
      kimi: getHiddenModels('kimi'),
      minimax: getHiddenModels('minimax'),
      zhipu: getHiddenModels('zhipu'),
      dashscope: getHiddenModels('dashscope'),
      openrouter: getHiddenModels('openrouter')
    });

    const loadCustom = async (p: OcrProvider) => {
      try {
        const res = await fetch(`/api/models/${p}`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.models) ? data.models : [];
      } catch (e) {
        return [];
      }
    };

    (async () => {
      const providers: OcrProvider[] = ['siliconflow', 'kimi', 'minimax', 'zhipu', 'dashscope', 'openrouter'];
      const entries = await Promise.all(providers.map(async (p) => [p, await loadCustom(p)] as const));
      const next: Record<string, string[]> = {};
      for (const [p, list] of entries) next[p] = list;
      setCustomModels(next);
    })();
  }, [isOpen]);

  useEffect(() => {
    setApiCheckStatus({ status: 'idle' });
  }, [provider, models, keys]);

  useEffect(() => {
    if (!isOpen || provider !== 'openrouter') return;
    let cancelled = false;
    setOpenrouterLoading(true);
    setOpenrouterError(null);
    setOpenrouterErrorCode(null);
    fetch('/api/openrouter/models')
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          const err: any = new Error(text || `HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.models) ? data.models : [];
        setOpenrouterModels(list);
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn('Failed to load OpenRouter models:', e);
        const status = typeof e?.status === 'number' ? e.status : null;
        setOpenrouterErrorCode(status);
        if (status === 404) {
          setOpenrouterError('未检测到后端 /api/openrouter，请先启动 `npm run server` 并重启前端');
        } else {
          setOpenrouterError('无法获取 OpenRouter 免费多模态模型列表，将使用默认推荐');
        }
        setOpenrouterModels(null);
      })
      .finally(() => {
        if (cancelled) return;
        setOpenrouterLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, provider]);

  useEffect(() => {
    if (!isModelListOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!modelListRef.current) return;
      if (!modelListRef.current.contains(e.target as Node)) {
        setIsModelListOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isModelListOpen]);

  const handleSave = () => {
    setProvider(provider as any);
    
    // Save keys
    setApiKey('siliconflow', keys.siliconflow.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('kimi', keys.kimi.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('minimax', keys.minimax.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('zhipu', keys.zhipu.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('dashscope', keys.dashscope.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('openrouter', keys.openrouter.replace(/[^\x00-\x7F]/g, "").trim());

    // Save current model selection
    setModel('siliconflow', models.siliconflow);
    setModel('kimi', models.kimi);
    setModel('minimax', models.minimax);
    setModel('zhipu', models.zhipu);
    setModel('dashscope', models.dashscope);
    setModel('openrouter', models.openrouter);
    addHistoryModel(provider as any, models[provider]);
    addCustomModel(provider, models[provider]);
    setAuditConcurrency(auditConcurrency);

    onSettingsChange();
    onClose();
  };

  const handleKeyChange = (keyType: string, value: string) => {
    setKeys(prev => ({ ...prev, [keyType]: value }));
  };

  const handleModelChange = (value: string) => {
    setModels(prev => ({ ...prev, [provider]: value }));
  };

  const addHistoryModelLocal = (p: string, model: string) => {
    addHistoryModel(p as any, model);
    setHistoryModels(prev => ({ ...prev, [p]: getHistoryModels(p as any) }));
  };

  const removeHistoryModelLocal = (p: string, model: string) => {
    persistRemoveHistory(p as any, model);
    setHistoryModels(prev => ({ ...prev, [p]: getHistoryModels(p as any) }));
  };

  const addCustomModel = async (p: string, model: string) => {
    if (!model) return;
    try {
      const res = await fetch(`/api/models/${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const list = Array.isArray(data?.models) ? data.models : [];
      setCustomModels(prev => ({ ...prev, [p]: list }));
      setModelSyncMsg(null);
    } catch (e) {
      console.warn('Failed to save custom model', e);
      setModelSyncMsg('自定义模型保存失败，请检查后端服务');
    }
  };

  const removeCustomModel = async (p: string, model: string) => {
    try {
      const res = await fetch(`/api/models/${p}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const list = Array.isArray(data?.models) ? data.models : [];
      setCustomModels(prev => ({ ...prev, [p]: list }));
      setModelSyncMsg(null);
    } catch (e) {
      console.warn('Failed to remove custom model', e);
      setModelSyncMsg('自定义模型删除失败，请检查后端服务');
    }
  };

  const hideRecommendedModel = (p: string, model: string) => {
    persistHiddenModel(p as any, model);
    setHiddenRecommended(prev => ({ ...prev, [p]: getHiddenModels(p as any) }));
  };

  const getModelItems = (): ModelItem[] => {
    const recommendedBase = provider === 'openrouter'
      ? (openrouterModels && openrouterModels.length > 0 ? openrouterModels : RECOMMENDED_MODELS.openrouter)
      : (RECOMMENDED_MODELS[provider] || []);
    const history = historyModels[provider] || [];
    const custom = customModels[provider] || [];
    const hidden = new Set(hiddenRecommended[provider] || []);
    const recommended = recommendedBase.filter((m) => !hidden.has(m));
    const seen = new Set<string>();
    const items: { name: string; source: 'history' | 'custom' | 'recommended' }[] = [];
    for (const m of history) {
      if (!seen.has(m)) {
        items.push({ name: m, source: 'history' });
        seen.add(m);
      }
    }
    for (const m of custom) {
      if (!seen.has(m)) {
        items.push({ name: m, source: 'custom' });
        seen.add(m);
      }
    }
    for (const m of recommended) {
      if (!seen.has(m)) {
        items.push({ name: m, source: 'recommended' });
        seen.add(m);
      }
    }
    return items;
  };

  const getFilteredModelList = () => {
    const list = getModelItems();
    if (!isModelFiltering) return list;
    const q = (models[provider] || '').toLowerCase();
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  };

  const sanitizeErrorMessage = (text: string) => {
    if (!text) return '请求失败';
    const noTags = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return noTags.slice(0, 200);
  };

  const handleApiCheck = async () => {
    const model = models[provider];
    const apiKey = keys[provider];
    if (provider !== 'openrouter' && !apiKey) {
      setApiCheckStatus({ status: 'error', message: '请先填写 API Key' });
      return;
    }
    if (!model) {
      setApiCheckStatus({ status: 'error', message: '请先填写模型名称' });
      return;
    }
    setApiCheckStatus({ status: 'checking' });
    try {
      const start = performance.now();
      let response: Response;
      if (provider === 'openrouter') {
        response = await fetch('/api/openrouter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
            temperature: 0,
          })
        });
      } else if (provider === 'kimi') {
        response = await fetch(KIMI_CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
            temperature: 0
          })
        });
      } else {
        const url = PROVIDER_URLS[provider];
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
            temperature: 0
          })
        });
      }
      const latencyMs = Math.round(performance.now() - start);
      if (!response.ok) {
        const text = await response.text();
        const err: any = new Error(`${response.status} ${sanitizeErrorMessage(text)}`);
        err.latencyMs = latencyMs;
        throw err;
      }
      setApiCheckStatus({ status: 'ok', message: '可用', latencyMs });
      addHistoryModel(provider, model);
      addCustomModel(provider, model);
    } catch (e: any) {
      const latencyMs = typeof e?.latencyMs === 'number' ? e.latencyMs : undefined;
      setApiCheckStatus({ status: 'error', message: sanitizeErrorMessage(e?.message || ''), latencyMs });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full p-8 transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">识别引擎设置</h2>
            <p className="text-sm text-gray-500 mt-1">配置 AI 接口参数以启动 OCR 功能</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <ProviderSelector provider={provider} onChange={setProvider} />

          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-5">
            <div ref={modelListRef}>
              <ModelSection
                provider={provider}
                model={models[provider]}
                onModelChange={handleModelChange}
                isModelListOpen={isModelListOpen}
                setIsModelListOpen={setIsModelListOpen}
                isModelFiltering={isModelFiltering}
                setIsModelFiltering={setIsModelFiltering}
                modelItems={getFilteredModelList()}
                historyCount={historyModels[provider]?.length || 0}
                onSelectModel={(name) => { handleModelChange(name); addHistoryModelLocal(provider, name); setIsModelListOpen(false); }}
                onRemoveHistory={(name) => removeHistoryModelLocal(provider, name)}
                onRemoveCustom={(name) => removeCustomModel(provider, name)}
                onHideRecommended={(name) => hideRecommendedModel(provider, name)}
                openrouterLoading={openrouterLoading}
                openrouterError={openrouterError}
                modelSyncMsg={modelSyncMsg}
                apiCheckStatus={apiCheckStatus}
                onApiCheck={handleApiCheck}
              />
            </div>

            <ApiKeySection
              provider={provider}
              value={keys[provider]}
              onChange={(v) => handleKeyChange(provider, v)}
              disabled={provider === 'openrouter'}
            />

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                并发数（批量审核）
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={auditConcurrency}
                onChange={(e) => setAuditConcurrency(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-sm text-gray-700"
              />
              <div className="text-[10px] text-gray-400 mt-1">范围 1-8，数值越大请求越快但更容易触发限流</div>
            </div>

          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-50 rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
};
