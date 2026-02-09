export const OCR_PROVIDERS = ['siliconflow', 'kimi', 'minimax', 'zhipu', 'dashscope', 'openrouter'] as const;

export type OcrProvider = (typeof OCR_PROVIDERS)[number];

export const DEFAULT_MODEL_BY_PROVIDER: Record<OcrProvider, string> = {
  siliconflow: 'Qwen/Qwen3-VL-32B-Instruct',
  kimi: 'moonshot-v1-8k',
  minimax: 'abab6.5s-chat',
  zhipu: 'glm-4v',
  dashscope: 'qwen-vl-max',
  openrouter: 'openrouter/free'
};

export const PROVIDER_DISPLAY_NAME: Record<OcrProvider, string> = {
  siliconflow: 'SiliconFlow',
  kimi: 'Kimi (Moonshot)',
  minimax: 'MiniMax',
  zhipu: 'Zhipu AI',
  dashscope: 'DashScope (Aliyun)',
  openrouter: 'OpenRouter'
};
