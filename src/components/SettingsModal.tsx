
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
  setAuditConcurrency as setStoredAuditConcurrency,
  setModel,
  setProvider as setStoredProvider
} from '../services/storageService';
import { ProviderSelector } from './settings/ProviderSelector';
import { ModelSection, ModelItem } from './settings/ModelSection';
import { ApiKeySection } from './settings/ApiKeySection';
import { DEFAULT_MODEL_BY_PROVIDER, OCR_PROVIDERS, type OcrProvider } from '../domain/provider';

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
  ],
  chatgpt_web: [
    'chatgpt-web-default'
  ]
};

const PROVIDER_URLS: Record<Exclude<OcrProvider, 'kimi' | 'openrouter' | 'chatgpt_web'>, string> = {
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  minimax: 'https://api.minimax.chat/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
};
const KIMI_CHAT_URL = 'https://api.moonshot.cn/v1/chat/completions';

type ChatgptWebStatus = {
  sessionReady: boolean;
  busy: boolean;
  error?: string;
  code?: string;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsChange }) => {
  const [provider, setProvider] = useState<OcrProvider>('siliconflow');
  const [openrouterModels, setOpenrouterModels] = useState<string[] | null>(null);
  const [openrouterLoading, setOpenrouterLoading] = useState(false);
  const [openrouterError, setOpenrouterError] = useState<string | null>(null);
  const [openrouterErrorCode, setOpenrouterErrorCode] = useState<number | null>(null);
  const [chatgptStatus, setChatgptStatus] = useState<ChatgptWebStatus | null>(null);
  const [chatgptLoading, setChatgptLoading] = useState(false);
  const [chatgptActionError, setChatgptActionError] = useState<string | null>(null);
  const [chatgptActionBusy, setChatgptActionBusy] = useState(false);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [isModelFiltering, setIsModelFiltering] = useState(false);
  const [apiCheckStatus, setApiCheckStatus] = useState<{ status: 'idle' | 'checking' | 'ok' | 'error'; message?: string; latencyMs?: number }>({ status: 'idle' });
  const [customModels, setCustomModels] = useState<Partial<Record<OcrProvider, string[]>>>({});
  const [hiddenRecommended, setHiddenRecommended] = useState<Partial<Record<OcrProvider, string[]>>>({});
  const [modelSyncMsg, setModelSyncMsg] = useState<string | null>(null);
  const [auditConcurrency, setAuditConcurrency] = useState<number>(() => getAuditConcurrency());
  const modelListRef = useRef<HTMLDivElement | null>(null);
  
  // Current selections
  const [models, setModels] = useState<Record<OcrProvider, string>>({
    ...DEFAULT_MODEL_BY_PROVIDER
  });

  const [keys, setKeys] = useState<Record<OcrProvider, string>>({
    siliconflow: '',
    kimi: '',
    minimax: '',
    zhipu: '',
    dashscope: '',
    openrouter: '',
    chatgpt_web: ''
  });

  // History state
  const [historyModels, setHistoryModels] = useState<Partial<Record<OcrProvider, string[]>>>({});

  useEffect(() => {
    const storedProvider = getProvider();
    if (storedProvider) setProvider(storedProvider);

    // Load models
    const storedOpenrouter = getModel('openrouter');
    const openrouterDefault = storedOpenrouter === 'openai/gpt-4o-mini' ? DEFAULT_MODEL_BY_PROVIDER.openrouter : (storedOpenrouter || DEFAULT_MODEL_BY_PROVIDER.openrouter);
    setModels({
      siliconflow: getModel('siliconflow') || DEFAULT_MODEL_BY_PROVIDER.siliconflow,
      kimi: getModel('kimi') || DEFAULT_MODEL_BY_PROVIDER.kimi,
      minimax: getModel('minimax') || DEFAULT_MODEL_BY_PROVIDER.minimax,
      zhipu: getModel('zhipu') || DEFAULT_MODEL_BY_PROVIDER.zhipu,
      dashscope: getModel('dashscope') || DEFAULT_MODEL_BY_PROVIDER.dashscope,
      openrouter: openrouterDefault,
      chatgpt_web: getModel('chatgpt_web') || DEFAULT_MODEL_BY_PROVIDER.chatgpt_web
    });

    // Load keys
    setKeys({
      siliconflow: getApiKey('siliconflow'),
      kimi: getApiKey('kimi'),
      minimax: getApiKey('minimax'),
      zhipu: getApiKey('zhipu'),
      dashscope: getApiKey('dashscope'),
      openrouter: '',
      chatgpt_web: ''
    });

    // Load history
    setHistoryModels({
      siliconflow: getHistoryModels('siliconflow'),
      kimi: getHistoryModels('kimi'),
      minimax: getHistoryModels('minimax'),
      zhipu: getHistoryModels('zhipu'),
      dashscope: getHistoryModels('dashscope'),
      openrouter: getHistoryModels('openrouter'),
      chatgpt_web: getHistoryModels('chatgpt_web')
    });
    setHiddenRecommended({
      siliconflow: getHiddenModels('siliconflow'),
      kimi: getHiddenModels('kimi'),
      minimax: getHiddenModels('minimax'),
      zhipu: getHiddenModels('zhipu'),
      dashscope: getHiddenModels('dashscope'),
      openrouter: getHiddenModels('openrouter'),
      chatgpt_web: getHiddenModels('chatgpt_web')
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
      const providers = OCR_PROVIDERS.filter((p) => p !== 'chatgpt_web');
      const entries = await Promise.all(providers.map(async (p) => [p, await loadCustom(p)] as const));
      const next: Partial<Record<OcrProvider, string[]>> = {};
      for (const [p, list] of entries) next[p] = list;
      next.chatgpt_web = [DEFAULT_MODEL_BY_PROVIDER.chatgpt_web];
      setCustomModels(next);
    })();
  }, [isOpen]);

  useEffect(() => {
    setApiCheckStatus({ status: 'idle' });
  }, [provider, models, keys]);

  useEffect(() => {
    if (provider !== 'chatgpt_web') return;
    setModels(prev => {
      if (prev.chatgpt_web === DEFAULT_MODEL_BY_PROVIDER.chatgpt_web) return prev;
      return { ...prev, chatgpt_web: DEFAULT_MODEL_BY_PROVIDER.chatgpt_web };
    });
  }, [provider]);

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
          setOpenrouterError('无法获取 OpenRouter 模型列表，请确认后端已配置 `OPENROUTER_API_KEY`');
        }
        setOpenrouterModels(null);
      })
      .finally(() => {
        if (cancelled) return;
        setOpenrouterLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, provider]);

  const refreshChatgptStatus = async () => {
    setChatgptLoading(true);
    setChatgptActionError(null);
    try {
      const res = await fetch('/api/chatgpt-web/status');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`;
        throw new Error(message);
      }
      setChatgptStatus({
        sessionReady: Boolean(data?.sessionReady),
        busy: Boolean(data?.busy),
        error: typeof data?.error === 'string' ? data.error : undefined,
        code: typeof data?.code === 'string' ? data.code : undefined
      });
    } catch (e: any) {
      setChatgptStatus(null);
      setChatgptActionError(e?.message || '无法获取 ChatGPT 会话状态');
    } finally {
      setChatgptLoading(false);
    }
  };

  const openChatgptLogin = async () => {
    setChatgptActionBusy(true);
    setChatgptActionError(null);
    try {
      const res = await fetch('/api/chatgpt-web/session/open', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      await refreshChatgptStatus();
    } catch (e: any) {
      setChatgptActionError(e?.message || '打开 ChatGPT 登录窗口失败');
    } finally {
      setChatgptActionBusy(false);
    }
  };

  useEffect(() => {
    if (!isOpen || provider !== 'chatgpt_web') return;
    void refreshChatgptStatus();
  }, [isOpen, provider]);

  useEffect(() => {
    if (provider === 'chatgpt_web' && auditConcurrency !== 1) {
      setAuditConcurrency(1);
    }
  }, [provider, auditConcurrency]);

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
    setStoredProvider(provider);
    
    // Save keys
    setApiKey('siliconflow', keys.siliconflow.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('kimi', keys.kimi.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('minimax', keys.minimax.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('zhipu', keys.zhipu.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('dashscope', keys.dashscope.replace(/[^\x00-\x7F]/g, "").trim());
    setApiKey('openrouter', '');

    // Save current model selection
    setModel('siliconflow', models.siliconflow);
    setModel('kimi', models.kimi);
    setModel('minimax', models.minimax);
    setModel('zhipu', models.zhipu);
    setModel('dashscope', models.dashscope);
    setModel('openrouter', models.openrouter);
    setModel('chatgpt_web', DEFAULT_MODEL_BY_PROVIDER.chatgpt_web);
    addHistoryModel(provider, models[provider]);
    addCustomModel(provider, models[provider]);
    setStoredAuditConcurrency(provider === 'chatgpt_web' ? 1 : auditConcurrency);

    onSettingsChange();
    onClose();
  };

  const handleKeyChange = (keyType: OcrProvider, value: string) => {
    setKeys(prev => ({ ...prev, [keyType]: value }));
  };

  const handleModelChange = (value: string) => {
    if (provider === 'chatgpt_web') {
      setModels(prev => ({ ...prev, chatgpt_web: DEFAULT_MODEL_BY_PROVIDER.chatgpt_web }));
      return;
    }
    setModels(prev => ({ ...prev, [provider]: value }));
  };

  const addHistoryModelLocal = (p: OcrProvider, model: string) => {
    addHistoryModel(p, model);
    setHistoryModels(prev => ({ ...prev, [p]: getHistoryModels(p) }));
  };

  const removeHistoryModelLocal = (p: OcrProvider, model: string) => {
    persistRemoveHistory(p, model);
    setHistoryModels(prev => ({ ...prev, [p]: getHistoryModels(p) }));
  };

  const addCustomModel = async (p: OcrProvider, model: string) => {
    if (!model) return;
    if (p === 'chatgpt_web') return;
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

  const removeCustomModel = async (p: OcrProvider, model: string) => {
    if (p === 'chatgpt_web') return;
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

  const hideRecommendedModel = (p: OcrProvider, model: string) => {
    persistHiddenModel(p, model);
    setHiddenRecommended(prev => ({ ...prev, [p]: getHiddenModels(p) }));
  };

  const getModelItems = (): ModelItem[] => {
    if (provider === 'chatgpt_web') {
      return [{ name: DEFAULT_MODEL_BY_PROVIDER.chatgpt_web, source: 'recommended' }];
    }
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
    if (provider !== 'openrouter' && provider !== 'chatgpt_web' && !apiKey) {
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
      if (provider === 'chatgpt_web') {
        response = await fetch('/api/chatgpt-web/status');
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const err: any = new Error(`${response.status} ${sanitizeErrorMessage(body?.error || 'ChatGPT Web 状态检查失败')}`);
          err.latencyMs = Math.round(performance.now() - start);
          throw err;
        }
        if (!body?.sessionReady) {
          const err: any = new Error('未检测到可用会话，请点击“打开登录窗口”并完成登录');
          err.latencyMs = Math.round(performance.now() - start);
          throw err;
        }
      } else if (provider === 'openrouter') {
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
      if (provider !== 'chatgpt_web') {
        if (!response.ok) {
          const text = await response.text();
          const err: any = new Error(`${response.status} ${sanitizeErrorMessage(text)}`);
          err.latencyMs = latencyMs;
          throw err;
        }
      }
      setApiCheckStatus({ status: 'ok', message: '可用', latencyMs });
      if (provider !== 'chatgpt_web') {
        addHistoryModel(provider, model);
        addCustomModel(provider, model);
      }
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
                modelInputDisabled={provider === 'chatgpt_web'}
                modelPlaceholder={provider === 'chatgpt_web' ? 'chatgpt-web-default（固定）' : undefined}
              />
            </div>

            {provider === 'chatgpt_web' ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">3. ChatGPT 网页会话</div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${chatgptStatus?.sessionReady ? 'text-green-700 border-green-200 bg-green-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>
                    {chatgptStatus?.sessionReady ? '已登录' : '未登录'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  该模式不使用 API Key，依赖本机浏览器登录态。ChatGPT 网页更新可能导致暂时不可用。
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openChatgptLogin()}
                    disabled={chatgptActionBusy}
                    className="px-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {chatgptActionBusy ? '处理中…' : '打开登录窗口'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshChatgptStatus()}
                    disabled={chatgptLoading}
                    className="px-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {chatgptLoading ? '检测中…' : '检测会话'}
                  </button>
                  {chatgptStatus?.busy && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">后端繁忙</span>
                  )}
                </div>
                {(chatgptActionError || chatgptStatus?.error) && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                    {chatgptActionError || chatgptStatus?.error}
                  </div>
                )}
              </div>
            ) : (
              <ApiKeySection
                provider={provider}
                value={keys[provider]}
                onChange={(v) => handleKeyChange(provider, v)}
                disabled={provider === 'openrouter'}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                并发数（批量审核）
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={provider === 'chatgpt_web' ? 1 : auditConcurrency}
                onChange={(e) => setAuditConcurrency(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                disabled={provider === 'chatgpt_web'}
                className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-sm text-gray-700 ${provider === 'chatgpt_web' ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
              <div className="text-[10px] text-gray-400 mt-1">
                {provider === 'chatgpt_web'
                  ? 'ChatGPT Web 强制串行执行（并发=1）以提高稳定性'
                  : '范围 1-8，数值越大请求越快但更容易触发限流'}
              </div>
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
