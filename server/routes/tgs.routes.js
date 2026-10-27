const express = require('express');
const rateLimit = require('express-rate-limit');
const authTgs = require('../middleware/authTgs');
const validate = require('../middleware/validate');
const { esitoSchema } = require('../schemas/tgs.schema');
const tgsController = require('../controllers/tgsController');

const router = express.Router();

// Il servizio TGS passa ogni ~10 s (≈ 90 giri in 15 min) più gli esiti:
// limite largo, solo contro i loop impazziti. La vera protezione è la chiave.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false,
  message: { errore: 'Troppe richieste.' } }));
router.use(authTgs);

router.get('/clienti-da-sincronizzare', tgsController.clientiDaSincronizzare);
router.post('/clienti/:id/esito', validate(esitoSchema), tgsController.esito);

module.exports = router;
