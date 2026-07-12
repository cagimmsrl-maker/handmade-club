const { z } = require('zod');

const telefonoSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{8,16}$/, 'Numero di telefono non valido');

const richiediOtpSchema = z.object({
  telefono: telefonoSchema,
});

const verificaOtpSchema = z.object({
  telefono: telefonoSchema,
  codice: z.string().regex(/^\d{6}$/, 'Codice OTP non valido'),
});

const completaProfiloSchema = z.object({
  tokenRegistrazione: z.string().min(1),
  nome: z.string().trim().min(1, 'Il nome è obbligatorio').max(100),
  cognome: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Email non valida').max(200).optional().nullable().or(z.literal('')),
  dataNascita: z.string().date().optional().nullable().or(z.literal('')),
  consensoMarketing: z.boolean().default(false),
});

module.exports = { richiediOtpSchema, verificaOtpSchema, completaProfiloSchema };
