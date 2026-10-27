-- ============================================================
-- Migrazione 012 — Codice tessera in formato EAN-13 con prefisso 99911
-- Database: handmade_clienti
-- ============================================================
--
-- Richiesta TGS (27/10/2026): le fidelity card devono essere 13 cifre che
-- iniziano per 99911. Il codice nel QR (e ora anche nel codice a barre) è
-- tessere.codice_qr: da oggi 99911 + 7 cifre casuali + cifra di controllo
-- EAN-13 (promozioniService.generaCodiceQr). Le tessere già emesse con il
-- vecchio formato esadecimale ricevono un codice nuovo: nessuna card
-- stampata è in giro e nessun cliente è ancora stato sincronizzato in TGS.
-- Se in futuro servisse ri-emettere una card già in TGS, va rifatta anche lì.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ean13_controllo(dodici TEXT) RETURNS TEXT AS $$
DECLARE somma INT := 0; i INT;
BEGIN
  FOR i IN 1..12 LOOP
    somma := somma + substr(dodici, i, 1)::INT * (CASE WHEN i % 2 = 1 THEN 1 ELSE 3 END);
  END LOOP;
  RETURN ((10 - (somma % 10)) % 10)::TEXT;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE r RECORD; dodici TEXT; nuovo TEXT; tentativi INT;
BEGIN
  FOR r IN SELECT id FROM tessere WHERE codice_qr !~ '^99911[0-9]{8}$' LOOP
    tentativi := 0;
    LOOP
      dodici := '99911' || lpad(floor(random() * 10000000)::INT::TEXT, 7, '0');
      nuovo := dodici || pg_temp.ean13_controllo(dodici);
      BEGIN
        UPDATE tessere SET codice_qr = nuovo WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        tentativi := tentativi + 1;
        IF tentativi > 20 THEN RAISE EXCEPTION 'impossibile generare un codice univoco per la tessera %', r.id; END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- D'ora in poi solo codici nel formato nuovo.
ALTER TABLE tessere ADD CONSTRAINT tessere_codice_qr_formato CHECK (codice_qr ~ '^99911[0-9]{8}$');

INSERT INTO schema_migrations (versione, descrizione)
    VALUES (12, 'Codice tessera EAN-13 con prefisso 99911 (richiesta TGS); ri-emessi i codici esistenti');

COMMIT;
