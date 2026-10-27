-- ============================================================
-- Migrazione 008 — Sincronizzazione clienti verso la cassa TGS (modello "pull")
-- Database: handmade_clienti
-- ============================================================
--
-- Dal 26/10/2026 TGS ha scelto il verso opposto a quello previsto: è il
-- LORO servizio, accanto alla cassa, che ogni ~10 s chiama la nostra app:
--   GET  /api/tgs/clienti-da-sincronizzare   → i clienti nuovi
--   POST /api/tgs/clienti/{id}/esito         → creato | gia_presente | errore
-- Niente porte aperte nel punto vendita. Ogni punto vendita ha la sua
-- chiave X-Api-Key e il suo TGS: la sincronizzazione è per (cliente, sede).
--
-- tgs_chiavi_api: una chiave per punto vendita; si salva SOLO l'hash
--   SHA-256 (la chiave in chiaro la vede una volta chi la genera, con
--   `npm run crea-chiave-tgs`).
-- tgs_sincronizzazioni: l'esito comunicato da TGS per ciascun cliente in
--   ciascuna sede. UNIQUE (cliente_id, sede_id) rende l'esito idempotente:
--   ripetuto, aggiorna la stessa riga e non crea doppioni. Un cliente senza
--   riga (o solo con stato 'errore' se richiesto) è "da sincronizzare".

BEGIN;

CREATE TABLE tgs_chiavi_api (
    id              SERIAL PRIMARY KEY,
    sede_id         INTEGER NOT NULL REFERENCES sedi(id),
    etichetta       TEXT NOT NULL,                       -- es. 'TGS Fiano'
    chiave_hash     TEXT NOT NULL UNIQUE,                -- sha256 esadecimale della chiave
    attiva          BOOLEAN NOT NULL DEFAULT true,
    ultimo_uso_il   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tgs_sincronizzazioni (
    id                  SERIAL PRIMARY KEY,
    cliente_id          INTEGER NOT NULL REFERENCES clienti(id),
    sede_id             INTEGER NOT NULL REFERENCES sedi(id),
    stato               TEXT NOT NULL
                        CHECK (stato IN ('creato', 'gia_presente', 'errore')),
    tgs_codice_cliente  TEXT,
    tgs_codice_card     TEXT,                            -- es. FC000123
    tgs_numero_pay      TEXT,
    messaggio           TEXT,                            -- dettaglio errore / note di TGS
    esiti_ricevuti      INTEGER NOT NULL DEFAULT 1,      -- quante volte TGS ha mandato l'esito
    primo_esito_il      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_esito_il     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cliente_id, sede_id)
);

CREATE INDEX tgs_sincronizzazioni_sede_stato_idx ON tgs_sincronizzazioni (sede_id, stato);

GRANT SELECT, INSERT, UPDATE, DELETE ON tgs_chiavi_api, tgs_sincronizzazioni TO hclub;
GRANT USAGE, SELECT ON SEQUENCE tgs_chiavi_api_id_seq, tgs_sincronizzazioni_id_seq TO hclub;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (8, 'Sincronizzazione clienti verso TGS (pull): chiavi API per sede ed esiti per (cliente, sede)');

COMMIT;
