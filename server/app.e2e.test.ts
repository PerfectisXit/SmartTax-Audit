// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: any;
let tmpDir: string;

describe('server e2e smoke', () => {
  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smarttax-app-data-'));
    process.env.APP_DATA_DIR = tmpDir;
    const mod = await import('./app.js');
    app = mod.createApp();
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 400 for invalid provider on models endpoint', async () => {
    const res = await request(app).get('/api/models/not-a-provider');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid provider');
  });

  it('supports add/get/remove model history', async () => {
    const addRes = await request(app)
      .post('/api/models/siliconflow')
      .send({ model: 'Qwen/Test-Model' });
    expect(addRes.status).toBe(200);
    expect(addRes.body.models[0]).toBe('Qwen/Test-Model');

    const getRes = await request(app).get('/api/models/siliconflow');
    expect(getRes.status).toBe(200);
    expect(getRes.body.models).toContain('Qwen/Test-Model');

    const delRes = await request(app)
      .delete('/api/models/siliconflow')
      .send({ model: 'Qwen/Test-Model' });
    expect(delRes.status).toBe(200);
    expect(delRes.body.models).not.toContain('Qwen/Test-Model');
  });

  it('validates openrouter payload', async () => {
    const res = await request(app)
      .post('/api/openrouter')
      .send({ model: 'openrouter/free' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request payload');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('validates ocr payload', async () => {
    const res = await request(app)
      .post('/api/ocr')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request payload');
  });

  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/not-found');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
