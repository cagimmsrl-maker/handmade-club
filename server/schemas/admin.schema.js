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

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida');
const oraHm = z.string().regex(/^\d{2}:\d{2}$/, 'Ora non valida');

const promozioneSchema = z
  .object({
    titolo: z.string().trim().min(1).max(120),
    descrizione: z.string().trim().max(1000).optional().nullable().or(z.literal('')),
    tipo: z.enum(['sconto_percentuale', 'prezzo_fisso', 'omaggio', 'messaggio']),
    valore: z.number().min(0).max(100000).optional().nullable(),
    prodotto: z.string().trim().max(200).optional().nullable().or(z.literal('')),
    validoDal: dataIso,
    validoAl: dataIso,
    oraInizio: oraHm.optional().nullable().or(z.literal('')),
    oraFine: oraHm.optional().nullable().or(z.literal('')),
    giorniSettimana: z.array(z.number().int().min(0).max(6)).optional().nullable(),
    targetLivelloId: z.number().int().positive().optional().nullable(),
    targetSedeId: z.number().int().positive().optional().nullable(),
    usiPerCliente: z.number().int().positive().optional().nullable(),
  })
  .refine((d) => d.validoAl >= d.validoDal, { message: 'La fine deve essere dopo l\'inizio', path: ['validoAl'] })
  .refine((d) => !!d.oraInizio === !!d.oraFine, { message: 'Indica sia ora di inizio sia di fine', path: ['oraFine'] })
  .refine((d) => d.tipo !== 'sconto_percentuale' || (d.valore != null && d.valore > 0 && d.valore <= 100), { message: 'Sconto % tra 1 e 100', path: ['valore'] })
  .refine((d) => d.tipo !== 'prezzo_fisso' || (d.valore != null && d.valore > 0 && d.prodotto), { message: 'Prezzo fisso: servono prodotto e prezzo', path: ['valore'] })
  .refine((d) => d.tipo !== 'omaggio' || !!d.prodotto, { message: 'Omaggio: indica il prodotto', path: ['prodotto'] });

module.exports = { loginSchema, livelloSchema, convenzioneSchema, sedeSchema, parametriSchema, promozioneSchema };
