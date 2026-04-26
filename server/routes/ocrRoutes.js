const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { z } = require('zod');
const {
  PROJECT_ROOT,
  OCR_MAX_CONCURRENCY,
  OCR_TIMEOUT_MS,
  OCR_PYTHON_BIN,
  OCR_SCRIPT_PATH
} = require('../config');
const { validate } = require('../middleware/validate');
const { AppError } = require('../errors');

const ocrPayloadSchema = z.object({
  imageBase64: z.string().trim().min(1, 'No image data provided')
});

let activeOcrJobs = 0;

const registerOcrRoutes = () => {
  const router = express.Router();

  router.post('/', validate(ocrPayloadSchema), (req, res, next) => {
    if (activeOcrJobs >= OCR_MAX_CONCURRENCY) {
      return next(new AppError('OCR service is busy, please retry later', 429));
    }
    activeOcrJobs += 1;

    const { imageBase64 } = req.body;

    const buffer = Buffer.from(imageBase64, 'base64');
    const tempFilePath = path.join(PROJECT_ROOT, `temp_${Date.now()}_${Math.random().toString(16).slice(2)}.png`);
    fs.writeFileSync(tempFilePath, buffer);

    const pythonProcess = spawn(OCR_PYTHON_BIN, [OCR_SCRIPT_PATH, tempFilePath], { cwd: PROJECT_ROOT });

    let dataString = '';
    let errorString = '';
    let settled = false;

    const finish = (err, payload) => {
      if (settled) return;
      settled = true;
      activeOcrJobs = Math.max(0, activeOcrJobs - 1);
      clearTimeout(timeoutHandle);
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (err) return next(err);
      return res.json(payload);
    };

    const timeoutHandle = setTimeout(() => {
      try {
        pythonProcess.kill('SIGKILL');
      } catch {
        pythonProcess.kill();
      }
      finish(new AppError('OCR processing timeout', 504));
    }, OCR_TIMEOUT_MS);

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('error', (err) => {
      finish(new AppError(`OCR process failed: ${err.message}`, 500));
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('OCR Error:', errorString);
        return finish(new AppError('OCR processing failed', 500));
      }

      try {
        const result = JSON.parse(dataString);
        return finish(null, result);
      } catch (e) {
        console.error('Parse Error:', e, dataString);
        return finish(new AppError('Failed to parse OCR output', 500));
      }
    });
  });

  return router;
};

module.exports = { registerOcrRoutes };
