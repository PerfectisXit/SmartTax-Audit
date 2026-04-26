const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT } = require('./config');
const { registerOcrRoutes } = require('./routes/ocrRoutes');
const { registerModelsRoutes } = require('./routes/modelsRoutes');
const { registerOpenrouterRoutes } = require('./routes/openrouterRoutes');
const { registerChatgptWebRoutes } = require('./routes/chatgptWebRoutes');
const modelsRepo = require('./repo/modelsRepo');
const { createOpenrouterService } = require('./services/openrouterService');
const { createChatgptWebService } = require('./services/chatgptWebService');
const { createRateLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./errors');

const createApp = (deps = {}) => {
  const app = express();
  const openrouterService = deps.openrouterService || createOpenrouterService();
  const chatgptWebService = deps.chatgptWebService || createChatgptWebService();
  const repo = deps.modelsRepo || modelsRepo;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use('/api', createRateLimiter({ windowMs: 60 * 1000, maxRequests: 180 }));

  if (process.env.SERVE_DIST === '1') {
    const distDir = path.join(PROJECT_ROOT, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
    }
  }

  app.use('/api/ocr', registerOcrRoutes());
  app.use('/api/models', registerModelsRoutes({ modelsRepo: repo }));
  app.use('/api/openrouter', registerOpenrouterRoutes({ openrouterService }));
  app.use('/api/chatgpt-web', registerChatgptWebRoutes({ chatgptWebService }));

  if (process.env.SERVE_DIST === '1') {
    const distDir = path.join(PROJECT_ROOT, 'dist');
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      return res.status(404).send('dist/index.html not found');
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
