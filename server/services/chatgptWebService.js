const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const {
  DATA_DIR,
  CHATGPT_WEB_PROFILE_DIR,
  CHATGPT_WEB_URL,
  CHATGPT_WEB_TIMEOUT_MS,
} = require('../config');

const makeServiceError = (message, code, status = 500) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const createChatgptWebService = (options = {}) => {
  const profileDir = options.profileDir || CHATGPT_WEB_PROFILE_DIR || path.join(DATA_DIR, 'chatgpt-profile');
  const baseUrl = options.baseUrl || CHATGPT_WEB_URL || 'https://chatgpt.com/';
  const timeoutMs = Math.max(15_000, Number(options.timeoutMs || CHATGPT_WEB_TIMEOUT_MS || 120_000));

  let context = null;
  let busy = false;
  let lastError = null;

  const ensureContext = async () => {
    if (context) return context;
    fs.mkdirSync(profileDir, { recursive: true });
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1440, height: 960 },
    });
    context.setDefaultTimeout(15_000);
    context.on('close', () => {
      context = null;
    });
    return context;
  };

  const createTaskPage = async () => {
    const browserContext = await ensureContext();
    const page = await browserContext.newPage();
    page.setDefaultTimeout(15_000);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    return page;
  };

  const isSessionReady = async (page) => {
    const composer = page.locator('textarea, div[contenteditable="true"][role="textbox"], div.ProseMirror[contenteditable="true"]');
    if (await composer.count()) return true;

    const loginHints = page.locator('text=/Log in|Sign up|登录|注册/i');
    if (await loginHints.count()) return false;

    return false;
  };

  const findComposer = async (page) => {
    const selectors = [
      'textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"][translate="no"]',
    ];

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.count()) return locator;
    }
    throw makeServiceError('未找到 ChatGPT 输入框', 'AUTOMATION_BROKEN', 502);
  };

  const ensureFileInput = async (page) => {
    let input = page.locator('input[type="file"]').first();
    if (await input.count()) return input;

    const labels = [
      /attach/i,
      /upload/i,
      /files?/i,
      /添加照片和文件/,
      /上传/,
      /附加/,
    ];

    for (const label of labels) {
      try {
        const button = page.getByRole('button', { name: label }).first();
        if (await button.count()) {
          await button.click();
          input = page.locator('input[type="file"]').first();
          if (await input.count()) return input;
        }
      } catch {
        // Continue probing other selectors.
      }
    }

    throw makeServiceError('未找到 ChatGPT 文件上传控件', 'AUTOMATION_BROKEN', 502);
  };

  const uploadAttachments = async (page, attachments) => {
    if (!attachments?.length) return;
    const input = await ensureFileInput(page);
    await input.setInputFiles(attachments.map((item, index) => ({
      name: item.name || `upload-${index + 1}.bin`,
      mimeType: item.mimeType || 'application/octet-stream',
      buffer: Buffer.from(item.base64, 'base64'),
    })));
    await page.waitForTimeout(500);
  };

  const submitPrompt = async (page, prompt) => {
    const composer = await findComposer(page);
    await composer.click();
    const tagName = await composer.evaluate((node) => node.tagName.toLowerCase());
    if (tagName === 'textarea') {
      await composer.fill(prompt);
    } else {
      await page.keyboard.insertText(prompt);
    }

    const sendButton = page.locator('button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="发送"]').first();
    if (await sendButton.count()) {
      await sendButton.click();
      return;
    }
    await page.keyboard.press('Enter');
  };

  const readLatestAssistantText = async (page) => {
    const locators = [
      page.locator('[data-message-author-role="assistant"]').last(),
      page.locator('article').last(),
    ];

    for (const locator of locators) {
      try {
        if (await locator.count()) {
          const text = (await locator.innerText()).trim();
          if (text) return text;
        }
      } catch {
        // Try the next fallback.
      }
    }
    return '';
  };

  const waitForAssistantResponse = async (page) => {
    const deadline = Date.now() + timeoutMs;
    let stableText = '';
    let stableTicks = 0;

    while (Date.now() < deadline) {
      const stopButton = page.locator('button[aria-label*="Stop"], button:has-text("Stop"), button:has-text("停止")').first();
      const currentText = await readLatestAssistantText(page);

      if (currentText && currentText === stableText) {
        stableTicks += 1;
      } else if (currentText) {
        stableText = currentText;
        stableTicks = 0;
      }

      const stopVisible = await stopButton.count().then((count) => count > 0).catch(() => false);
      if (stableText && stableTicks >= 2 && !stopVisible) {
        return stableText;
      }
      await page.waitForTimeout(1200);
    }

    throw makeServiceError('等待 ChatGPT 响应超时', 'TIMEOUT', 504);
  };

  const getStatus = async () => {
    if (!context) {
      return {
        sessionReady: false,
        busy,
        initialized: false,
        error: lastError?.message,
        code: lastError?.code,
      };
    }

    try {
      const page = context.pages()[0] || await context.newPage();
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      return {
        sessionReady: await isSessionReady(page),
        busy,
        initialized: true,
        error: lastError?.message,
        code: lastError?.code,
      };
    } catch (error) {
      lastError = makeServiceError(error.message || 'ChatGPT 状态检测失败', 'AUTOMATION_BROKEN', 502);
      return {
        sessionReady: false,
        busy,
        initialized: Boolean(context),
        error: lastError.message,
        code: lastError.code,
      };
    }
  };

  const openSession = async () => {
    const browserContext = await ensureContext();
    const page = browserContext.pages()[0] || await browserContext.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const status = await getStatus();
    return { ...status, opened: true };
  };

  const runTask = async ({ prompt, attachments }) => {
    if (busy) {
      throw makeServiceError('ChatGPT Web 当前忙碌，请稍后重试', 'BUSY', 409);
    }

    busy = true;
    lastError = null;
    let page = null;

    try {
      page = await createTaskPage();
      const ready = await isSessionReady(page);
      if (!ready) {
        throw makeServiceError('ChatGPT 登录态失效，请先在设置中打开登录窗口完成登录', 'SESSION_REQUIRED', 428);
      }

      await uploadAttachments(page, attachments || []);
      await submitPrompt(page, prompt);
      const content = await waitForAssistantResponse(page);
      await page.close();
      page = null;
      return { ok: true, sessionReady: true, content };
    } catch (error) {
      if (page && !page.isClosed()) {
        await page.close().catch(() => undefined);
      }
      lastError = error.code ? error : makeServiceError(error.message || 'ChatGPT Web 自动化失败', 'AUTOMATION_BROKEN', 502);
      throw lastError;
    } finally {
      busy = false;
    }
  };

  return {
    getStatus,
    openSession,
    runTask,
  };
};

module.exports = {
  createChatgptWebService,
};
