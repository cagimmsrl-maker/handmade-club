import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { api } from '../../api.js'

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

  async function onScansioneRiuscita(qrToken) {
    if (scansioneInCorsoRef.current) return
    scansioneInCorsoRef.current = true
    setErroreScansione('')
    try {
      await lettoreRef.current.pause(true)
    } catch {
      /* già in pausa */
    }
    try {
      const dati = await api.post('/operatore/scansione', { qrToken })
      setRisultato(dati)
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
  const { esito, cliente, livello, convenzione } = risultato
  const giaRegistrata = esito === 'visita_gia_registrata'

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

      <button className="btn btn-primario" style={{ marginTop: 20 }} onClick={onNuovaScansione}>
        Prossimo cliente
      </button>
    </div>
  )
}
