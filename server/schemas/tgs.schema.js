const { z } = require('zod');

// Esito comunicato da TGS per un cliente (specifica TGS v1 del 26/10/2026).
// Nomi ufficiali in camelCase; si accettano anche quelli in snake_case
// della prima mail, per non inciampare su una differenza di stile.
const testo = (max) => z.string().trim().max(max).optional().nullable().or(z.literal(''));
const dataIso = z.string().datetime({ offset: true }).optional().nullable().or(z.literal(''));

const esitoSchema = z
  .object({
    esito: z.enum(['creato', 'gia_presente', 'errore']),
    codiceClienteTgs: testo(50), codice_cliente_tgs: testo(50),
    codiceCardTgs: testo(50),    codice_card: testo(50),
    barcodeCard: testo(50),      numero_pay: testo(50),
    messaggio: testo(500),
    elaboratoIl: dataIso,
  })
  .transform((d) => ({
    esito: d.esito,
    codiceClienteTgs: d.codiceClienteTgs || d.codice_cliente_tgs || null,
    codiceCardTgs: d.codiceCardTgs || d.codice_card || null,
    barcodeCard: d.barcodeCard || d.numero_pay || null,
    messaggio: d.messaggio || null,
    elaboratoIl: d.elaboratoIl || null,
  }));

module.exports = { esitoSchema };
