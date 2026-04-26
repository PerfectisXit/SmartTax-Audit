const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validate } = require('../middleware/validate');

const openrouterPayloadSchema = z.object({
  model: z.string().trim().min(1, 'model is required'),
  messages: z.array(z.any()).min(1, 'messages are required'),
  max_tokens: z.any().optional(),
  temperature: z.any().optional(),
  response_format: z.any().optional(),
  top_p: z.any().optional(),
  stream: z.any().optional(),
});

const registerOpenrouterRoutes = ({ openrouterService }) => {
  const router = express.Router();

  router.get('/models', asyncHandler(async (_req, res) => {
    const data = await openrouterService.fetchFreeVisionModels();
    return res.json(data);
  }));

  router.post('/', validate(openrouterPayloadSchema), asyncHandler(async (req, res) => {
    const { model, messages, max_tokens, temperature, response_format, top_p, stream } = req.body;
    const data = await openrouterService.proxyChatCompletion({
      model,
      messages,
      max_tokens,
      temperature,
      response_format,
      top_p,
      stream,
      referer: req.headers.origin || req.headers.referer,
    });
    return res.json(data);
  }));

  return router;
};

module.exports = { registerOpenrouterRoutes };
