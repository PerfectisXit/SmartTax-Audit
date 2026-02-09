import { getUsageBatchData, getUsageData, setUsageBatchData, setUsageData } from './storageService';

export type UsageBucket = {
  prompt: number;
  completion: number;
  total: number;
};

export type UsageData = {
  total: UsageBucket;
  monthly: Record<string, UsageBucket>;
  models: Record<string, { total: UsageBucket; monthly: Record<string, UsageBucket> }>;
  providers: Record<string, { total: UsageBucket; monthly: Record<string, UsageBucket>; models: Record<string, { total: UsageBucket; monthly: Record<string, UsageBucket> }> }>;
};

const emptyBucket = (): UsageBucket => ({ prompt: 0, completion: 0, total: 0 });

const addToBucket = (bucket: UsageBucket, prompt: number, completion: number) => {
  bucket.prompt += prompt;
  bucket.completion += completion;
  bucket.total += prompt + completion;
};

const getMonthKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const loadUsage = (): UsageData => {
  const data = getUsageData<any>({ total: emptyBucket(), monthly: {}, models: {}, providers: {} });
  if (!data || typeof data !== 'object') return { total: emptyBucket(), monthly: {}, models: {}, providers: {} };
  return {
    total: data.total || emptyBucket(),
    monthly: data.monthly || {},
    models: data.models || {},
    providers: data.providers || {}
  };
};

const saveUsage = (data: UsageData) => {
  setUsageData(data);
};

export const recordUsage = (input: { model: string; provider: string; promptTokens: number; completionTokens: number }) => {
  const { model, provider, promptTokens, completionTokens } = input;
  if (!model) return;
  if (!provider) return;
  if (!promptTokens && !completionTokens) return;

  const data = loadUsage();
  const monthKey = getMonthKey();

  if (!data.total) data.total = emptyBucket();
  addToBucket(data.total, promptTokens, completionTokens);

  if (!data.monthly[monthKey]) data.monthly[monthKey] = emptyBucket();
  addToBucket(data.monthly[monthKey], promptTokens, completionTokens);

  if (!data.models[model]) data.models[model] = { total: emptyBucket(), monthly: {} };
  addToBucket(data.models[model].total, promptTokens, completionTokens);
  if (!data.models[model].monthly[monthKey]) data.models[model].monthly[monthKey] = emptyBucket();
  addToBucket(data.models[model].monthly[monthKey], promptTokens, completionTokens);

  if (!data.providers[provider]) data.providers[provider] = { total: emptyBucket(), monthly: {}, models: {} };
  addToBucket(data.providers[provider].total, promptTokens, completionTokens);
  if (!data.providers[provider].monthly[monthKey]) data.providers[provider].monthly[monthKey] = emptyBucket();
  addToBucket(data.providers[provider].monthly[monthKey], promptTokens, completionTokens);
  if (!data.providers[provider].models[model]) data.providers[provider].models[model] = { total: emptyBucket(), monthly: {} };
  addToBucket(data.providers[provider].models[model].total, promptTokens, completionTokens);
  if (!data.providers[provider].models[model].monthly[monthKey]) data.providers[provider].models[model].monthly[monthKey] = emptyBucket();
  addToBucket(data.providers[provider].models[model].monthly[monthKey], promptTokens, completionTokens);

  saveUsage(data);

  // Update batch usage if exists
  const batch = getBatchUsage();
  if (batch.active) {
    addToBucket(batch.total, promptTokens, completionTokens);
    if (!batch.models[model]) batch.models[model] = emptyBucket();
    addToBucket(batch.models[model], promptTokens, completionTokens);
    saveBatchUsage(batch);
  }
};

export const getUsage = (): UsageData => loadUsage();

export const resetUsage = () => {
  saveUsage({ total: emptyBucket(), monthly: {}, models: {}, providers: {} });
};

export type BatchUsage = {
  active: boolean;
  label: string;
  total: UsageBucket;
  models: Record<string, UsageBucket>;
};

const loadBatchUsage = (): BatchUsage => {
  const data = getUsageBatchData<any>({ active: false, label: '', total: emptyBucket(), models: {} });
  if (!data || typeof data !== 'object') return { active: false, label: '', total: emptyBucket(), models: {} };
  return {
    active: !!data.active,
    label: data.label || '',
    total: data.total || emptyBucket(),
    models: data.models || {}
  };
};

const saveBatchUsage = (data: BatchUsage) => {
  setUsageBatchData(data);
};

export const startBatchUsage = (label: string) => {
  saveBatchUsage({ active: true, label, total: emptyBucket(), models: {} });
};

export const endBatchUsage = () => {
  const data = loadBatchUsage();
  data.active = false;
  saveBatchUsage(data);
};

export const getBatchUsage = (): BatchUsage => loadBatchUsage();
