const express = require('express');
const rateLimit = require('express-rate-limit');
const authTgs = require('../middleware/authTgs');
const { esitoSchema } = require('../schemas/tgs.schema');
const tgsController = require('../controllers/tgsController');

const router = express.Router();

// Il servizio TGS passa ogni ~10 s (≈ 90 giri in 15 min) più gli esiti:
// limite largo, solo contro i loop impazziti. La vera protezione è la chiave.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false,
  message: { errore: 'Troppe richieste.' } }));
router.use(authTgs);

// La specifica TGS vuole 422 (non 400) per corpo non valido.
function validaEsito(req, res, next) {
  const r = esitoSchema.safeParse(req.body);
  if (!r.success) {
    return res.status(422).json({
      errore: 'Corpo non valido.',
      dettagli: r.error.issues.map((i) => ({ campo: i.path.join('.'), messaggio: i.message })),
    });
  }
  req.body = r.data;
  next();
}

router.get('/clienti-da-sincronizzare', tgsController.clientiDaSincronizzare);
router.post('/clienti/:id/esito', validaEsito, tgsController.esito);

module.exports = router;
