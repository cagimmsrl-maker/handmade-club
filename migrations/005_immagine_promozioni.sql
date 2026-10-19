-- ============================================================
-- Migrazione 005 — Foto delle promozioni
-- Database: handmade_clienti
-- ============================================================
--
-- Una promozione può avere una foto (del prodotto, del locale...) che il
-- cliente vede in bacheca. Il file vive su disco, fuori dal repository
-- (cartella uploads/promozioni, vedi immaginiService); qui si salva solo
-- il nome del file, generato dal server (mai quello scelto dall'utente).
-- NULL = promozione senza foto.

BEGIN;

ALTER TABLE promozioni ADD COLUMN immagine TEXT;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (5, 'Foto delle promozioni: promozioni.immagine (nome file in uploads/promozioni)');

COMMIT;
