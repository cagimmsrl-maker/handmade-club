const pushService = require('../services/pushService');

// Chiave pubblica VAPID: il client ne ha bisogno per chiedere l'iscrizione al
// browser. attivo=false → l'app non mostra il pulsante.
async function chiave(req, res) {
  res.json({ attivo: pushService.attivo, chiavePubblica: pushService.chiavePubblica() });
}

async function iscrivi(req, res, next) {
  try {
    if (!pushService.attivo) return res.status(503).json({ errore: 'Notifiche non disponibili al momento.' });
    await pushService.iscrivi(req.clienteId, req.body, req.get('user-agent'));
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function disiscrivi(req, res, next) {
  try {
    await pushService.disiscrivi(req.clienteId, req.body.endpoint);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// --- admin ---------------------------------------------------------------

async function riepilogoAdmin(req, res, next) {
  try {
    res.json({ riepilogo: await pushService.riepilogo(), storico: await pushService.storico() });
  } catch (err) {
    next(err);
  }
}

// Anteprima: quanti clienti/telefoni raggiunge il filtro, prima di inviare.
async function contaAdmin(req, res, next) {
  try {
    const filtro = {
      livelloId: req.query.livelloId ? parseInt(req.query.livelloId, 10) : null,
      sedeId: req.query.sedeId ? parseInt(req.query.sedeId, 10) : null,
    };
    res.json(await pushService.contaDestinatari(filtro));
  } catch (err) {
    next(err);
  }
}

async function inviaAdmin(req, res, next) {
  try {
    const { titolo, testo, url, livelloId, sedeId } = req.body;
    const filtro = {};
    if (livelloId) filtro.livelloId = livelloId;
    if (sedeId) filtro.sedeId = sedeId;
    const esito = await pushService.invia({ titolo, testo, url: url || null, filtro, adminId: req.adminId ?? null });
    res.status(201).json(esito);
  } catch (err) {
    next(err);
  }
}

module.exports = { chiave, iscrivi, disiscrivi, riepilogoAdmin, contaAdmin, inviaAdmin };
