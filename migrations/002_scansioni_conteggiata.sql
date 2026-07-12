-- ============================================================
-- Migrazione 002 — Distinzione scansioni valide/duplicate
-- Database: handmade_clienti
-- ============================================================

BEGIN;

-- Regola anti-abuso: al massimo una scansione ogni 2 ore per
-- cliente/sede conta ai fini del calcolo del livello. Le scansioni
-- successive vengono comunque registrate (per tracciabilità) ma con
-- conteggiata = false, e non incrementano le visite del cliente.
ALTER TABLE scansioni ADD COLUMN conteggiata BOOLEAN NOT NULL DEFAULT true;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (2, 'Aggiunge scansioni.conteggiata per la regola anti-abuso (2h per cliente/sede)');

COMMIT;
