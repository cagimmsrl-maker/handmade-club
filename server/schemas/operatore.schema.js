const { z } = require('zod');

const loginSchema = z.object({
  sedeId: z.number().int().positive(),
  pin: z.string().trim().min(3).max(20),
});

const scansioneSchema = z.object({
  qrToken: z.string().min(1),
});

module.exports = { loginSchema, scansioneSchema };
