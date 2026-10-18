-- ============================================================
-- Migrazione 004 — Registrazione immediata, verifica del numero differita
-- Database: handmade_clienti
-- ============================================================
--
-- Il cliente si iscrive con nome e telefono e ha subito la tessera
-- (telefono_verificato = false). Verifica il numero via OTP solo quando
-- vuole caricare una promozione o ricevere notifiche.
--
-- Rischio da coprire: qualcuno si registra con il numero di un altro.
-- Quando il vero titolare verifica il numero (OTP), entra nello stesso
-- account e tutte le sessioni aperte prima di quel momento vanno
-- invalidate: sessioni_valide_da è il confine, authCliente rifiuta i
-- token emessi prima.

BEGIN;

ALTER TABLE clienti ADD COLUMN sessioni_valide_da TIMESTAMPTZ;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (4, 'Verifica del numero differita: clienti.sessioni_valide_da per invalidare le sessioni al momento della verifica');

COMMIT;
