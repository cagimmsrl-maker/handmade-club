const { z } = require('zod');

// Esito comunicato da TGS per un cliente. Si accettano sia i nomi in
// snake_case (quelli della nostra specifica) sia in camelCase, per non
// inciampare su una differenza di stile nella loro implementazione.
const testo = (max) => z.string().trim().max(max).optional().nullable().or(z.literal(''));

const esitoSchema = z
  .object({
    esito: z.enum(['creato', 'gia_presente', 'errore']),
    codice_cliente_tgs: testo(50), codiceClienteTgs: testo(50),
    codice_card: testo(50),        codiceCard: testo(50),
    numero_pay: testo(50),         numeroPay: testo(50),
    messaggio: testo(500),         message: testo(500),
  })
  .transform((d) => ({
    esito: d.esito,
    codiceClienteTgs: d.codice_cliente_tgs || d.codiceClienteTgs || null,
    codiceCard: d.codice_card || d.codiceCard || null,
    numeroPay: d.numero_pay || d.numeroPay || null,
    messaggio: d.messaggio || d.message || null,
  }));

module.exports = { esitoSchema };
