const { z } = require('zod');

const loginSchema = z.object({
  sedeId: z.number().int().positive(),
  pin: z.string().trim().min(3).max(20),
});

// Dal QR statico il campo è `codice`; `qrToken` resta per le app non aggiornate.
const scansioneSchema = z
  .object({
    codice: z.string().trim().min(1).max(500).optional(),
    qrToken: z.string().trim().min(1).max(500).optional(),
  })
  .refine((d) => d.codice || d.qrToken, { message: 'codice obbligatorio', path: ['codice'] });

const usaPromozioneSchema = z.object({
  codice: z.string().trim().min(1).max(500),
});

module.exports = { loginSchema, scansioneSchema, usaPromozioneSchema };
