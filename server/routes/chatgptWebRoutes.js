const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');

const attachmentSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  mimeType: z.string().trim().min(1, 'mimeType is required'),
  base64: z.string().trim().min(1, 'base64 is required'),
});

const runPayloadSchema = z.object({
  taskType: z.enum(['invoice', 'classifier', 'dining_application']),
  prompt: z.string().trim().min(1, 'prompt is required'),
  model: z.string().trim().optional(),
  attachments: z.array(attachmentSchema).default([]),
});

const registerChatgptWebRoutes = ({ chatgptWebService }) => {
  const router = express.Router();

  router.get('/status', asyncHandler(async (_req, res) => {
    const data = await chatgptWebService.getStatus();
    return res.json(data);
  }));

  router.post('/session/open', asyncHandler(async (_req, res) => {
    const data = await chatgptWebService.openSession();
    return res.json(data);
  }));

  router.post('/run', validate(runPayloadSchema), asyncHandler(async (req, res) => {
    const { prompt, attachments } = req.body;
    const data = await chatgptWebService.runTask({ prompt, attachments });
    return res.json(data);
  }));

  return router;
};

module.exports = { registerChatgptWebRoutes };
