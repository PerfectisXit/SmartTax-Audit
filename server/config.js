const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(PROJECT_ROOT, 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const OCR_MAX_CONCURRENCY = Math.max(1, Number(process.env.OCR_MAX_CONCURRENCY || 2));
const OCR_TIMEOUT_MS = Math.max(5_000, Number(process.env.OCR_TIMEOUT_MS || 60_000));
const OCR_PYTHON_BIN = process.env.OCR_PYTHON_BIN || 'python';
const OCR_SCRIPT_PATH = path.join(PROJECT_ROOT, 'server', 'scripts', 'ocr_script.py');

module.exports = {
  PORT,
  OPENROUTER_URL,
  OPENROUTER_MODELS_URL,
  PROJECT_ROOT,
  DATA_DIR,
  MODELS_FILE,
  OCR_MAX_CONCURRENCY,
  OCR_TIMEOUT_MS,
  OCR_PYTHON_BIN,
  OCR_SCRIPT_PATH,
};
