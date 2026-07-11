-- ============================================================
-- Migrazione 001 — Schema base App Clienti Handmade (Tappa 1)
-- Database: handmade_clienti
-- ============================================================

BEGIN;

CREATE TABLE schema_migrations (
    versione        INTEGER PRIMARY KEY,
    descrizione     TEXT NOT NULL,
    eseguita_il     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Sedi (anagrafica propria, isolata dal gestionale)
-- ------------------------------------------------------------
CREATE TABLE sedi (
    id              SERIAL PRIMARY KEY,
    nome            TEXT NOT NULL,              -- es. 'Olmo', 'Pontani', 'Centova', 'Collestrada', 'Fiano'
    indirizzo       TEXT,
    pin_operatore   TEXT NOT NULL,              -- PIN per l'accesso alla schermata /operatore
    attiva          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Livelli dinamici (configurabili da /admin)
-- ------------------------------------------------------------
CREATE TABLE livelli (
    id                  SERIAL PRIMARY KEY,
    nome                TEXT NOT NULL,          -- es. 'Standard', 'Oro', 'Platinum'
    soglia_visite       INTEGER NOT NULL,       -- visite nella finestra mobile per raggiungerlo (Standard = 0)
    sconto_percentuale  NUMERIC(5,2) NOT NULL DEFAULT 0,
    colore              TEXT,                   -- per la grafica della tessera
    ordine              INTEGER NOT NULL,       -- ordinamento crescente
    attivo              BOOLEAN NOT NULL DEFAULT true
);

-- Parametri globali (finestra mobile visite, ecc.)
CREATE TABLE parametri (
    chiave          TEXT PRIMARY KEY,
    valore          TEXT NOT NULL,
    descrizione     TEXT
);

INSERT INTO parametri (chiave, valore, descrizione) VALUES
    ('finestra_visite_giorni', '90', 'Giorni della finestra mobile per il calcolo del livello');

-- ------------------------------------------------------------
-- Convenzioni aziendali (dimensione separata dai livelli)
-- ------------------------------------------------------------
CREATE TABLE convenzioni (
    id                  SERIAL PRIMARY KEY,
    nome                TEXT NOT NULL,          -- es. 'Azienda X S.r.l.'
    codice_adesione     TEXT NOT NULL UNIQUE,   -- codice che il cliente inserisce nel profilo
    sconto_percentuale  NUMERIC(5,2) NOT NULL DEFAULT 0,
    note                TEXT,
    attiva              BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Clienti
-- Identificativo primario: telefono verificato via OTP.
-- Email facoltativa (canale promozioni gratuito).
-- ------------------------------------------------------------
CREATE TABLE clienti (
    id                      SERIAL PRIMARY KEY,
    telefono                TEXT NOT NULL UNIQUE,   -- formato E.164, es. +393331234567
    telefono_verificato     BOOLEAN NOT NULL DEFAULT false,
    email                   TEXT,                   -- facoltativa
    nome                    TEXT NOT NULL,
    cognome                 TEXT,
    data_nascita            DATE,                   -- facoltativa (promo compleanno future)
    livello_id              INTEGER REFERENCES livelli(id),
    convenzione_id          INTEGER REFERENCES convenzioni(id),
    -- GDPR: consensi tracciati con timestamp
    consenso_servizio_il    TIMESTAMPTZ NOT NULL,   -- accettazione informativa (obbligatorio)
    consenso_marketing_il   TIMESTAMPTZ,            -- NULL = non prestato (facoltativo, separato)
    -- Stato account
    stato                   TEXT NOT NULL DEFAULT 'attivo'
                            CHECK (stato IN ('attivo', 'sospeso', 'cancellato')),
    cancellato_il           TIMESTAMPTZ,            -- soft delete + anonimizzazione
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clienti_telefono ON clienti(telefono);

-- ------------------------------------------------------------
-- OTP (login e verifica telefono)
-- ------------------------------------------------------------
CREATE TABLE otp_codes (
    id              SERIAL PRIMARY KEY,
    telefono        TEXT NOT NULL,
    codice_hash     TEXT NOT NULL,              -- MAI in chiaro
    scade_il        TIMESTAMPTZ NOT NULL,       -- now() + 5 minuti
    tentativi       INTEGER NOT NULL DEFAULT 0, -- max 3
    usato           BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_telefono ON otp_codes(telefono, created_at);

-- ------------------------------------------------------------
-- Tessere (una attiva per cliente; il QR è un JWT rotante,
-- qui si conserva solo il segreto/seed per la firma)
-- ------------------------------------------------------------
CREATE TABLE tessere (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clienti(id),
    codice          TEXT NOT NULL UNIQUE,       -- identificativo umano tessera, es. HC-00042
    stato           TEXT NOT NULL DEFAULT 'attiva'
                    CHECK (stato IN ('attiva', 'bloccata', 'revocata')),
    attivata_il     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tessera_cliente_attiva
    ON tessere(cliente_id) WHERE stato = 'attiva';

-- ------------------------------------------------------------
-- Scansioni (ogni passaggio al banco = una visita)
-- ------------------------------------------------------------
CREATE TABLE scansioni (
    id              SERIAL PRIMARY KEY,
    tessera_id      INTEGER NOT NULL REFERENCES tessere(id),
    cliente_id      INTEGER NOT NULL REFERENCES clienti(id),
    sede_id         INTEGER NOT NULL REFERENCES sedi(id),
    livello_id      INTEGER REFERENCES livelli(id),      -- livello AL MOMENTO della scansione
    convenzione_id  INTEGER REFERENCES convenzioni(id),  -- convenzione applicata, se presente
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scansioni_cliente ON scansioni(cliente_id, created_at);
CREATE INDEX idx_scansioni_sede ON scansioni(sede_id, created_at);

-- Anti-abuso: per il conteggio visite vale al massimo UNA scansione
-- per cliente per sede per finestra di 2 ore (logica applicativa,
-- l'indice sopra la supporta).

-- ------------------------------------------------------------
-- Admin (pannello /admin — titolare e manager)
-- ------------------------------------------------------------
CREATE TABLE admin_users (
    id              SERIAL PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,              -- bcrypt
    nome            TEXT NOT NULL,
    attivo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Predisposizione Tappa 2b — Prenotazione tavoli
-- (tabelle create ora, UI in una tappa successiva)
-- ------------------------------------------------------------
CREATE TABLE disponibilita_sedi (
    id              SERIAL PRIMARY KEY,
    sede_id         INTEGER NOT NULL REFERENCES sedi(id),
    giorno_settimana INTEGER NOT NULL CHECK (giorno_settimana BETWEEN 0 AND 6), -- 0 = domenica
    ora_inizio      TIME NOT NULL,
    ora_fine        TIME NOT NULL,
    capienza_coperti INTEGER NOT NULL,
    attiva          BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE prenotazioni (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clienti(id),
    sede_id         INTEGER NOT NULL REFERENCES sedi(id),
    data_ora        TIMESTAMPTZ NOT NULL,
    coperti         INTEGER NOT NULL,
    stato           TEXT NOT NULL DEFAULT 'richiesta'
                    CHECK (stato IN ('richiesta', 'confermata', 'rifiutata', 'annullata', 'onorata', 'no_show')),
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prenotazioni_sede_data ON prenotazioni(sede_id, data_ora);

-- ------------------------------------------------------------
-- Dati iniziali minimi (configurabili poi da /admin)
-- ------------------------------------------------------------
INSERT INTO livelli (nome, soglia_visite, sconto_percentuale, colore, ordine) VALUES
    ('Standard', 0,  0,  '#8B8B8B', 1),
    ('Oro',      10, 5,  '#C9A227', 2),
    ('Platinum', 25, 10, '#5B5B6E', 3);

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (1, 'Schema base Tappa 1: clienti, OTP, tessere, livelli, convenzioni, scansioni, sedi, admin, predisposizione prenotazioni');

COMMIT;
