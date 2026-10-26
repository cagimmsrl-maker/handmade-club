const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { limitatoreRegistrazione, limitatoreOtp } = require('../middleware/rateLimiters');
const { richiediOtpSchema, verificaOtpSchema, completaProfiloSchema, registraSchema } = require('../schemas/auth.schema');

const router = express.Router();

router.post('/richiedi-otp', limitatoreOtp(), validate(richiediOtpSchema), authController.richiediOtp);
router.post('/verifica-otp', limitatoreOtp(), validate(verificaOtpSchema), authController.verificaOtp);
router.post('/completa-profilo', validate(completaProfiloSchema), authController.completaProfilo);
router.post('/registra', limitatoreRegistrazione(), validate(registraSchema), authController.registra);
router.post('/logout', authController.logout);

module.exports = router;
