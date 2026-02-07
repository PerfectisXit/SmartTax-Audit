const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let serverProcess;

const isDev = !!process.env.ELECTRON_DEV;
const devUrl = process.env.ELECTRON_DEV_URL || 'http://localhost:3000';
const prodUrl = 'http://localhost:3001';

const startServer = () => {
  const serverPath = path.join(app.getAppPath(), 'server.js');
  const dataDir = path.join(app.getPath('userData'), 'data');
  const env = {
    ...process.env,
    PORT: '3001',
    APP_DATA_DIR: dataDir,
    SERVE_DIST: isDev ? '0' : '1'
  };
  serverProcess = spawn(process.execPath, [serverPath], { env, stdio: 'inherit' });
  serverProcess.on('close', (code) => {
    console.log(`[server] exited with code ${code}`);
  });
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#f5f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const targetUrl = isDev ? devUrl : prodUrl;
  const tryLoad = () => {
    win.loadURL(targetUrl).catch(() => {
      setTimeout(tryLoad, 500);
    });
  };
  tryLoad();
};

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
