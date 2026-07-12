const express = require('express');
const operatoreController = require('../controllers/operatoreController');
const authOperatore = require('../middleware/authOperatore');
const validate = require('../middleware/validate');
const { limitatorePubblico } = require('../middleware/rateLimiters');
const { loginSchema, scansioneSchema } = require('../schemas/operatore.schema');

const router = express.Router();

router.get('/sedi', operatoreController.elencoSedi);
router.post('/login', limitatorePubblico(), validate(loginSchema), operatoreController.login);

router.use(authOperatore);
router.get('/sessione', operatoreController.sessione);
router.post('/logout', operatoreController.logout);
router.post('/scansione', validate(scansioneSchema), operatoreController.scansione);

module.exports = router;
