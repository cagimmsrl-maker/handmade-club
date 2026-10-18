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
    </div>
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
