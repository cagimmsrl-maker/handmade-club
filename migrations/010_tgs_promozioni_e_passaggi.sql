-- ============================================================
-- Migrazione 010 — TGS v2: promozioni caricate verso la cassa e passaggi in cassa
-- Database: handmade_clienti
-- ============================================================
--
-- Estende il modello "pull" della v1 (migrazione 008) a due flussi:
--  1. PROMOZIONI: il servizio TGS chiede le promo caricate dai clienti in app
--     (GET /api/tgs/promozioni-da-sincronizzare), le crea in cassa e comunica
--     l'esito (POST /api/tgs/promozioni/{id}/esito). Una riga per
--     (promozione caricata, sede): UNIQUE → esito idempotente.
--  2. PASSAGGI: quando la cassa legge il QR, il servizio ci manda lo scontrino
--     (POST /api/tgs/passaggi). Da lì nascono la scansione (visita → livello) e
--     gli utilizzi delle promo, senza bisogno del tablet operatore.
--     UNIQUE (sede, numero scontrino) → un passaggio ripetuto non conta due volte.

BEGIN;

CREATE TABLE tgs_sinc_promozioni (
    id                      SERIAL PRIMARY KEY,
    promozione_cliente_id   INTEGER NOT NULL REFERENCES promozioni_clienti(id) ON DELETE CASCADE,
    sede_id                 INTEGER NOT NULL REFERENCES sedi(id),
    stato                   TEXT NOT NULL CHECK (stato IN ('creata', 'errore')),
    tgs_codice_promozione   TEXT,
    messaggio               TEXT,
    elaborato_il            TIMESTAMPTZ,
    esiti_ricevuti          INTEGER NOT NULL DEFAULT 1,
    primo_esito_il          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_esito_il         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (promozione_cliente_id, sede_id)
);
CREATE INDEX tgs_sinc_promozioni_sede_stato_idx ON tgs_sinc_promozioni (sede_id, stato);

CREATE TABLE tgs_passaggi (
    id                  SERIAL PRIMARY KEY,
    sede_id             INTEGER NOT NULL REFERENCES sedi(id),
    cliente_id          INTEGER NOT NULL REFERENCES clienti(id),
    numero_scontrino    TEXT NOT NULL,
    totale              NUMERIC(10,2),
    passato_il          TIMESTAMPTZ NOT NULL,
    scansione_id        INTEGER REFERENCES scansioni(id),
    promozioni_usate    INTEGER[],                    -- id di promozioni_clienti
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sede_id, numero_scontrino)
);
CREATE INDEX tgs_passaggi_cliente_idx ON tgs_passaggi (cliente_id, passato_il);

GRANT SELECT, INSERT, UPDATE, DELETE ON tgs_sinc_promozioni, tgs_passaggi TO hclub;
GRANT USAGE, SELECT ON SEQUENCE tgs_sinc_promozioni_id_seq, tgs_passaggi_id_seq TO hclub;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (10, 'TGS v2: sincronizzazione promozioni caricate e passaggi in cassa (visite e utilizzi dalla cassa)');

COMMIT;
