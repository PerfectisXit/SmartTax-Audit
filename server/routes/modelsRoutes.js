const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { AppError } = require('../errors');

const modelPayloadSchema = z.object({
  model: z.string().trim().min(1, 'model is required'),
});

const registerModelsRoutes = ({ modelsRepo }) => {
  const router = express.Router();

  router.get('/:provider', (req, res) => {
    const provider = req.params.provider;
    if (!modelsRepo.isValidProvider(provider)) throw new AppError('Invalid provider', 400);
    return res.json({ provider, models: modelsRepo.getModels(provider) });
  });

  router.post('/:provider', validate(modelPayloadSchema), (req, res) => {
    const provider = req.params.provider;
    if (!modelsRepo.isValidProvider(provider)) throw new AppError('Invalid provider', 400);
    const { model } = req.body;
    const models = modelsRepo.addModel(provider, model);
    return res.json({ provider, models });
  });

  router.delete('/:provider', validate(modelPayloadSchema), (req, res) => {
    const provider = req.params.provider;
    if (!modelsRepo.isValidProvider(provider)) throw new AppError('Invalid provider', 400);
    const { model } = req.body;
    const models = modelsRepo.removeModel(provider, model);
    return res.json({ provider, models });
  });

  return router;
};

module.exports = { registerModelsRoutes };
