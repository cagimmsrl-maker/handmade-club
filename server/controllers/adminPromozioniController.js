const promozioniService = require('../services/promozioniService');

async function lista(req, res, next) {
  try {
    res.json(await promozioniService.listaAdmin());
  } catch (err) {
    next(err);
  }
}

async function crea(req, res, next) {
  try {
    const id = await promozioniService.creaAdmin(req.body, req.adminId ?? null);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function aggiorna(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await promozioniService.aggiornaAdmin(id, req.body);
    if (!ok) return res.status(404).json({ errore: 'Promozione non trovata o archiviata.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Pubblica: da quel momento è visibile in bacheca ai destinatari.
async function pubblica(req, res, next) {
  try {
    const ok = await promozioniService.cambiaStato(parseInt(req.params.id, 10), 'pubblicata');
    if (!ok) return res.status(404).json({ errore: 'Promozione non trovata.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Archivia: sparisce dalla bacheca e non è più utilizzabile, ma restano
// caricamenti e utilizzi per le statistiche.
async function archivia(req, res, next) {
  try {
    const ok = await promozioniService.cambiaStato(parseInt(req.params.id, 10), 'archiviata');
    if (!ok) return res.status(404).json({ errore: 'Promozione non trovata.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function elimina(req, res, next) {
  try {
    const ok = await promozioniService.eliminaAdmin(parseInt(req.params.id, 10));
    if (!ok) return res.status(409).json({ errore: 'Si può eliminare solo una bozza mai pubblicata: archiviala.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { lista, crea, aggiorna, pubblica, archivia, elimina };
