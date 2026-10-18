-- ============================================================
-- Migrazione 003 — QR statico sulla tessera + promozioni "da caricare"
-- Database: handmade_clienti
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. QR statico. Il QR della tessera diventa un codice fisso
--    (stampabile, leggibile dalle casse come un codice a barre),
--    al posto del token JWT rotante. NON si usa tessere.codice
--    (HC-000042, sequenziale e quindi indovinabile): si genera un
--    codice casuale separato, così conoscere il proprio non dice
--    nulla su quello degli altri. In caso di furto/condivisione
--    l'admin lo rigenera senza toccare il codice umano.
-- ------------------------------------------------------------
ALTER TABLE tessere ADD COLUMN codice_qr TEXT;

-- Backfill delle tessere esistenti: 12 caratteri esadecimali
-- maiuscoli (48 bit), collisioni trascurabili; l'indice UNIQUE
-- sotto farebbe comunque fallire la migrazione in caso di doppione.
UPDATE tessere
   SET codice_qr = upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 12))
 WHERE codice_qr IS NULL;

ALTER TABLE tessere ALTER COLUMN codice_qr SET NOT NULL;
CREATE UNIQUE INDEX tessere_codice_qr_uidx ON tessere (codice_qr);

-- ------------------------------------------------------------
-- 2. Promozioni. Le crea l'admin; il cliente le vede in bacheca e
--    le "carica" (promozioni_clienti). Una promo non caricata per
--    quel cliente non esiste: alla cassa l'operatore vede solo le
--    promo caricate e valide in quel momento, e le segna usate
--    (promozioni_utilizzi).
-- ------------------------------------------------------------
CREATE TABLE promozioni (
    id                  SERIAL PRIMARY KEY,
    titolo              TEXT NOT NULL,
    descrizione         TEXT,
    -- sconto_percentuale: valore = % sullo scontrino
    -- prezzo_fisso:       valore = prezzo in euro del prodotto indicato
    -- omaggio:            prodotto in omaggio / 2x1 (valore non usato)
    -- messaggio:          solo comunicazione, niente da applicare in cassa
    tipo                TEXT NOT NULL
                        CHECK (tipo IN ('sconto_percentuale', 'prezzo_fisso', 'omaggio', 'messaggio')),
    valore              NUMERIC(8,2),
    prodotto            TEXT,
    valido_dal          DATE NOT NULL,
    valido_al           DATE NOT NULL,
    -- Finestra oraria facoltativa (es. happy hour 15:00-18:00) e giorni
    -- della settimana facoltativi (0 = domenica ... 6 = sabato, come
    -- disponibilita_sedi e Date.getDay()). NULL = sempre.
    ora_inizio          TIME,
    ora_fine            TIME,
    giorni_settimana    INTEGER[],
    -- Destinatari: NULL = tutti. Si possono combinare.
    target_livello_id   INTEGER REFERENCES livelli(id),
    target_sede_id      INTEGER REFERENCES sedi(id),
    -- Quante volte ogni cliente può usarla. NULL = illimitata nel periodo.
    usi_per_cliente     INTEGER DEFAULT 1 CHECK (usi_per_cliente IS NULL OR usi_per_cliente > 0),
    stato               TEXT NOT NULL DEFAULT 'bozza'
                        CHECK (stato IN ('bozza', 'pubblicata', 'archiviata')),
    pubblicata_il       TIMESTAMPTZ,
    creata_da           INTEGER REFERENCES admin_users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valido_al >= valido_dal),
    CHECK ((ora_inizio IS NULL) = (ora_fine IS NULL))
);

CREATE INDEX promozioni_stato_validita_idx ON promozioni (stato, valido_dal, valido_al);

-- Il cliente ha "caricato" la promo sulla sua tessera.
CREATE TABLE promozioni_clienti (
    id              SERIAL PRIMARY KEY,
    promozione_id   INTEGER NOT NULL REFERENCES promozioni(id),
    cliente_id      INTEGER NOT NULL REFERENCES clienti(id),
    caricata_il     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (promozione_id, cliente_id)
);

CREATE INDEX promozioni_clienti_cliente_idx ON promozioni_clienti (cliente_id);

-- Ogni utilizzo in cassa, registrato dall'operatore alla scansione.
CREATE TABLE promozioni_utilizzi (
    id              SERIAL PRIMARY KEY,
    promozione_id   INTEGER NOT NULL REFERENCES promozioni(id),
    cliente_id      INTEGER NOT NULL REFERENCES clienti(id),
    sede_id         INTEGER NOT NULL REFERENCES sedi(id),
    usata_il        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX promozioni_utilizzi_promo_cliente_idx ON promozioni_utilizzi (promozione_id, cliente_id);

-- Permessi per l'utente applicativo (la migrazione gira come postgres).
GRANT SELECT, INSERT, UPDATE, DELETE ON promozioni, promozioni_clienti, promozioni_utilizzi TO hclub;
GRANT USAGE, SELECT ON SEQUENCE promozioni_id_seq, promozioni_clienti_id_seq, promozioni_utilizzi_id_seq TO hclub;

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (3, 'QR statico sulla tessera (tessere.codice_qr) e promozioni da caricare (promozioni, promozioni_clienti, promozioni_utilizzi)');

COMMIT;
