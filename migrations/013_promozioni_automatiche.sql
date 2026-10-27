-- ============================================================
-- Migrazione 013 — Promozioni caricate automaticamente su tutte le tessere
-- Database: handmade_clienti
-- ============================================================
--
-- Di norma una promo vale solo se il cliente la carica (è il punto della
-- bacheca). Per le promo "di benvenuto" (es. apertura di una sede) serve il
-- contrario: tutti i possessori di tessera ce l'hanno già. promozioni.automatica
-- = true: alla pubblicazione viene caricata per tutti i clienti attivi
-- destinatari, e ad ogni nuova registrazione per il nuovo cliente
-- (authController → promozioniService.caricaAutomaticheNuovoCliente).

BEGIN;

ALTER TABLE promozioni ADD COLUMN automatica BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (13, 'promozioni.automatica: promo caricata su tutte le tessere alla pubblicazione e alla registrazione');

COMMIT;
