-- ============================================================
-- Migrazione 007 — Coda eventi verso la cassa TGS
-- Database: handmade_clienti
-- ============================================================
--
-- L'integrazione con la cassa (server/services/tgs/) è "fail-open": niente
-- di ciò che fa l'app deve fermarsi se la cassa è spenta o la rete del
-- locale è giù. Perciò gli eventi da comunicare alla cassa (nuovo cliente,
-- promo caricata, visita) non si inviano in linea: si mettono in questa
-- coda e un lavoratore in sottofondo li consegna, ritentando con pausa
-- crescente. Così un'interruzione di un'ora non perde nulla.
--
-- tipo:      'cliente_upsert' | 'promo_caricata' | 'scansione'
-- payload:   dati dell'evento (id nostri; il service li traduce per TGS)
-- stato:     'in_attesa' | 'inviato' | 'fallito' (dopo MAX tentativi)
-- prossimo_tentativo_il: quando riprovare (backoff esponenziale)

BEGIN;

CREATE TABLE tgs_eventi (
    id                      SERIAL PRIMARY KEY,
    tipo                    TEXT NOT NULL
                            CHECK (tipo IN ('cliente_upsert', 'promo_caricata', 'scansione')),
    cliente_id              INTEGER REFERENCES clienti(id),
    payload                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    stato                   TEXT NOT NULL DEFAULT 'in_attesa'
                            CHECK (stato IN ('in_attesa', 'inviato', 'fallito')),
    tentativi               INTEGER NOT NULL DEFAULT 0,
    ultimo_errore           TEXT,
    prossimo_tentativo_il   TIMESTAMPTZ NOT NULL DEFAULT now(),
    inviato_il              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Il lavoratore legge solo gli eventi in attesa già maturi, in ordine.
CREATE INDEX tgs_eventi_da_inviare_idx
    ON tgs_eventi (prossimo_tentativo_il, id)
    WHERE stato = 'in_attesa';

CREATE INDEX tgs_eventi_cliente_idx ON tgs_eventi (cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON tgs_eventi TO hclub;
GRANT USAGE, SELECT ON SEQUENCE tgs_eventi_id_seq TO hclub;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (7, 'Coda eventi verso la cassa TGS (tgs_eventi): consegna in sottofondo con ritentativi');

COMMIT;
