-- ============================================================
-- Migrazione 006 — Privacy: versione dell'informativa accettata e
--                  revoca del consenso marketing tracciata
-- Database: handmade_clienti
-- ============================================================
--
-- informativa_versione: quale testo dell'informativa (/privacy) il cliente
-- ha accettato alla registrazione (es. '2026-10-21'). NULL per chi si è
-- registrato prima che l'informativa avesse una versione.
-- consenso_marketing_revocato_il: quando il cliente ha tolto il consenso
-- dal profilo; consenso_marketing_il torna NULL ma resta traccia della
-- revoca. Un nuovo consenso azzera la revoca.

BEGIN;

ALTER TABLE clienti
    ADD COLUMN informativa_versione TEXT,
    ADD COLUMN consenso_marketing_revocato_il TIMESTAMPTZ;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (6, 'Privacy: clienti.informativa_versione e consenso_marketing_revocato_il');

COMMIT;
