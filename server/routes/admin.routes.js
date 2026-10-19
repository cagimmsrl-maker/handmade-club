const express = require('express');
const adminAuthController = require('../controllers/adminAuthController');
const adminLivelliController = require('../controllers/adminLivelliController');
const adminConvenzioniController = require('../controllers/adminConvenzioniController');
const adminSediController = require('../controllers/adminSediController');
const adminParametriController = require('../controllers/adminParametriController');
const adminDashboardController = require('../controllers/adminDashboardController');
const adminClientiController = require('../controllers/adminClientiController');
const adminPromozioniController = require('../controllers/adminPromozioniController');
const authAdmin = require('../middleware/authAdmin');
const validate = require('../middleware/validate');
const multer = require('multer');
const { MAX_BYTE } = require('../services/immaginiService');
const { limitatorePubblico } = require('../middleware/rateLimiters');
const {
  loginSchema,
  livelloSchema,
  convenzioneSchema,
  sedeSchema,
  parametriSchema,
  promozioneSchema,
} = require('../schemas/admin.schema');

const router = express.Router();

router.post('/login', limitatorePubblico(), validate(loginSchema), adminAuthController.login);

router.use(authAdmin);

router.get('/sessione', adminAuthController.sessione);
router.post('/logout', adminAuthController.logout);

router.get('/livelli', adminLivelliController.lista);
router.post('/livelli', validate(livelloSchema), adminLivelliController.crea);
router.put('/livelli/:id', validate(livelloSchema), adminLivelliController.aggiorna);
router.delete('/livelli/:id', adminLivelliController.elimina);

router.get('/convenzioni', adminConvenzioniController.lista);
router.post('/convenzioni', validate(convenzioneSchema), adminConvenzioniController.crea);
router.put('/convenzioni/:id', validate(convenzioneSchema), adminConvenzioniController.aggiorna);
router.delete('/convenzioni/:id', adminConvenzioniController.elimina);

router.get('/sedi', adminSediController.lista);
router.post('/sedi', validate(sedeSchema), adminSediController.crea);
router.put('/sedi/:id', validate(sedeSchema), adminSediController.aggiorna);
router.delete('/sedi/:id', adminSediController.elimina);

router.get('/parametri', adminParametriController.leggi);
router.put('/parametri', validate(parametriSchema), adminParametriController.aggiorna);

router.get('/dashboard', adminDashboardController.dashboard);

router.get('/promozioni', adminPromozioniController.lista);
router.post('/promozioni', validate(promozioneSchema), adminPromozioniController.crea);
router.put('/promozioni/:id', validate(promozioneSchema), adminPromozioniController.aggiorna);
router.post('/promozioni/:id/pubblica', adminPromozioniController.pubblica);
router.post('/promozioni/:id/archivia', adminPromozioniController.archivia);
router.delete('/promozioni/:id', adminPromozioniController.elimina);

// Foto promozione: un solo file, in memoria (poi immaginiService lo scrive
// con un nome suo). Gli errori di multer (peso, campo sbagliato) diventano
// risposte 400/413 leggibili invece di un 500.
const uploadImmagine = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTE, files: 1, fields: 0 } });
function conImmagine(req, res, next) {
  uploadImmagine.single('immagine')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ errore: 'Immagine troppo pesante (massimo 950 KB).' });
    return res.status(400).json({ errore: 'Caricamento non valido: invia una sola immagine nel campo "immagine".' });
  });
}
router.post('/promozioni/:id/immagine', conImmagine, adminPromozioniController.caricaImmagine);
router.delete('/promozioni/:id/immagine', adminPromozioniController.rimuoviImmagine);

router.get('/clienti', adminClientiController.elenco);
router.post('/clienti/:id/blocca-tessera', adminClientiController.bloccaTessera);

module.exports = router;
