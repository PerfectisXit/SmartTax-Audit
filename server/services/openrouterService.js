const { OPENROUTER_MODELS_URL, OPENROUTER_URL } = require('../config');
const { getJson, postJson } = require('./httpClient');

const isFreePricing = (pricing) => {
  if (!pricing || typeof pricing !== 'object') return false;
  const values = Object.values(pricing);
  if (values.length === 0) return false;
  return values.every((v) => v === '0' || v === 0 || v === null);
};

const createOpenrouterService = () => {
  const cache = { ts: 0, models: [] };

  const fetchFreeVisionModels = async () => {
    const now = Date.now();
    const ttlMs = 10 * 60 * 1000;
    if (cache.models.length > 0 && now - cache.ts < ttlMs) {
      return { updatedAt: cache.ts, count: cache.models.length, models: cache.models };
    }

    const headers = {};
    if (process.env.OPENROUTER_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    }

    const response = await getJson(OPENROUTER_MODELS_URL, headers);
    if (response.status < 200 || response.status >= 300) {
      const err = new Error(response.data || 'OpenRouter models request failed');
      err.status = response.status;
      throw err;
    }

    let data;
    try {
      data = JSON.parse(response.data);
    } catch (e) {
      const err = new Error('Invalid OpenRouter models response');
      err.status = 502;
      err.raw = response.data;
      throw err;
    }

    const list = Array.isArray(data?.data) ? data.data : [];
    const models = list
      .filter((m) => Array.isArray(m?.architecture?.input_modalities) && m.architecture.input_modalities.includes('image'))
      .filter((m) => isFreePricing(m?.pricing))
      .map((m) => m.id)
      .filter(Boolean)
      .sort();

    cache.ts = now;
    cache.models = models;
    return { updatedAt: cache.ts, count: models.length, models };
  };

  const proxyChatCompletion = async ({ model, messages, max_tokens, temperature, response_format, top_p, stream, referer }) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      const err = new Error('Missing OpenRouter API key on server');
      err.status = 400;
      throw err;
    }

    const body = JSON.stringify({
      model,
      messages,
      max_tokens,
      temperature,
      response_format,
      top_p,
      stream,
    });

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Authorization: `Bearer ${key}`,
      'X-Title': 'smarttax-audit-expert',
    };
    if (referer) headers['HTTP-Referer'] = String(referer);

    const response = await postJson(OPENROUTER_URL, headers, body);
    if (response.status < 200 || response.status >= 300) {
      const err = new Error(response.data || 'OpenRouter request failed');
      err.status = response.status;
      throw err;
    }

    try {
      return JSON.parse(response.data);
    } catch (e) {
      const err = new Error('Invalid OpenRouter response');
      err.status = 502;
      err.raw = response.data;
      throw err;
    }
  };

  return { fetchFreeVisionModels, proxyChatCompletion };
};

module.exports = {
  createOpenrouterService,
};
