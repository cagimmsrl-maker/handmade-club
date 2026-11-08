const { z } = require('zod');

const profiloSchema = z.object({
  nome: z.string().trim().min(1, 'Il nome è obbligatorio').max(100),
  cognome: z.string().trim().min(1, 'Il cognome è obbligatorio').max(100),
  email: z.string().trim().email('Email non valida').max(100).optional().nullable().or(z.literal('')),
  dataNascita: z.string().date().optional().nullable().or(z.literal('')),
});

const convenzioneSchema = z.object({
  codice: z.string().trim().min(1).max(50),
});

// Iscrizione Web Push: è l'oggetto PushSubscription.toJSON() del browser.
const pushIscrizioneSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(100),
  }),
});

const pushDisiscrizioneSchema = z.object({
  endpoint: z.string().url().max(1000),
});

module.exports = { profiloSchema, convenzioneSchema, pushIscrizioneSchema, pushDisiscrizioneSchema };
