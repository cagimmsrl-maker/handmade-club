const express = require('express');
const clienteController = require('../controllers/clienteController');
const authCliente = require('../middleware/authCliente');
const validate = require('../middleware/validate');
const { profiloSchema, convenzioneSchema } = require('../schemas/cliente.schema');

const router = express.Router();

router.use(authCliente);

router.get('/me', clienteController.me);
router.get('/qr-token', clienteController.qrToken); // compatibilità app già installate
router.get('/promozioni', clienteController.promozioni);
router.post('/promozioni/:id/carica', clienteController.caricaPromozione);
router.put('/profilo', validate(profiloSchema), clienteController.aggiornaProfilo);
router.post('/convenzione', validate(convenzioneSchema), clienteController.attivaConvenzione);
router.delete('/consenso-marketing', clienteController.revocaConsensoMarketing);
router.post('/cancella-account', clienteController.cancellaAccount);

module.exports = router;
