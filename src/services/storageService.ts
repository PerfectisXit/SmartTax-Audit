export type OcrProviderKey = 'siliconflow' | 'kimi' | 'minimax' | 'zhipu' | 'dashscope' | 'openrouter';

const STORAGE_VERSION = 1;
const VERSION_KEY = 'storage_version';
const PROVIDER_KEY = 'ocrProvider';
const AUDIT_CONCURRENCY_KEY = 'audit_concurrency';
const USAGE_KEY = 'token_usage_v1';
const USAGE_BATCH_KEY = 'token_usage_batch_v1';

const API_KEY_MAP: Record<OcrProviderKey, string> = {
  siliconflow: 'siliconFlowApiKey',
  kimi: 'kimiApiKey',
  minimax: 'minimaxApiKey',
  zhipu: 'zhipuApiKey',
  dashscope: 'dashscopeApiKey',
  openrouter: 'openrouterApiKey'
};

const MODEL_KEY_MAP: Record<OcrProviderKey, string> = {
  siliconflow: 'model_siliconflow',
  kimi: 'model_kimi',
  minimax: 'model_minimax',
  zhipu: 'model_zhipu',
  dashscope: 'model_dashscope',
  openrouter: 'model_openrouter'
};

const historyKey = (p: OcrProviderKey) => `history_models_${p}`;
const hiddenKey = (p: OcrProviderKey) => `hidden_models_${p}`;

const getJSON = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const setJSON = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const initStorage = () => {
  const current = Number(localStorage.getItem(VERSION_KEY) || '0');
  if (!current || current < STORAGE_VERSION) {
    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  }
};

initStorage();

export const getProvider = (): OcrProviderKey | null => {
  return (localStorage.getItem(PROVIDER_KEY) as OcrProviderKey) || null;
};

export const setProvider = (p: OcrProviderKey) => {
  localStorage.setItem(PROVIDER_KEY, p);
};

export const getApiKey = (p: OcrProviderKey): string => {
  return localStorage.getItem(API_KEY_MAP[p]) || '';
};

export const setApiKey = (p: OcrProviderKey, value: string) => {
  localStorage.setItem(API_KEY_MAP[p], value);
};

export const getModel = (p: OcrProviderKey): string => {
  return localStorage.getItem(MODEL_KEY_MAP[p]) || '';
};

export const setModel = (p: OcrProviderKey, value: string) => {
  localStorage.setItem(MODEL_KEY_MAP[p], value);
};

export const getHistoryModels = (p: OcrProviderKey): string[] => getJSON<string[]>(historyKey(p), []);

export const saveHistoryModels = (p: OcrProviderKey, list: string[]) => setJSON(historyKey(p), list);

export const addHistoryModel = (p: OcrProviderKey, model: string, max = 20) => {
  if (!model) return;
  const list = getHistoryModels(p).filter(m => m !== model);
  list.unshift(model);
  saveHistoryModels(p, list.slice(0, max));
};

export const removeHistoryModel = (p: OcrProviderKey, model: string) => {
  const list = getHistoryModels(p).filter(m => m !== model);
  saveHistoryModels(p, list);
};

export const getHiddenModels = (p: OcrProviderKey): string[] => getJSON<string[]>(hiddenKey(p), []);

export const saveHiddenModels = (p: OcrProviderKey, list: string[]) => setJSON(hiddenKey(p), list);

export const hideRecommendedModel = (p: OcrProviderKey, model: string, max = 200) => {
  if (!model) return;
  const list = getHiddenModels(p);
  if (!list.includes(model)) list.unshift(model);
  saveHiddenModels(p, list.slice(0, max));
};

export const getAuditConcurrency = (): number => {
  const raw = Number(localStorage.getItem(AUDIT_CONCURRENCY_KEY) || '3');
  if (!Number.isFinite(raw)) return 3;
  return Math.max(1, Math.min(8, raw));
};

export const setAuditConcurrency = (value: number) => {
  const n = Math.max(1, Math.min(8, Number(value) || 1));
  localStorage.setItem(AUDIT_CONCURRENCY_KEY, String(n));
};

export const getUsageData = <T>(fallback: T): T => getJSON<T>(USAGE_KEY, fallback);

export const setUsageData = (data: any) => setJSON(USAGE_KEY, data);

export const getUsageBatchData = <T>(fallback: T): T => getJSON<T>(USAGE_BATCH_KEY, fallback);

export const setUsageBatchData = (data: any) => setJSON(USAGE_BATCH_KEY, data);
