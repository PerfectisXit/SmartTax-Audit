const { PORT } = require('./config');
const { createApp } = require('./app');

const startServer = () => {
  const app = createApp();
  return app.listen(PORT, () => {
    console.log(`PaddleOCR Server running on http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
