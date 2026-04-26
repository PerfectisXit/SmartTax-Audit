import { recordUsage } from './usageService';
import type { OcrProvider } from '../domain/provider';

export type ProviderKey = OcrProvider;
export type ChatgptTaskType = 'invoice' | 'classifier' | 'dining_application';

const SILICON_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const MOONSHOT_FILE_URL = 'https://api.moonshot.cn/v1/files';
const MOONSHOT_CHAT_URL = 'https://api.moonshot.cn/v1/chat/completions';
const MINIMAX_URL = 'https://api.minimax.chat/v1/chat/completions';
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const OPENROUTER_PROXY_URL = '/api/openrouter';
const CHATGPT_WEB_RUN_URL = '/api/chatgpt-web/run';

let chatgptQueue: Promise<void> = Promise.resolve();

const sanitizeApiKey = (key: string) => {
  if (!key) return '';
  return key.replace(/[^\x20-\x7E]/g, '').trim();
};

const callOpenAICompatible = async (
  url: string,
  base64: string,
  apiKey: string,
  model: string,
  provider: ProviderKey,
  systemPrompt: string
) => {
  const cleanKey = sanitizeApiKey(apiKey);
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }]
      }
    ],
    max_tokens: 1024,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  let lastError: any;
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cleanKey}`, 'Content-Type': 'application/json' },
        body
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const data = await response.json();
      if (data?.usage?.prompt_tokens || data?.usage?.completion_tokens) {
        recordUsage({
          model,
          provider,
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0
        });
      }
      return data;
    } catch (e: any) {
      console.warn(`${provider} call failed (attempt ${i + 1}/3):`, e);
      lastError = e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`${provider} Error: ${lastError?.message || 'Failed to fetch - Network Limit or Timeout'}`);
};

const callOpenRouterProxy = async (base64: string, model: string, systemPrompt: string) => {
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }]
      }
    ],
    max_tokens: 1024,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  let lastError: any;
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(OPENROUTER_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const data = await response.json();
      if (data?.usage?.prompt_tokens || data?.usage?.completion_tokens) {
        recordUsage({
          model,
          provider: 'openrouter',
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0
        });
      }
      return data;
    } catch (e: any) {
      console.warn(`openrouter call failed (attempt ${i + 1}/3):`, e);
      lastError = e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`openrouter Error: ${lastError?.message || 'Failed to fetch - Network Limit or Timeout'}`);
};

const withStrictJsonOutput = (systemPrompt: string) => {
  return `${systemPrompt}

必须仅输出一个 \`\`\`json ... \`\`\` 代码块，不要输出任何解释文字。JSON 字段名必须与模板完全一致。`;
};

const enqueueChatgptTask = async <T>(task: () => Promise<T>) => {
  const run = chatgptQueue.then(task);
  chatgptQueue = run.then(() => undefined, () => undefined);
  return run;
};

const callChatgptWebProxy = async (
  base64: string,
  model: string,
  systemPrompt: string,
  taskType: ChatgptTaskType
) => {
  const attachment = {
    name: 'upload.jpg',
    mimeType: 'image/jpeg',
    base64
  };

  return enqueueChatgptTask(async () => {
    const response = await fetch(CHATGPT_WEB_RUN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType,
        prompt: withStrictJsonOutput(systemPrompt),
        model,
        attachments: [attachment]
      })
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data?.ok || !data?.content) {
      const code = data?.code ? ` [${data.code}]` : '';
      const message = data?.error || data?.message || `HTTP ${response.status}`;
      throw new Error(`chatgpt_web Error${code}: ${message}`);
    }

    return {
      choices: [
        {
          message: {
            content: String(data.content)
          }
        }
      ]
    };
  });
};

const callKimi = async (file: File, apiKey: string, model: string, systemPrompt: string) => {
  const cleanKey = sanitizeApiKey(apiKey);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'file-extract');

  const uploadRes = await fetch(MOONSHOT_FILE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cleanKey}` },
    body: formData
  });

  if (!uploadRes.ok) throw new Error(`Kimi Upload Failed: ${await uploadRes.text()}`);
  const uploadData = await uploadRes.json();
  const fileId = uploadData.id;

  const chatRes = await fetch(MOONSHOT_CHAT_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cleanKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `file:${fileId}; Please analyze this file.` }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!chatRes.ok) throw new Error(`Kimi Chat Failed: ${await chatRes.text()}`);
  const data = await chatRes.json();
  if (data?.usage?.prompt_tokens || data?.usage?.completion_tokens) {
    recordUsage({
      model,
      provider: 'kimi',
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0
    });
  }
  return data;
};

export const sendVisionRequest = async (input: {
  provider: ProviderKey;
  file?: File;
  base64?: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  taskType?: ChatgptTaskType;
}) => {
  const { provider, file, base64, apiKey, model, systemPrompt, taskType } = input;
  if (provider === 'kimi') {
    if (!file) throw new Error('File object required for Kimi');
    return callKimi(file, apiKey, model, systemPrompt);
  }
  if (!base64) throw new Error('Image content missing');
  if (provider === 'chatgpt_web') {
    return callChatgptWebProxy(base64, model, systemPrompt, taskType || 'invoice');
  }
  if (provider === 'openrouter') {
    return callOpenRouterProxy(base64, model, systemPrompt);
  }

  let url = SILICON_URL;
  if (provider === 'minimax') url = MINIMAX_URL;
  else if (provider === 'zhipu') url = ZHIPU_URL;
  else if (provider === 'dashscope') url = DASHSCOPE_URL;
  return callOpenAICompatible(url, base64, apiKey, model, provider, systemPrompt);
};
