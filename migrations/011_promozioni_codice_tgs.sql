-- ============================================================
-- Migrazione 011 — Codice promozione TGS sulle promozioni dell'app
-- Database: handmade_clienti
-- ============================================================
--
-- Le promozioni si DEFINISCONO in TGS (codici, articoli, regole di cassa).
-- L'app non le crea in cassa: quando il cliente carica una promo, dice al
-- servizio TGS "attiva sulla card di questo cliente la promozione TGS con
-- questo codice". Il codice lo indica l'admin nella promo dell'app.
-- Una promo senza codice TGS non viene sincronizzata con la cassa (si
-- applica a mano dalla schermata operatore).

BEGIN;

ALTER TABLE promozioni ADD COLUMN codice_tgs TEXT;

-- L'esito di una promo verso la cassa è un'ATTIVAZIONE sulla card, non una
-- creazione: si rinomina lo stato ('creata' → 'attivata') aggiornando il vincolo.
ALTER TABLE tgs_sinc_promozioni DROP CONSTRAINT tgs_sinc_promozioni_stato_check;
UPDATE tgs_sinc_promozioni SET stato = 'attivata' WHERE stato = 'creata';
ALTER TABLE tgs_sinc_promozioni ADD CONSTRAINT tgs_sinc_promozioni_stato_check CHECK (stato IN ('attivata', 'errore'));

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (11, 'promozioni.codice_tgs (promozione TGS da attivare sulla card) e stato tgs_sinc_promozioni creata→attivata');

COMMIT;
