const fs = require('fs');
const { DATA_DIR, MODELS_FILE } = require('../config');

const PROVIDERS = ['siliconflow', 'kimi', 'minimax', 'zhipu', 'dashscope', 'openrouter'];

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

const isValidProvider = (provider) => PROVIDERS.includes(provider);

const getModels = (provider) => {
  const data = readModels();
  return Array.isArray(data.providers?.[provider]) ? data.providers[provider] : [];
};

const addModel = (provider, model) => {
  const data = readModels();
  const list = Array.isArray(data.providers?.[provider]) ? data.providers[provider] : [];
  const next = [model, ...list.filter((m) => m !== model)].slice(0, 50);
  data.providers = data.providers || {};
  data.providers[provider] = next;
  writeModels(data);
  return next;
};

const removeModel = (provider, model) => {
  const data = readModels();
  const list = Array.isArray(data.providers?.[provider]) ? data.providers[provider] : [];
  const next = list.filter((m) => m !== model);
  data.providers = data.providers || {};
  data.providers[provider] = next;
  writeModels(data);
  return next;
};

module.exports = {
  ensureDataFile,
  isValidProvider,
  getModels,
  addModel,
  removeModel,
};
