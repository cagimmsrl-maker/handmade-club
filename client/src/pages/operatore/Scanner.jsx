import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { api } from '../../api.js'
import { etichettaTipo } from '../../lib/promo.js'

const ID_LETTORE = 'lettore-qr'

export default function Scanner({ sede }) {
  const lettoreRef = useRef(null)
  const scansioneInCorsoRef = useRef(false)
  const [risultato, setRisultato] = useState(null)
  const [erroreScansione, setErroreScansione] = useState('')
  const [erroreFotocamera, setErroreFotocamera] = useState('')
  const [scansionando, setScansionando] = useState(false)

  useEffect(() => {
    const lettore = new Html5Qrcode(ID_LETTORE)
    lettoreRef.current = lettore

    lettore
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScansioneRiuscita,
        () => {}
      )
      .then(() => setScansionando(true))
      .catch(() => setErroreFotocamera('Impossibile accedere alla fotocamera. Verifica i permessi.'))

    return () => {
      if (lettore.isScanning) lettore.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onScansioneRiuscita(codice) {
    if (scansioneInCorsoRef.current) return
    scansioneInCorsoRef.current = true
    setErroreScansione('')
    try {
      await lettoreRef.current.pause(true)
    } catch {
      /* già in pausa */
    }
    try {
      // `codice` è il QR statico della tessera (o il vecchio token per le
      // app non aggiornate: il server li distingue da solo).
      const dati = await api.post('/operatore/scansione', { codice })
      setRisultato({ ...dati, codiceScansionato: codice })
    } catch (err) {
      setErroreScansione(err.message)
    }
  }

  function riprendiScansione() {
    setRisultato(null)
    setErroreScansione('')
    scansioneInCorsoRef.current = false
    lettoreRef.current?.resume()
  }

  const mostraLettore = !risultato

  return (
    <div className="schermo">
      <h1>{sede.nome}</h1>

      {mostraLettore && (
        <div className="card">
          <div id={ID_LETTORE} style={{ width: '100%' }} />
          {!scansionando && !erroreFotocamera && <p className="testo-secondario">Avvio fotocamera...</p>}
          {erroreFotocamera && <p className="messaggio-errore">{erroreFotocamera}</p>}
          {erroreScansione && (
            <>
              <p className="messaggio-errore">{erroreScansione}</p>
              <button className="btn btn-secondario" onClick={riprendiScansione}>Riprova</button>
            </>
          )}
        </div>
      )}

      {risultato && <CardEsito risultato={risultato} onNuovaScansione={riprendiScansione} />}

      <CodiceAccesso />
    </div>
  )
}

// Il cliente non riesce a rientrare nella tessera (gli chiede di crearla di
// nuovo e l'SMS non arriva): l'operatore cerca il numero e gli legge il
// codice, che vale al posto di quello SMS (19/11/2026).
function CodiceAccesso() {
  const [aperto, setAperto] = useState(false)
  const [telefono, setTelefono] = useState('')
  const [esito, setEsito] = useState(null)
  const [errore, setErrore] = useState('')
  const [lavoro, setLavoro] = useState(false)

  async function genera(e) {
    e.preventDefault()
    setErrore(''); setEsito(null); setLavoro(true)
    try {
      setEsito(await api.post('/operatore/codice-accesso', { telefono }))
    } catch (err) {
      setErrore(err.message)
    }
    setLavoro(false)
  }

  if (!aperto) {
    return (
      <button className="link-testo" style={{ display: 'block', margin: '18px auto 0' }} onClick={() => setAperto(true)}>
        Il cliente non riesce a entrare nella tessera?
      </button>
    )
  }

  return (
    <form className="card" onSubmit={genera} style={{ marginTop: 18 }}>
      <h2>Codice di accesso</h2>
      <p className="testo-secondario">
        Scrivi qui il numero del cliente e leggigli il codice. Sul suo telefono il cliente tocca <strong>"Ho già la tessera"</strong>,
        scrive il numero, tocca <strong>"Ho già un codice dalla cassa"</strong> e lo inserisce.
      </p>
      <div className="campo">
        <label htmlFor="tel-accesso">Numero del cliente</label>
        <input id="tel-accesso" type="tel" inputMode="tel" placeholder="333 1234567" value={telefono}
               onChange={(e) => { setTelefono(e.target.value); setEsito(null) }} required />
      </div>
      {errore && <p className="messaggio-errore">{errore}</p>}
      {esito && (
        <div style={{ textAlign: 'center', margin: '8px 0 14px' }}>
          <p style={{ margin: 0 }}>Tessera di <strong>{esito.nome} {esito.cognome}</strong>: controlla che sia lui.</p>
          <p style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '0.18em', margin: '6px 0' }}>{esito.codice}</p>
          <p className="testo-secondario" style={{ margin: 0 }}>Vale {esito.validoMinuti} minuti, una volta sola.</p>
        </div>
      )}
      <button className="btn btn-primario" type="submit" disabled={lavoro}>{lavoro ? 'Un attimo…' : esito ? 'Genera un altro codice' : 'Genera il codice'}</button>
      <button type="button" className="link-testo" style={{ display: 'block', margin: '12px auto 0' }} onClick={() => { setAperto(false); setEsito(null); setTelefono(''); setErrore('') }}>Chiudi</button>
    </form>
  )
}

function CardEsito({ risultato, onNuovaScansione }) {
  const { esito, cliente, livello, convenzione, codiceScansionato } = risultato
  const giaRegistrata = esito === 'visita_gia_registrata'
  const [promozioni, setPromozioni] = useState(risultato.promozioni ?? [])
  const [usate, setUsate] = useState({})
  const [errorePromo, setErrorePromo] = useState('')
  const [inCorso, setInCorso] = useState(null)

  async function applica(p) {
    setInCorso(p.id)
    setErrorePromo('')
    try {
      const r = await api.post(`/operatore/promozioni/${p.id}/usa`, { codice: codiceScansionato })
      setUsate((u) => ({ ...u, [p.id]: true }))
      if (r.usiRimasti != null && r.usiRimasti <= 0) {
        setPromozioni((lista) => lista.map((x) => (x.id === p.id ? { ...x, usiRimasti: 0 } : x)))
      }
    } catch (err) {
      setErrorePromo(err.message)
    }
    setInCorso(null)
  }

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h2 style={{ fontSize: '2rem' }}>{cliente.nome}</h2>

      {giaRegistrata && (
        <p className="messaggio-errore" style={{ fontSize: '1.1rem' }}>
          Visita già registrata nelle ultime 2 ore
        </p>
      )}

      {livello && (
        <p style={{ fontSize: '1.4rem', margin: '12px 0' }}>
          Livello <strong>{livello.nome}</strong> — sconto <strong>{livello.scontoPercentuale}%</strong>
        </p>
      )}
      {convenzione && (
        <p style={{ fontSize: '1.2rem' }}>
          Convenzione <strong>{convenzione.nome}</strong> — sconto <strong>{convenzione.scontoPercentuale}%</strong>
        </p>
      )}

      {promozioni.length > 0 && (
        <div style={{ textAlign: 'left', marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>Promo caricate dal cliente</h3>
          {promozioni.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                padding: '10px 12px', border: '1px solid var(--colore-bordo)', borderRadius: 10, marginBottom: 8,
                background: usate[p.id] ? 'var(--colore-sfondo, #f6f6f6)' : 'white',
              }}
            >
              <div>
                <strong style={{ fontSize: '1.05rem' }}>{p.titolo}</strong>
                {etichettaTipo(p) && <div style={{ fontSize: '1rem' }}>{etichettaTipo(p)}</div>}
                {p.tipo === 'messaggio' && p.descrizione && <div className="testo-secondario">{p.descrizione}</div>}
                {p.usiRimasti != null && <div className="testo-secondario">usi rimasti: {usate[p.id] ? Math.max(0, p.usiRimasti - 1) : p.usiRimasti}</div>}
              </div>
              {p.tipo !== 'messaggio' && (
                usate[p.id] ? (
                  <span className="badge" style={{ background: 'var(--colore-primario)' }}>Applicata ✓</span>
                ) : (
                  <button className="btn btn-primario" onClick={() => applica(p)} disabled={inCorso === p.id}>
                    {inCorso === p.id ? '…' : 'Applicata'}
                  </button>
                )
              )}
            </div>
          ))}
          {errorePromo && <p className="messaggio-errore">{errorePromo}</p>}
          <p className="testo-secondario" style={{ fontSize: '0.8rem' }}>
            Applica lo sconto in cassa e premi "Applicata" per segnarla usata.
          </p>
        </div>
      )}

      <button className="btn btn-primario" style={{ marginTop: 20 }} onClick={onNuovaScansione}>
        Prossimo cliente
      </button>
    </div>
  )
}
