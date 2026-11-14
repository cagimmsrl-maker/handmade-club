-- ============================================================
-- Migrazione 015 — Origine del cliente (canale di acquisizione)
-- Database: handmade_clienti
-- ============================================================
--
-- Da dove è arrivato chi ha fatto la tessera: il QR al banco, una
-- pubblicità Instagram, il sacchetto dell'asporto, una convenzione…
-- Il link porta il parametro ?da=<canale> (es. /installa?da=instagram);
-- il client lo tiene in localStorage e lo manda a /auth/registra.
-- Serve a capire quale canale porta tessere prima di spenderci sopra.
-- NULL = non noto (tutti gli iscritti prima di questa migrazione, e chi
-- arriva senza parametro, cioè di norma dal banco).

BEGIN;

ALTER TABLE clienti ADD COLUMN origine VARCHAR(40);

CREATE INDEX idx_clienti_origine ON clienti(origine) WHERE origine IS NOT NULL;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (15, 'clienti.origine: canale di acquisizione dal parametro ?da= del link');

COMMIT;
