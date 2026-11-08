-- ============================================================
-- Migrazione 014 — Notifiche push (Web Push / VAPID)
-- Database: handmade_clienti
-- ============================================================
--
-- Il cliente che tocca "Attiva le notifiche" nell'app registra il suo
-- telefono (una "iscrizione" Web Push: endpoint del browser + chiavi).
-- Nessun servizio esterno: le consegnano Google/Apple/Mozilla con il
-- protocollo standard, firmate con le nostre chiavi VAPID (nel .env).
--
-- push_iscrizioni: un telefono = una riga (endpoint UNIQUE). Un cliente può
--   averne più d'una (telefono + tablet). Quando il server di push risponde
--   404/410 l'iscrizione è morta (app disinstallata, permesso tolto) e viene
--   cancellata al volo. `fallimenti` conta gli errori temporanei di fila.
-- notifiche: lo storico di ciò che l'admin ha mandato, con i conteggi.
--   `filtro` ricorda i destinatari scelti (sede, livello) per rileggere
--   dopo a chi era rivolta.
--
-- Le notifiche sono comunicazioni promozionali: si inviano SOLO ai clienti
-- con consenso marketing attivo (lo decide pushService al momento
-- dell'invio, non l'iscrizione).

BEGIN;

CREATE TABLE push_iscrizioni (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    user_agent      TEXT,
    fallimenti      INTEGER NOT NULL DEFAULT 0,
    ultimo_invio_il TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX push_iscrizioni_cliente_idx ON push_iscrizioni (cliente_id);

CREATE TABLE notifiche (
    id              SERIAL PRIMARY KEY,
    titolo          TEXT NOT NULL,
    testo           TEXT NOT NULL,
    url             TEXT,
    filtro          JSONB NOT NULL DEFAULT '{}'::jsonb,
    destinatari     INTEGER NOT NULL DEFAULT 0,   -- clienti con consenso e almeno un telefono iscritto
    inviate         INTEGER NOT NULL DEFAULT 0,   -- iscrizioni a cui si è provato a inviare
    consegnate      INTEGER NOT NULL DEFAULT 0,   -- accettate dal servizio push (2xx)
    fallite         INTEGER NOT NULL DEFAULT 0,
    rimosse         INTEGER NOT NULL DEFAULT 0,   -- iscrizioni morte cancellate durante l'invio
    creato_da       INTEGER REFERENCES admin_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON push_iscrizioni, notifiche TO hclub;
GRANT USAGE, SELECT ON SEQUENCE push_iscrizioni_id_seq, notifiche_id_seq TO hclub;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (14, 'Notifiche push Web Push/VAPID: iscrizioni dei telefoni e storico invii');

COMMIT;
