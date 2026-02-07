const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(__dirname, 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

if (process.env.SERVE_DIST === '1') {
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
  }
}

const ensureDataFile = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MODELS_FILE)) {
    fs.writeFileSync(MODELS_FILE, JSON.stringify({ providers: {} }, null, 2));
  }
};

const readModels = () => {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(MODELS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : { providers: {} };
  } catch (e) {
    console.warn('Failed to read models file, reinitializing', e);
    return { providers: {} };
  }
};

const writeModels = (data) => {
  ensureDataFile();
  const tmpFile = `${MODELS_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  fs.renameSync(tmpFile, MODELS_FILE);
};

const isValidProvider = (p) => {
  return ['siliconflow', 'kimi', 'minimax', 'zhipu', 'dashscope', 'openrouter'].includes(p);
};

const postJson = (url, headers, body) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk.toString();
      });
      resp.on('end', () => {
        resolve({ status: resp.statusCode || 0, data, headers: resp.headers });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

const getJson = (url, headers) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk.toString();
      });
      resp.on('end', () => {
        resolve({ status: resp.statusCode || 0, data, headers: resp.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });

const openrouterCache = {
  ts: 0,
  models: []
};

const isFreePricing = (pricing) => {
  if (!pricing || typeof pricing !== 'object') return false;
  const values = Object.values(pricing);
  if (values.length === 0) return false;
  return values.every((v) => v === '0' || v === 0 || v === null);
};

app.post('/api/ocr', (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  // Save base64 to temporary file
  const buffer = Buffer.from(imageBase64, 'base64');
  const tempFilePath = path.join(__dirname, `temp_${Date.now()}.png`);
  
  fs.writeFileSync(tempFilePath, buffer);

  // Run Python script
  const pythonProcess = spawn('python3', ['ocr_script.py', tempFilePath]);
  // Note: Use 'python' instead of 'python3' on Windows if needed

  let dataString = '';
  let errorString = '';

  pythonProcess.stdout.on('data', (data) => {
    dataString += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    errorString += data.toString();
  });

  pythonProcess.on('close', (code) => {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    if (code !== 0) {
      console.error('OCR Error:', errorString);
      return res.status(500).json({ error: 'OCR processing failed' });
    }

    try {
      const result = JSON.parse(dataString);
      res.json(result);
    } catch (e) {
      console.error('Parse Error:', e, dataString);
      res.status(500).json({ error: 'Failed to parse OCR output' });
    }
  });
});

app.get('/api/models/:provider', (req, res) => {
  const provider = req.params.provider;
  if (!isValidProvider(provider)) return res.status(400).json({ error: 'Invalid provider' });
  const data = readModels();
  const list = Array.isArray(data.providers?.[provider]) ? data.providers[provider] : [];
  return res.json({ provider, models: list });
});

app.post('/api/models/:provider', (req, res) => {
  const provider = req.params.provider;
  if (!isValidProvider(provider)) return res.status(400).json({ error: 'Invalid provider' });
  const model = String((req.body && req.body.model) || '').trim();
  if (!model) return res.status(400).json({ error: 'model is required' });

  const data = readModels();
  const list = Array.isArray(data.providers?.[provider]) ? data.providers[provider] : [];
  const next = [model, ...list.filter((m) => m !== model)].slice(0, 50);
  data.providers = data.providers || {};
  data.providers[provider] = next;
  writeModels(data);
  return res.json({ provider, models: next });
});

app.delete('/api/models/:provider', (req, res) => {
  const provider = req.params.provider;
  if (!isValidProvider(provider)) return res.status(400).json({ error: 'Invalid provider' });
  const model = String((req.body && req.body.model) || '').trim();
  if (!model) return res.status(400).json({ error: 'model is required' });
  const data = readModels();
  const list = Array.isArray(data.providers?.[provider]) ? data.providers[provider] : [];
  const next = list.filter((m) => m !== model);
  data.providers = data.providers || {};
  data.providers[provider] = next;
  writeModels(data);
  return res.json({ provider, models: next });
});

if (process.env.SERVE_DIST === '1') {
  const distDir = path.join(__dirname, 'dist');
  app.get('*', (req, res) => {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.status(404).send('dist/index.html not found');
  });
}

app.get('/api/openrouter/models', async (req, res) => {
  const now = Date.now();
  const ttlMs = 10 * 60 * 1000;
  if (openrouterCache.models.length > 0 && now - openrouterCache.ts < ttlMs) {
    return res.json({
      updatedAt: openrouterCache.ts,
      count: openrouterCache.models.length,
      models: openrouterCache.models
    });
  }

  const headers = {};
  if (process.env.OPENROUTER_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  try {
    const response = await getJson(OPENROUTER_MODELS_URL, headers);
    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status).send(response.data || 'OpenRouter models request failed');
    }

    let data;
    try {
      data = JSON.parse(response.data);
    } catch (e) {
      return res.status(502).json({ error: 'Invalid OpenRouter models response', raw: response.data });
    }

    const list = Array.isArray(data?.data) ? data.data : [];
    const models = list
      .filter((m) => Array.isArray(m?.architecture?.input_modalities) && m.architecture.input_modalities.includes('image'))
      .filter((m) => isFreePricing(m?.pricing))
      .map((m) => m.id)
      .filter(Boolean)
      .sort();

    openrouterCache.ts = now;
    openrouterCache.models = models;

    return res.json({
      updatedAt: openrouterCache.ts,
      count: models.length,
      models
    });
  } catch (e) {
    console.error('OpenRouter Models Error:', e);
    return res.status(500).json({ error: 'OpenRouter models request failed' });
  }
});

app.post('/api/openrouter', async (req, res) => {
  const { model, messages, max_tokens, temperature, response_format, top_p, stream } = req.body || {};
  if (!model || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'model and messages are required' });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'Missing OpenRouter API key on server' });
  }

  const payload = {
    model,
    messages,
    max_tokens,
    temperature,
    response_format,
    top_p,
    stream
  };

  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Authorization': `Bearer ${key}`
  };

  const referer = req.headers.origin || req.headers.referer;
  if (referer) {
    headers['HTTP-Referer'] = String(referer);
  }
  headers['X-Title'] = 'smarttax-audit-expert';

  try {
    const response = await postJson(OPENROUTER_URL, headers, body);
    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status).send(response.data || 'OpenRouter request failed');
    }
    try {
      return res.json(JSON.parse(response.data));
    } catch (e) {
      return res.status(502).json({ error: 'Invalid OpenRouter response', raw: response.data });
    }
  } catch (e) {
    console.error('OpenRouter Error:', e);
    return res.status(500).json({ error: 'OpenRouter request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`PaddleOCR Server running on http://localhost:${PORT}`);
});
