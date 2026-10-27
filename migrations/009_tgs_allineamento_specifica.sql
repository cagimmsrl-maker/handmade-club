-- ============================================================
-- Migrazione 009 — Allineamento alla specifica TGS v1 (26/10/2026)
-- Database: handmade_clienti
-- ============================================================
--
-- elaborato_il: momento dell'elaborazione in TGS, inviato con l'esito.
-- ip_consentiti: filtro IP facoltativo per chiave (NULL = qualunque IP).
--   Il punto vendita di Fiano ha IP pubblico statico (5.154.199.20):
--   quando il collegamento è collaudato si può restringere la chiave a
--   quell'indirizzo. La chiave resta comunque la protezione principale.

BEGIN;

ALTER TABLE tgs_sincronizzazioni ADD COLUMN elaborato_il TIMESTAMPTZ;
ALTER TABLE tgs_chiavi_api ADD COLUMN ip_consentiti INET[];

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (9, 'TGS: elaborato_il negli esiti e filtro IP facoltativo per chiave');

COMMIT;
