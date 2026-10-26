const express = require('express');
const clienteController = require('../controllers/clienteController');
const authCliente = require('../middleware/authCliente');
const validate = require('../middleware/validate');
const { profiloSchema, convenzioneSchema } = require('../schemas/cliente.schema');
const { confermaVerificaSchema } = require('../schemas/auth.schema');
const { limitatoreOtp } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(authCliente);

router.get('/me', clienteController.me);
router.get('/qr-token', clienteController.qrToken); // compatibilità app già installate
router.get('/promozioni', clienteController.promozioni);
router.post('/promozioni/:id/carica', clienteController.caricaPromozione);
router.post('/verifica/richiedi', limitatoreOtp(), clienteController.richiediVerifica);
router.post('/verifica/conferma', limitatoreOtp(), validate(confermaVerificaSchema), clienteController.confermaVerifica);
router.put('/profilo', validate(profiloSchema), clienteController.aggiornaProfilo);
router.post('/convenzione', validate(convenzioneSchema), clienteController.attivaConvenzione);
router.delete('/consenso-marketing', clienteController.revocaConsensoMarketing);
router.post('/consenso-marketing', clienteController.prestaConsensoMarketing);
router.get('/esporta-dati', clienteController.esportaDati);
router.post('/cancella-account', clienteController.cancellaAccount);

module.exports = router;
