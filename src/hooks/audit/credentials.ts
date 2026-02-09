import { DEFAULT_MODEL_BY_PROVIDER, type OcrProvider } from '../../domain/provider';
import { getApiKey, getModel } from '../../services/storageService';

export type AuditCredentials = {
  apiKey: string;
  modelName: string;
  err: string | null;
};

export const getAuditCredentials = (provider: OcrProvider): AuditCredentials => {
  const apiKey = getApiKey(provider);
  const modelName = getModel(provider) || DEFAULT_MODEL_BY_PROVIDER[provider];

  if (!apiKey && provider !== 'openrouter') {
    return { apiKey: '', modelName: '', err: `请先在设置中配置 ${provider.toUpperCase()} API Key` };
  }
  if (!modelName) {
    return { apiKey: '', modelName: '', err: `请在设置中输入 ${provider.toUpperCase()} 的模型名称` };
  }

  return { apiKey, modelName, err: null };
};
