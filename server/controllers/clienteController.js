const pool = require('../db/pool');
const jwtService = require('../services/jwtService');
const livelloService = require('../services/livelloService');
const promozioniService = require('../services/promozioniService');
const otpService = require('../services/otpService');
const { INFORMATIVA_VERSIONE, TITOLARE } = require('../config/privacy');

async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT c.nome, c.cognome, c.email, c.data_nascita, c.consenso_marketing_il, c.telefono, c.telefono_verificato,
              c.informativa_versione, c.consenso_servizio_il,
              l.nome AS livello_nome, l.colore AS livello_colore, l.sconto_percentuale AS livello_sconto,
              conv.nome AS convenzione_nome, conv.sconto_percentuale AS convenzione_sconto,
              t.codice AS tessera_codice, t.codice_qr AS tessera_codice_qr
       FROM clienti c
       LEFT JOIN livelli l ON l.id = c.livello_id
       LEFT JOIN convenzioni conv ON conv.id = c.convenzione_id AND conv.attiva = true
       LEFT JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
       WHERE c.id = $1 AND c.stato = 'attivo'`,
      [req.clienteId]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Cliente non trovato.' });
    const r = rows[0];

    const visite = await livelloService.contaVisiteFinestra(req.clienteId);
    const { prossimoLivello, visiteMancanti } = await livelloService.progresso(visite);
    const { rows: [{ n: promoCaricate }] } = await pool.query(
      `SELECT count(*)::int AS n FROM promozioni_clienti pc JOIN promozioni p ON p.id = pc.promozione_id
       WHERE pc.cliente_id = $1 AND p.stato = 'pubblicata' AND p.valido_al >= CURRENT_DATE`,
      [req.clienteId]
    );

    res.json({
      nome: r.nome,
      cognome: r.cognome,
      email: r.email,
      dataNascita: r.data_nascita,
      consensoMarketing: !!r.consenso_marketing_il,
      informativaVersione: r.informativa_versione,
      informativaCorrente: INFORMATIVA_VERSIONE,
      consensoServizioIl: r.consenso_servizio_il,
      telefono: r.telefono,
      telefonoVerificato: !!r.telefono_verificato,
      // codiceQr: contenuto del QR statico (vedi migrazione 003). Il
      // codice umano HC-000042 resta per il cliente e l'assistenza.
      tessera: { codice: r.tessera_codice, codiceQr: r.tessera_codice_qr },
      promoCaricate,
      livello: r.livello_nome
        ? { nome: r.livello_nome, colore: r.livello_colore, scontoPercentuale: r.livello_sconto }
        : null,
      convenzione: r.convenzione_nome
        ? { nome: r.convenzione_nome, scontoPercentuale: r.convenzione_sconto }
        : null,
      progresso: {
        visite,
        prossimoLivello: prossimoLivello ? { nome: prossimoLivello.nome, sogliaVisite: prossimoLivello.soglia_visite } : null,
        visiteMancanti,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Compatibilità: le app già installate (PWA) possono chiedere ancora il
// token rotante finché non si aggiornano. Rispondono con il codice fisso,
// che l'operatore accetta allo stesso modo.
async function qrToken(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT codice_qr FROM tessere WHERE cliente_id = $1 AND stato = 'attiva'`,
      [req.clienteId]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Tessera non trovata o non attiva.' });
    res.json({ token: rows[0].codice_qr, rotazioneSecondi: 3600, statico: true });
  } catch (err) {
    next(err);
  }
}

// Bacheca promozioni: disponibili per il cliente + quelle già caricate.
async function promozioni(req, res, next) {
  try {
    const tutte = await promozioniService.bachecaPerCliente(req.clienteId);
    res.json({
      caricate: tutte.filter(p => p.caricata),
      disponibili: tutte.filter(p => !p.caricata),
    });
  } catch (err) {
    next(err);
  }
}

async function caricaPromozione(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ errore: 'Promozione non valida.' });
    // Le promo si caricano solo con numero verificato: è il momento in cui
    // la verifica vale qualcosa per il cliente (vedi migrazione 004).
    const { rows: [c] } = await pool.query('SELECT telefono_verificato FROM clienti WHERE id = $1', [req.clienteId]);
    if (!c?.telefono_verificato)
      return res.status(403).json({ errore: 'Per caricare le promozioni verifica prima il tuo numero.', codice: 'VERIFICA_RICHIESTA' });
    const esito = await promozioniService.carica(req.clienteId, id);
    if (!esito.ok) return res.status(404).json({ errore: esito.errore });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Verifica differita del numero (cliente già loggato, non verificato).
async function richiediVerifica(req, res, next) {
  try {
    const { rows: [c] } = await pool.query('SELECT telefono, telefono_verificato FROM clienti WHERE id = $1', [req.clienteId]);
    if (!c) return res.status(404).json({ errore: 'Cliente non trovato.' });
    if (c.telefono_verificato) return res.json({ ok: true, giaVerificato: true });
    await otpService.richiediOtp(c.telefono);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function confermaVerifica(req, res, next) {
  try {
    const { rows: [c] } = await pool.query('SELECT telefono, telefono_verificato FROM clienti WHERE id = $1', [req.clienteId]);
    if (!c) return res.status(404).json({ errore: 'Cliente non trovato.' });
    if (c.telefono_verificato) return res.json({ ok: true, giaVerificato: true });
    await otpService.verificaOtp(c.telefono, req.body.codice);
    // Qui NON si invalidano le sessioni: a verificare è la sessione stessa
    // che ha creato l'account, cioè il titolare del numero.
    await pool.query('UPDATE clienti SET telefono_verificato = true WHERE id = $1', [req.clienteId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function aggiornaProfilo(req, res, next) {
  try {
    const { nome, cognome, email, dataNascita } = req.body;
    await pool.query(
      `UPDATE clienti SET nome = $1, cognome = $2, email = $3, data_nascita = $4 WHERE id = $5`,
      [nome, cognome || null, email || null, dataNascita || null, req.clienteId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function attivaConvenzione(req, res, next) {
  try {
    const { codice } = req.body;
    const { rows } = await pool.query(
      `SELECT id FROM convenzioni WHERE codice_adesione = $1 AND attiva = true`,
      [codice]
    );
    if (rows.length === 0) return res.status(404).json({ errore: 'Codice convenzione non valido.' });
    await pool.query('UPDATE clienti SET convenzione_id = $1 WHERE id = $2', [rows[0].id, req.clienteId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function revocaConsensoMarketing(req, res, next) {
  try {
    await pool.query(
      `UPDATE clienti SET consenso_marketing_il = NULL, consenso_marketing_revocato_il = now()
        WHERE id = $1 AND consenso_marketing_il IS NOT NULL`,
      [req.clienteId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Il consenso marketing si può dare anche dopo la registrazione, dal
// profilo. Un nuovo consenso azzera l'eventuale revoca precedente.
async function prestaConsensoMarketing(req, res, next) {
  try {
    await pool.query(
      `UPDATE clienti SET consenso_marketing_il = now(), consenso_marketing_revocato_il = NULL
        WHERE id = $1 AND consenso_marketing_il IS NULL`,
      [req.clienteId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Diritto di accesso e portabilità (art. 15 e 20 GDPR): tutto ciò che
// abbiamo sul cliente, in un file JSON leggibile. Niente dati di altri
// clienti, niente identificativi interni inutili.
async function esportaDati(req, res, next) {
  try {
    const id = req.clienteId;
    const { rows: [c] } = await pool.query(
      `SELECT c.nome, c.cognome, c.email, c.telefono, c.telefono_verificato, c.data_nascita, c.created_at,
              c.consenso_servizio_il, c.informativa_versione, c.consenso_marketing_il, c.consenso_marketing_revocato_il,
              l.nome AS livello, conv.nome AS convenzione,
              t.codice AS tessera_codice, t.codice_qr AS tessera_codice_qr, t.attivata_il AS tessera_attivata_il
         FROM clienti c
         LEFT JOIN livelli l ON l.id = c.livello_id
         LEFT JOIN convenzioni conv ON conv.id = c.convenzione_id
         LEFT JOIN tessere t ON t.cliente_id = c.id AND t.stato = 'attiva'
        WHERE c.id = $1 AND c.stato = 'attivo'`,
      [id]
    );
    if (!c) return res.status(404).json({ errore: 'Cliente non trovato.' });
    const { rows: visite } = await pool.query(
      `SELECT s.created_at AS data, sd.nome AS sede, l.nome AS livello
         FROM scansioni s JOIN sedi sd ON sd.id = s.sede_id LEFT JOIN livelli l ON l.id = s.livello_id
        WHERE s.cliente_id = $1 ORDER BY s.created_at`,
      [id]
    );
    const { rows: promo } = await pool.query(
      `SELECT p.titolo, pc.caricata_il,
              (SELECT json_agg(json_build_object('data', u.usata_il, 'sede', sd.nome) ORDER BY u.usata_il)
                 FROM promozioni_utilizzi u JOIN sedi sd ON sd.id = u.sede_id
                WHERE u.promozione_id = p.id AND u.cliente_id = $1) AS utilizzi
         FROM promozioni_clienti pc JOIN promozioni p ON p.id = pc.promozione_id
        WHERE pc.cliente_id = $1 ORDER BY pc.caricata_il`,
      [id]
    );
    const dati = {
      esportatoIl: new Date().toISOString(),
      titolare: { ...TITOLARE },
      anagrafica: {
        nome: c.nome, cognome: c.cognome, email: c.email, telefono: c.telefono,
        telefonoVerificato: c.telefono_verificato, dataNascita: c.data_nascita, iscrittoIl: c.created_at,
      },
      consensi: {
        informativaAccettataIl: c.consenso_servizio_il,
        informativaVersione: c.informativa_versione,
        marketing: c.consenso_marketing_il ? { prestatoIl: c.consenso_marketing_il } : { prestato: false, revocatoIl: c.consenso_marketing_revocato_il },
      },
      tessera: { codice: c.tessera_codice, codiceQr: c.tessera_codice_qr, attivataIl: c.tessera_attivata_il, livello: c.livello, convenzione: c.convenzione },
      visite,
      promozioni: promo.map((p) => ({ titolo: p.titolo, caricataIl: p.caricata_il, utilizzi: p.utilizzi || [] })),
    };
    res.setHeader('Content-Disposition', `attachment; filename="handmade-club-dati-${c.tessera_codice || id}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.json(dati);
  } catch (err) {
    next(err);
  }
}

async function cancellaAccount(req, res, next) {
  try {
    await pool.query(
      `UPDATE clienti
       SET stato = 'cancellato', cancellato_il = now(),
           telefono = 'anonimizzato-' || id, email = NULL, nome = 'Cliente cancellato', cognome = NULL
       WHERE id = $1`,
      [req.clienteId]
    );
    await pool.query(`UPDATE tessere SET stato = 'revocata' WHERE cliente_id = $1 AND stato = 'attiva'`, [req.clienteId]);
    res.clearCookie(jwtService.NOME_COOKIE.cliente, { path: '/' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  me, qrToken, promozioni, caricaPromozione, richiediVerifica, confermaVerifica, aggiornaProfilo, attivaConvenzione,
  revocaConsensoMarketing, prestaConsensoMarketing, esportaDati, cancellaAccount,
};
