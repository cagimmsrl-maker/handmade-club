const express = require('express');
const rateLimit = require('express-rate-limit');
const authTgs = require('../middleware/authTgs');
const { esitoSchema, esitoPromozioneSchema, passaggioSchema } = require('../schemas/tgs.schema');
const tgsController = require('../controllers/tgsController');
const tgsPromo = require('../controllers/tgsPromozioniController');

const router = express.Router();

// Il servizio TGS passa ogni ~10 s (≈ 90 giri in 15 min) più gli esiti:
// limite largo, solo contro i loop impazziti. La vera protezione è la chiave.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false,
  message: { errore: 'Troppe richieste.' } }));
router.use(authTgs);

// La specifica TGS vuole 422 (non 400) per corpo non valido.
const valida422 = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    return res.status(422).json({
      errore: 'Corpo non valido.',
      dettagli: r.error.issues.map((i) => ({ campo: i.path.join('.'), messaggio: i.message })),
    });
  }
  req.body = r.data;
  next();
};

// v1 — clienti
router.get('/clienti-da-sincronizzare', tgsController.clientiDaSincronizzare);
router.post('/clienti/:id/esito', valida422(esitoSchema), tgsController.esito);

// v2 — promozioni caricate e passaggi in cassa
router.get('/promozioni-da-sincronizzare', tgsPromo.promozioniDaSincronizzare);
router.post('/promozioni/:id/esito', valida422(esitoPromozioneSchema), tgsPromo.esitoPromozione);
router.post('/passaggi', valida422(passaggioSchema), tgsPromo.passaggio);

module.exports = router;
