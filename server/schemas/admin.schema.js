const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const livelloSchema = z.object({
  nome: z.string().trim().min(1).max(50),
  sogliaVisite: z.number().int().min(0),
  scontoPercentuale: z.number().min(0).max(100),
  colore: z.string().trim().max(20).optional().nullable(),
  ordine: z.number().int(),
  attivo: z.boolean().default(true),
});

const convenzioneSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  codiceAdesione: z.string().trim().min(1).max(50),
  scontoPercentuale: z.number().min(0).max(100),
  note: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  attiva: z.boolean().default(true),
});

const sedeSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  indirizzo: z.string().trim().max(300).optional().nullable().or(z.literal('')),
  pinOperatore: z.string().trim().min(3).max(20),
  attiva: z.boolean().default(true),
});

const parametriSchema = z.object({
  finestraVisiteGiorni: z.number().int().min(1).max(3650),
});

module.exports = { loginSchema, livelloSchema, convenzioneSchema, sedeSchema, parametriSchema };
